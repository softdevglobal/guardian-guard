import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Plus, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";

const INITIAL_FORM = {
  title: "",
  date_of_incident: new Date().toISOString().split("T")[0],
  time_of_incident: "",
  incident_location: "",
  environment: "office",
  incident_category: "injury",
  sub_category: "",
  incident_type: "participant",
  description: "",
  incident_summary: "",
  immediate_action_taken: "",
  current_participant_condition: "",
  participant_harmed: false,
  staff_harmed: false,
  injury_involved: false,
  medical_attention_required: false,
  emergency_service_contacted: false,
  investigation_required: false,
  participant_id: "",
  linked_staff_id: "",
  witnesses: "",
  other_persons_involved: "",
};

export function IncidentFormDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const { data: participants = [] } = useQuery({
    queryKey: ["participants-list"],
    queryFn: async () => {
      const { data } = await supabase.from("participants").select("id, first_name, last_name").eq("record_status", "active").limit(200);
      return data ?? [];
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("id, full_name, email").limit(200);
      return data ?? [];
    },
  });

  const isReportable =
    (form.injury_involved && form.incident_type === "participant") ||
    form.incident_category === "abuse_allegation" ||
    form.incident_category === "neglect_concern";

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data: countData } = await supabase.from("incidents").select("id", { count: "exact", head: true });
      const num = `INC-${String((countData as any)?.length ?? 0 + 1).padStart(4, "0")}`;
      const severity = isReportable ? "high" : form.medical_attention_required ? "medium" : "low";

      const witnessesArr = form.witnesses ? form.witnesses.split(",").map(w => w.trim()).filter(Boolean) : [];
      const otherArr = form.other_persons_involved ? form.other_persons_involved.split(",").map(w => w.trim()).filter(Boolean) : [];

      const { error } = await supabase.from("incidents").insert({
        incident_number: num,
        title: form.title,
        incident_type: form.incident_type,
        description: form.description,
        date_of_incident: form.date_of_incident || null,
        time_of_incident: form.time_of_incident || null,
        date_reported: new Date().toISOString().split("T")[0],
        reporter_role: user.role,
        incident_location: form.incident_location || null,
        environment: form.environment,
        incident_category: form.incident_category,
        sub_category: form.sub_category || null,
        incident_summary: form.incident_summary || null,
        immediate_action_taken: form.immediate_action_taken || null,
        current_participant_condition: form.current_participant_condition || null,
        participant_harmed: form.participant_harmed,
        staff_harmed: form.staff_harmed,
        injury_involved: form.injury_involved,
        medical_attention_required: form.medical_attention_required,
        emergency_service_contacted: form.emergency_service_contacted,
        investigation_required: form.investigation_required,
        is_reportable: isReportable,
        reportable_reason: isReportable
          ? form.incident_category === "abuse_allegation"
            ? "Abuse allegation"
            : form.incident_category === "neglect_concern"
              ? "Neglect concern"
              : "Participant injury"
          : null,
        severity,
        status: "draft",
        reported_by: user.id,
        organisation_id: user.organisation_id!,
        participant_id: form.participant_id || null,
        linked_staff_id: form.linked_staff_id || null,
        witnesses: witnessesArr,
        other_persons_involved: otherArr,
      });
      if (error) throw error;
      await logAudit({ action: "created", module: "incidents", details: { title: form.title, is_reportable: isReportable } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setOpen(false);
      setForm(INITIAL_FORM);
      toast({ title: "Incident reported", description: "Saved as draft." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="touch-target"><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Report Incident</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Report New Incident</DialogTitle></DialogHeader>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
          <Accordion type="multiple" defaultValue={["basics", "people", "type", "description"]} className="w-full">
            {/* Section 1 — Basics */}
            <AccordionItem value="basics">
              <AccordionTrigger>Incident Basics</AccordionTrigger>
              <AccordionContent className="space-y-3 px-1">
                <div className="space-y-2">
                  <Label htmlFor="title">Incident Title *</Label>
                  <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date of Incident</Label>
                    <Input type="date" value={form.date_of_incident} onChange={(e) => set("date_of_incident", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Time of Incident</Label>
                    <Input type="time" value={form.time_of_incident} onChange={(e) => set("time_of_incident", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={form.incident_location} onChange={(e) => set("incident_location", e.target.value)} placeholder="e.g. Office, Training Room" />
                  </div>
                  <div className="space-y-2">
                    <Label>Environment</Label>
                    <Select value={form.environment} onValueChange={(v) => set("environment", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                        <SelectItem value="digital_platform">Digital Platform</SelectItem>
                        <SelectItem value="phone_call">Phone/Call Session</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 2 — People Involved */}
            <AccordionItem value="people">
              <AccordionTrigger>People Involved</AccordionTrigger>
              <AccordionContent className="space-y-3 px-1">
                <div className="space-y-2">
                  <Label>Participant</Label>
                  <Select value={form.participant_id} onValueChange={(v) => set("participant_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select participant (optional)" /></SelectTrigger>
                    <SelectContent>
                      {participants.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Linked Staff Member</Label>
                  <Select value={form.linked_staff_id} onValueChange={(v) => set("linked_staff_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select staff (optional)" /></SelectTrigger>
                    <SelectContent>
                      {staffList.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Witnesses (comma-separated)</Label>
                  <Input value={form.witnesses} onChange={(e) => set("witnesses", e.target.value)} placeholder="e.g. Jane Doe, John Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Other Persons Involved (comma-separated)</Label>
                  <Input value={form.other_persons_involved} onChange={(e) => set("other_persons_involved", e.target.value)} placeholder="e.g. External contractor" />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 3 — Type & Classification */}
            <AccordionItem value="type">
              <AccordionTrigger>Type & Classification</AccordionTrigger>
              <AccordionContent className="space-y-3 px-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Incident Type</Label>
                    <Select value={form.incident_type} onValueChange={(v) => set("incident_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="participant">Participant-related</SelectItem>
                        <SelectItem value="environmental">Environmental</SelectItem>
                        <SelectItem value="complaint">Complaint-related</SelectItem>
                        <SelectItem value="operational">Operational</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Incident Category</Label>
                    <Select value={form.incident_category} onValueChange={(v) => set("incident_category", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="injury">Injury</SelectItem>
                        <SelectItem value="emotional_distress">Emotional Distress</SelectItem>
                        <SelectItem value="abuse_allegation">Abuse Allegation</SelectItem>
                        <SelectItem value="neglect_concern">Neglect Concern</SelectItem>
                        <SelectItem value="privacy_breach">Privacy Breach</SelectItem>
                        <SelectItem value="behavioural_event">Behavioural Event</SelectItem>
                        <SelectItem value="service_disruption">Service Disruption</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Sub-category</Label>
                  <Input value={form.sub_category} onChange={(e) => set("sub_category", e.target.value)} placeholder="Optional sub-category" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Participant Harmed?", field: "participant_harmed" },
                    { label: "Staff Harmed?", field: "staff_harmed" },
                    { label: "Injury Involved?", field: "injury_involved" },
                    { label: "Medical Attention?", field: "medical_attention_required" },
                    { label: "Emergency Services?", field: "emergency_service_contacted" },
                    { label: "Investigation Required?", field: "investigation_required" },
                  ].map(item => (
                    <div key={item.field} className="flex items-center justify-between">
                      <Label>{item.label}</Label>
                      <Switch checked={(form as any)[item.field]} onCheckedChange={(v) => set(item.field, v)} />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 4 — Description */}
            <AccordionItem value="description">
              <AccordionTrigger>Description & Immediate Actions</AccordionTrigger>
              <AccordionContent className="space-y-3 px-1">
                <div className="space-y-2">
                  <Label>Incident Summary</Label>
                  <Textarea value={form.incident_summary} onChange={(e) => set("incident_summary", e.target.value)} rows={2} placeholder="Brief summary" />
                </div>
                <div className="space-y-2">
                  <Label>Detailed Description *</Label>
                  <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} required />
                </div>
                <div className="space-y-2">
                  <Label>Immediate Action Taken</Label>
                  <Textarea value={form.immediate_action_taken} onChange={(e) => set("immediate_action_taken", e.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Current Participant Condition</Label>
                  <Input value={form.current_participant_condition} onChange={(e) => set("current_participant_condition", e.target.value)} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {isReportable && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
                Auto-classified as <strong>NDIS Reportable</strong> — this cannot be manually downgraded
              </p>
            </div>
          )}

          <Button type="submit" className="w-full touch-target" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Submitting..." : "Save as Draft"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
