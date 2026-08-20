import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import {
  EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill,
} from "@/components/compliance/GateUI";
import { RecordSheet, type FieldDef } from "@/components/compliance/RecordSheet";
import { toOptions, useParticipants, useStaff, withOrg } from "@/hooks/useComplianceLookups";
import {
  medicationAlertLevel, medicationProfileActivationBlockers, medicationRecordBlockers,
} from "@/lib/complianceGates";

export default function Medication() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canEdit = !isMockAudit && hasRole(["super_admin", "compliance_officer", "supervisor", "support_worker", "trainer"]);
  const { data: participants = [] } = useParticipants();
  const { data: staff = [] } = useStaff();
  const [profileSheet, setProfileSheet] = useState<Record<string, any> | null>(null);
  const [marSheet, setMarSheet] = useState<Record<string, any> | null>(null);

  const { data: profiles = [], isLoading: loadingProfiles, error: profilesError } = useQuery({
    queryKey: ["medication-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medication_profiles" as any)
        .select("*")
        .eq("record_status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: records = [], isLoading: loadingRecords, error: recordsError } = useQuery({
    queryKey: ["medication-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medication_administration_records" as any)
        .select("*")
        .order("due_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async ({ table, values }: { table: string; values: Record<string, any> }) => {
      const payload = withOrg(values, user?.organisation_id, user?.id);
      if (values.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from(table as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table as any).insert(payload);
        if (error) throw error;
      }
      await logAudit({ action: values.id ? "updated" : "created", module: table, record_id: values.id ?? undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medication-profiles"] });
      qc.invalidateQueries({ queryKey: ["medication-records"] });
      toast({ title: "Saved", description: "The medication record has been written to the audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked by the compliance engine", description: e.message }),
  });

  const participantName = (id: string) => participants.find((p) => p.id === id)?.full_name ?? "Restricted";
  const profileLabel = (p: any) => `${participantName(p.participant_id)} — ${p.medication_name} ${p.dose ?? ""}`;

  const alerts = useMemo(
    () =>
      records
        .map((r) => ({ record: r, level: medicationAlertLevel({ result: r.result, due_at: r.due_at }) }))
        .filter((a) => a.level !== "none")
        .slice(0, 25),
    [records]
  );

  const profileFields: FieldDef[] = [
    { name: "participant_id", label: "Participant", type: "select", required: true, options: toOptions(participants) },
    { name: "medication_name", label: "Medication", type: "text", required: true },
    { name: "form", label: "Form", type: "text", help: "Tablet, liquid, patch, injection…" },
    { name: "dose", label: "Dose", type: "text", required: true },
    { name: "timing", label: "Timing", type: "text", required: true },
    { name: "route", label: "Route", type: "text", required: true },
    { name: "prescriber_name", label: "Prescriber", type: "text", required: true },
    { name: "prescriber_contact", label: "Prescriber contact", type: "text" },
    { name: "pharmacy", label: "Pharmacy", type: "text" },
    { name: "authorised_record_url", label: "Authorised medication record (URL)", type: "text", help: "Required before the profile can be active." },
    { name: "consent_obtained", label: "Consent obtained for medication support", type: "checkbox" },
    { name: "consent_date", label: "Consent date", type: "date" },
    { name: "storage_location", label: "Storage location", type: "text", required: true },
    { name: "controlled_drug", label: "Controlled drug (additional storage and recording rules apply)", type: "checkbox" },
    { name: "double_check_required", label: "Second-person check required at administration", type: "checkbox" },
    { name: "start_date", label: "Start date", type: "date", required: true },
    { name: "end_date", label: "End date", type: "date" },
    { name: "review_date", label: "Review date", type: "date", required: true },
    {
      name: "status", label: "Status", type: "select", required: true,
      options: ["draft", "active", "ceased"].map((v) => ({ value: v, label: v })),
    },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const marFields: FieldDef[] = [
    {
      name: "medication_profile_id", label: "Medication profile", type: "select", required: true,
      options: profiles.filter((p) => p.status === "active").map((p) => ({ value: p.id, label: profileLabel(p) })),
    },
    { name: "due_at", label: "Due at", type: "datetime", required: true },
    {
      name: "result", label: "Result", type: "select", required: true,
      options: ["administered", "refused", "withheld", "missed", "self_administered"].map((v) => ({ value: v, label: v.replace("_", " ") })),
    },
    { name: "reason", label: "Reason", type: "textarea", help: "Required when a dose is refused, withheld or missed." },
    { name: "witness_id", label: "Witness (second person)", type: "select", options: toOptions(staff) },
    { name: "escalation_notes", label: "Escalation notes", type: "textarea" },
  ];

  const marBlockers = (values: Record<string, any>) => {
    const profile = profiles.find((p) => p.id === values.medication_profile_id);
    return medicationRecordBlockers({
      result: values.result,
      reason: values.reason,
      witness_id: values.witness_id,
      worker_id: user?.id,
      doubleCheckRequired: !!profile?.double_check_required,
      profileActive: profile?.status === "active",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Medication management"
        description="Core Module 4.3. Medication profiles, storage details and the medication administration record. The system records what happened and escalates gaps — it never gives clinical advice or decides whether a dose should be given."
        actions={
          <>
            <Button onClick={() => setProfileSheet({})} disabled={!canEdit}>New medication profile</Button>
            <Button variant="outline" onClick={() => setMarSheet({})} disabled={!canEdit}>Record administration</Button>
          </>
        }
      />
      <HumanReviewNotice>
        Medication information is recorded for evidence only. Clinical decisions remain with the prescriber and the
        authorised worker. Escalations below require human follow-up.
      </HumanReviewNotice>

      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escalations and overdue doses</CardTitle>
            <CardDescription>Refused, withheld and missed doses escalate to the supervisor and compliance officer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map(({ record, level }) => (
              <div key={record.id} className="flex flex-wrap items-center gap-2 text-sm">
                <StatusPill tone={level === "escalate" ? "bad" : "warn"}>{level === "escalate" ? "Escalated" : "Overdue"}</StatusPill>
                <span>{participantName(record.participant_id)}</span>
                <span className="text-muted-foreground">due {new Date(record.due_at).toLocaleString()}</span>
                {record.reason && <span className="text-muted-foreground">— {record.reason}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="profiles">
        <TabsList>
          <TabsTrigger value="profiles">Medication profiles</TabsTrigger>
          <TabsTrigger value="mar">Administration record</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-4">
          {profilesError ? <ErrorState error={profilesError} /> : loadingProfiles ? <LoadingState /> : profiles.length === 0 ? (
            <EmptyState title="No medication profiles" description="Create a profile to begin recording administration." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead>Dose and timing</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead className="w-24">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => {
                    const blockers = medicationProfileActivationBlockers(p);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{participantName(p.participant_id)}</TableCell>
                        <TableCell>
                          {p.medication_name}
                          {p.controlled_drug && <StatusPill tone="warn">Controlled</StatusPill>}
                        </TableCell>
                        <TableCell>{p.dose} · {p.timing} · {p.route}</TableCell>
                        <TableCell>{p.storage_location ?? "—"}</TableCell>
                        <TableCell>
                          <StatusPill tone={p.status === "active" ? "ok" : blockers.length ? "warn" : "neutral"}>
                            {p.status === "active" ? "Active" : blockers.length ? "Cannot activate yet" : p.status}
                          </StatusPill>
                        </TableCell>
                        <TableCell>{p.review_date ?? "—"}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => setProfileSheet(p)}>Open</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="mar" className="space-y-4">
          {recordsError ? <ErrorState error={recordsError} /> : loadingRecords ? <LoadingState /> : records.length === 0 ? (
            <EmptyState title="No administration records" description="Recorded doses appear here with their escalation status." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Witness</TableHead>
                    <TableHead>Escalated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.due_at).toLocaleString()}</TableCell>
                      <TableCell>{participantName(r.participant_id)}</TableCell>
                      <TableCell>{r.result ?? "Not recorded"}</TableCell>
                      <TableCell>{r.reason ?? "—"}</TableCell>
                      <TableCell>{staff.find((s) => s.id === r.witness_id)?.full_name ?? "—"}</TableCell>
                      <TableCell>{r.escalated ? <StatusPill tone="bad">Escalated</StatusPill> : "No"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {profileSheet && (
        <RecordSheet
          open
          onOpenChange={(o) => !o && setProfileSheet(null)}
          title="Medication profile"
          description="A profile can only be activated once the authorised record, consent, dose, timing and route are recorded."
          fields={profileFields}
          initial={profileSheet}
          blockers={(v) => (v.status === "active" ? medicationProfileActivationBlockers(v as any) : [])}
          readOnly={!canEdit}
          readOnlyReason="Mock audit mode or your role prevents changes."
          onSubmit={async (values) => {
            await save.mutateAsync({ table: "medication_profiles", values });
            setProfileSheet(null);
          }}
        />
      )}

      {marSheet && (
        <RecordSheet
          open
          onOpenChange={(o) => !o && setMarSheet(null)}
          title="Record administration"
          description="A second-person check is enforced for medications flagged as requiring it."
          fields={marFields}
          initial={marSheet}
          blockers={marBlockers}
          readOnly={!canEdit}
          readOnlyReason="Mock audit mode or your role prevents changes."
          onSubmit={async (values) => {
            const profile = profiles.find((p) => p.id === values.medication_profile_id);
            await save.mutateAsync({
              table: "medication_administration_records",
              values: {
                ...values,
                participant_id: profile?.participant_id,
                worker_id: user?.id,
                recorded_at: new Date().toISOString(),
              },
            });
            setMarSheet(null);
          }}
        />
      )}
    </div>
  );
}
