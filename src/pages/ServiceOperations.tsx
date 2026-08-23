import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { BlockerAlert, EmptyState, HumanReviewNotice, PageHeading } from "@/components/compliance/GateUI";
import { useParticipants, useStaff, withOrg } from "@/hooks/useComplianceLookups";
import { assignmentBlockers } from "@/lib/serviceShifts";
import { checkAssignmentEligible } from "@/lib/staffEligibility";
import { emptyTemplateForm, selectableTemplates, templateBlockers, templatePayload } from "@/lib/serviceTaskTemplates";
import { TASK_TEMPLATE_QUERY_KEYS } from "@/lib/queryKeys";

export default function ServiceOperations() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const { data: participants = [] } = useParticipants();
  const { data: staff = [] } = useStaff();
  const canManage = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer", "supervisor"]);

  const [shiftForm, setShiftForm] = useState<Record<string, any>>({ geofence_radius_metres: 150, repeat_weeks: 1 });
  const [templateForm, setTemplateForm] = useState<Record<string, any>>({});
  const [prefForm, setPrefForm] = useState<Record<string, any>>({});
  const [locationForm, setLocationForm] = useState<Record<string, any>>({ geofence_radius_metres: 150 });
  const [assignBlockers, setAssignBlockers] = useState<string[]>([]);

  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: [TASK_TEMPLATE_QUERY_KEYS[0]],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_task_templates" as any).select("*").eq("record_status", "active").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  /** Only templates marked active can be attached to a new shift. */
  const activeTemplates = selectableTemplates(templates);


  const { data: locations = [] } = useQuery({
    queryKey: ["service-locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("participant_service_locations" as any).select("*").eq("record_status", "active");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: prefs = [] } = useQuery({
    queryKey: ["all-evidence-prefs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("participant_evidence_preferences" as any).select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ["scheduled-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_shifts" as any).select("*").eq("record_status", "active")
        .order("scheduled_start", { ascending: true }).limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  const createShifts = useMutation({
    mutationFn: async () => {
      const { participant_id, worker_id, scheduled_start, scheduled_end } = shiftForm;
      if (!participant_id || !worker_id || !scheduled_start || !scheduled_end) {
        throw new Error("Participant, worker, start and end are required.");
      }

      // Gate: eligibility, active agreement and participant access are checked before assignment.
      const eligibility = await checkAssignmentEligible(worker_id);
      const { data: agreements } = await supabase
        .from("service_agreements" as any).select("id, status, start_date, end_date")
        .eq("participant_id", participant_id).eq("status", "active");
      const date = String(scheduled_start).slice(0, 10);
      const agreement = (agreements as any[] | null)?.find(
        (a) => (!a.start_date || a.start_date <= date) && (!a.end_date || a.end_date >= date)
      );
      const blockers = assignmentBlockers({
        workerEligible: eligibility.allowed,
        workerEligibilityReason: eligibility.reason,
        hasActiveAgreement: !!agreement,
        participantAccessible: participants.some((p) => p.id === participant_id),
      });
      setAssignBlockers(blockers);
      if (blockers.length > 0) throw new Error(blockers.join(" "));

      const weeks = Math.max(1, Math.min(26, Number(shiftForm.repeat_weeks) || 1));
      const groupId = crypto.randomUUID();
      const location = locations.find((l) => l.id === shiftForm.location_id);
      const rows = Array.from({ length: weeks }).map((_, i) => {
        const start = new Date(scheduled_start);
        const end = new Date(scheduled_end);
        start.setDate(start.getDate() + i * 7);
        end.setDate(end.getDate() + i * 7);
        return withOrg(
          {
            participant_id, worker_id,
            supervisor_id: user!.id,
            service_agreement_id: agreement?.id ?? null,
            location_id: shiftForm.location_id || null,
            address_label: location?.address_label ?? location?.suburb ?? (shiftForm.address_label || null),
            service_type: shiftForm.service_type || null,
            support_item: shiftForm.support_item || null,
            scheduled_start: start.toISOString(),
            scheduled_end: end.toISOString(),
            geofence_latitude: location?.latitude ?? null,
            geofence_longitude: location?.longitude ?? null,
            geofence_radius_metres: location?.geofence_radius_metres ?? (Number(shiftForm.geofence_radius_metres) || 150),
            recurrence_group_id: weeks > 1 ? groupId : null,
          },
          user?.organisation_id,
          user?.id
        );
      });

      const { data: created, error } = await supabase.from("service_shifts" as any).insert(rows).select("id");
      if (error) throw error;

      const selectedTemplates = activeTemplates.filter((t) => shiftForm[`tpl_${t.id}`]);
      if (selectedTemplates.length > 0 && created) {
        const taskRows = (created as any[]).flatMap((s) =>
          selectedTemplates.map((t, idx) => ({
            organisation_id: user!.organisation_id,
            shift_id: s.id,
            template_id: t.id,
            title: t.name,
            participant_instructions: shiftForm[`instr_${t.id}`] || t.description || null,
            sequence: idx + 1,
            requires_before_photo: t.requires_before_photo,
            requires_after_photo: t.requires_after_photo,
          }))
        );
        const { error: taskError } = await supabase.from("service_shift_tasks" as any).insert(taskRows);
        if (taskError) throw taskError;
      }

      await logAudit({ action: "shifts_scheduled", module: "service_shifts", details: { count: rows.length } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-shifts"] });
      qc.invalidateQueries({ queryKey: ["my-shifts"] });
      qc.invalidateQueries({ queryKey: ["approval-shifts"] });
      toast({ title: "Shifts scheduled" });
    },

    onError: (e: any) => toast({ variant: "destructive", title: "Blocked", description: e.message }),
  });

  const saveRow = useMutation({
    mutationFn: async ({ table, values, key }: { table: string; values: Record<string, any>; key: string }) => {
      const payload = withOrg(values, user?.organisation_id, user?.id);
      const { error } = values.id
        ? await supabase.from(table as any).update(payload).eq("id", values.id)
        : await supabase.from(table as any).insert(payload);
      if (error) throw error;
      await logAudit({ action: values.id ? "updated" : "created", module: table, record_id: values.id });
      return key;
    },
    onSuccess: (key) => {
      qc.invalidateQueries({ queryKey: [key] });
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked", description: e.message }),
  });

  return (
    <div className="space-y-4">
      <PageHeading
        title="Service operations"
        description="Schedule shifts, assign eligible workers, manage task templates and record each participant's evidence preferences and safe service location."
      />
      <HumanReviewNotice>
        Assignment gates check worker eligibility, an active service agreement and your access to the participant.
        They support your decision — an authorised person remains responsible for who attends a service.
      </HumanReviewNotice>

      {!canManage && <EmptyState title="View only" description="You need supervisor, compliance or administrator access to change service operations." />}

      <Tabs defaultValue="schedule">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="schedule" className="min-h-[44px]">Scheduling</TabsTrigger>
          <TabsTrigger value="templates" className="min-h-[44px]">Task templates</TabsTrigger>
          <TabsTrigger value="preferences" className="min-h-[44px]">Evidence preferences</TabsTrigger>
          <TabsTrigger value="locations" className="min-h-[44px]">Service locations</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Schedule a shift</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sp">Participant</Label>
                <select id="sp" className="h-11 w-full rounded-md border bg-background px-3" value={shiftForm.participant_id ?? ""} onChange={(e) => setShiftForm({ ...shiftForm, participant_id: e.target.value })}>
                  <option value="">Select…</option>
                  {participants.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sw">Worker</Label>
                <select id="sw" className="h-11 w-full rounded-md border bg-background px-3" value={shiftForm.worker_id ?? ""} onChange={(e) => setShiftForm({ ...shiftForm, worker_id: e.target.value })}>
                  <option value="">Select…</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sl">Service location</Label>
                <select id="sl" className="h-11 w-full rounded-md border bg-background px-3" value={shiftForm.location_id ?? ""} onChange={(e) => setShiftForm({ ...shiftForm, location_id: e.target.value })}>
                  <option value="">No fixed location</option>
                  {locations.filter((l) => l.participant_id === shiftForm.participant_id).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="st">Service type</Label>
                <Input id="st" className="min-h-[44px]" value={shiftForm.service_type ?? ""} onChange={(e) => setShiftForm({ ...shiftForm, service_type: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ss">Scheduled start</Label>
                <Input id="ss" type="datetime-local" className="min-h-[44px]" value={shiftForm.scheduled_start ?? ""} onChange={(e) => setShiftForm({ ...shiftForm, scheduled_start: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="se">Scheduled end</Label>
                <Input id="se" type="datetime-local" className="min-h-[44px]" value={shiftForm.scheduled_end ?? ""} onChange={(e) => setShiftForm({ ...shiftForm, scheduled_end: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rw">Repeat weekly for (weeks)</Label>
                <Input id="rw" type="number" min={1} max={26} className="min-h-[44px]" value={shiftForm.repeat_weeks} onChange={(e) => setShiftForm({ ...shiftForm, repeat_weeks: e.target.value })} />
              </div>
              <fieldset className="md:col-span-2 space-y-2">
                <legend className="text-sm font-medium">Tasks for this shift</legend>
                {activeTemplates.map((t) => (
                  <div key={t.id} className="space-y-1 rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`tpl-${t.id}`} checked={!!shiftForm[`tpl_${t.id}`]} onCheckedChange={(v) => setShiftForm({ ...shiftForm, [`tpl_${t.id}`]: !!v })} />
                      <Label htmlFor={`tpl-${t.id}`}>{t.name}</Label>
                    </div>
                    {shiftForm[`tpl_${t.id}`] && (
                      <Textarea rows={2} placeholder="Participant-specific instructions" value={shiftForm[`instr_${t.id}`] ?? ""} onChange={(e) => setShiftForm({ ...shiftForm, [`instr_${t.id}`]: e.target.value })} />
                    )}
                  </div>
                ))}
                {templatesLoading && <p className="text-sm text-muted-foreground">Loading task templates…</p>}
                {templatesError && <p className="text-sm text-destructive">Task templates could not be loaded. Refresh the page or contact your administrator.</p>}
                {!templatesLoading && !templatesError && activeTemplates.length === 0 && <p className="text-sm text-muted-foreground">Create an active task template first.</p>}

              </fieldset>
              <div className="md:col-span-2 space-y-2">
                <BlockerAlert blockers={assignBlockers} title="Assignment blocked" />
                <Button className="min-h-[44px]" disabled={!canManage || createShifts.isPending} onClick={() => createShifts.mutate()}>Schedule shift(s)</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Scheduled shifts</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {upcoming.map((s) => (
                  <li key={s.id}>
                    {new Date(s.scheduled_start).toLocaleString()} — {participants.find((p) => p.id === s.participant_id)?.full_name ?? "Participant"} with{" "}
                    {staff.find((w) => w.id === s.worker_id)?.full_name ?? "worker"} · {s.status}
                  </li>
                ))}
                {upcoming.length === 0 && <li className="text-muted-foreground">No shifts scheduled yet.</li>}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">New task template</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="tn">Name</Label>
                <Input id="tn" className="min-h-[44px]" value={templateForm.name ?? ""} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tt">Service type</Label>
                <Input id="tt" className="min-h-[44px]" value={templateForm.service_type ?? ""} onChange={(e) => setTemplateForm({ ...templateForm, service_type: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="td">Description</Label>
                <Textarea id="td" value={templateForm.description ?? ""} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} />
              </div>
              {[
                ["requires_before_photo", "Requires a before photo (only where consent allows)"],
                ["requires_after_photo", "Requires an after photo (only where consent allows)"],
                ["participant_confirmation_required", "Participant confirmation required"],
                ["allow_gallery_upload", "Allow gallery upload as well as camera"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox id={key} checked={!!templateForm[key]} onCheckedChange={(v) => setTemplateForm({ ...templateForm, [key]: !!v })} />
                  <Label htmlFor={key}>{label}</Label>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Checkbox id="is_active" checked={templateForm.is_active !== false} onCheckedChange={(v) => setTemplateForm({ ...templateForm, is_active: !!v })} />
                <Label htmlFor="is_active">Active (available when scheduling shifts)</Label>
              </div>
              <div className="md:col-span-2">
                <Button
                  className="min-h-[44px]"
                  disabled={!canManage || saveRow.isPending}
                  onClick={() => {
                    const blockers = templateBlockers(templateForm);
                    if (blockers.length > 0) {
                      toast({ variant: "destructive", title: "Template incomplete", description: blockers.join(" ") });
                      return;
                    }
                    saveRow.mutate(
                      { table: "service_task_templates", values: templatePayload(templateForm), key: TASK_TEMPLATE_QUERY_KEYS[0] },
                      { onSuccess: () => setTemplateForm(emptyTemplateForm()) }
                    );
                  }}
                >
                  Save template
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Existing templates</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {templates.map((t) => (
                  <li key={t.id}>
                    {t.name} — {[t.requires_before_photo && "before photo", t.requires_after_photo && "after photo", t.participant_confirmation_required && "participant confirmation"].filter(Boolean).join(", ") || "no evidence requirement"}
                    {" · "}{t.is_active === false ? "inactive" : "active"}
                  </li>
                ))}
                {templatesLoading && <li className="text-muted-foreground">Loading templates…</li>}
                {templatesError && <li className="text-destructive">Templates could not be loaded.</li>}
                {!templatesLoading && !templatesError && templates.length === 0 && <li className="text-muted-foreground">No templates yet.</li>}
              </ul>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Participant evidence preferences</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <p className="md:col-span-2 text-sm text-muted-foreground">
                NDIS rules do not universally require before or after photographs. Photography is optional, consent-based,
                and refusing it never delays or reduces a person's service.
              </p>
              <div className="space-y-1">
                <Label htmlFor="pp">Participant</Label>
                <select id="pp" className="h-11 w-full rounded-md border bg-background px-3" value={prefForm.participant_id ?? ""} onChange={(e) => setPrefForm({ ...prefForm, participant_id: e.target.value })}>
                  <option value="">Select…</option>
                  {participants.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pc">Photography consent</Label>
                <select id="pc" className="h-11 w-full rounded-md border bg-background px-3" value={prefForm.photography_consent_status ?? "pending"} onChange={(e) => setPrefForm({ ...prefForm, photography_consent_status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="granted">Granted</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pr">Photography restrictions</Label>
                <Input id="pr" className="min-h-[44px]" value={prefForm.photography_restrictions ?? ""} onChange={(e) => setPrefForm({ ...prefForm, photography_restrictions: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pa">Private area restrictions</Label>
                <Input id="pa" className="min-h-[44px]" value={prefForm.private_area_restrictions ?? ""} onChange={(e) => setPrefForm({ ...prefForm, private_area_restrictions: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="pm">Alternative evidence method when photos are not permitted</Label>
                <Input id="pm" className="min-h-[44px]" value={prefForm.alternative_evidence_method ?? ""} onChange={(e) => setPrefForm({ ...prefForm, alternative_evidence_method: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="pma" checked={!!prefForm.participant_may_appear} onCheckedChange={(v) => setPrefForm({ ...prefForm, participant_may_appear: !!v })} />
                <Label htmlFor="pma">Participant may appear in photos</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="pae" checked={!!prefForm.accessible_explanation_provided} onCheckedChange={(v) => setPrefForm({ ...prefForm, accessible_explanation_provided: !!v })} />
                <Label htmlFor="pae">Accessible explanation provided</Label>
              </div>
              <div className="md:col-span-2">
                <Button
                  className="min-h-[44px]"
                  disabled={!canManage || saveRow.isPending}
                  onClick={() => {
                    if (!prefForm.participant_id) {
                      toast({ variant: "destructive", title: "Participant required", description: "Choose the participant these evidence preferences belong to." });
                      return;
                    }
                    // One preference record per participant: update the existing row rather than creating a duplicate.
                    const existingId = prefForm.id ?? prefs.find((p) => p.participant_id === prefForm.participant_id)?.id;
                    const values: Record<string, any> = {
                      ...prefForm,
                      reviewed_by: user?.id,
                      review_date: new Date().toISOString().slice(0, 10),
                    };
                    // An undefined id must never be sent: the column is generated on insert.
                    if (existingId) values.id = existingId;
                    else delete values.id;
                    saveRow.mutate({ table: "participant_evidence_preferences", values, key: "all-evidence-prefs" });

                  }}
                >

                  Save preferences
                </Button>
              </div>
              <ul className="md:col-span-2 space-y-1 text-sm">
                {prefs.map((p) => (
                  <li key={p.id}>{participants.find((x) => x.id === p.participant_id)?.full_name ?? "Participant"} — photography {p.photography_consent_status}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Participant service location</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="lp">Participant</Label>
                <select id="lp" className="h-11 w-full rounded-md border bg-background px-3" value={locationForm.participant_id ?? ""} onChange={(e) => setLocationForm({ ...locationForm, participant_id: e.target.value })}>
                  <option value="">Select…</option>
                  {participants.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ll">Label</Label>
                <Input id="ll" className="min-h-[44px]" value={locationForm.label ?? ""} onChange={(e) => setLocationForm({ ...locationForm, label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lsub">Suburb</Label>
                <Input id="lsub" className="min-h-[44px]" value={locationForm.suburb ?? ""} onChange={(e) => setLocationForm({ ...locationForm, suburb: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ladd">Address label shown to the worker</Label>
                <Input id="ladd" className="min-h-[44px]" value={locationForm.address_label ?? ""} onChange={(e) => setLocationForm({ ...locationForm, address_label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" className="min-h-[44px]" inputMode="decimal" value={locationForm.latitude ?? ""} onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lng">Longitude</Label>
                <Input id="lng" className="min-h-[44px]" inputMode="decimal" value={locationForm.longitude ?? ""} onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lr">Geofence radius (metres)</Label>
                <Input id="lr" type="number" className="min-h-[44px]" value={locationForm.geofence_radius_metres} onChange={(e) => setLocationForm({ ...locationForm, geofence_radius_metres: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="li">Access instructions (restricted to assigned workers and oversight roles)</Label>
                <Textarea id="li" value={locationForm.access_instructions ?? ""} onChange={(e) => setLocationForm({ ...locationForm, access_instructions: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Button
                  className="min-h-[44px]"
                  disabled={!canManage || saveRow.isPending}
                  onClick={() => {
                    if (!locationForm.participant_id || !String(locationForm.label ?? "").trim()) {
                      toast({ variant: "destructive", title: "Details required", description: "Choose a participant and give the location a label." });
                      return;
                    }
                    saveRow.mutate({ table: "participant_service_locations", values: locationForm, key: "service-locations" });
                  }}
                >

                  Save location
                </Button>
              </div>
              <ul className="md:col-span-2 space-y-1 text-sm">
                {locations.map((l) => (
                  <li key={l.id}>{l.label} — {l.suburb ?? "suburb not recorded"} · {l.geofence_radius_metres} m geofence</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
