import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, HeartHandshake, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { logAudit } from "@/lib/auditLog";

const STATUS_FLOW: Record<string, string> = {
  raised: "screened",
  screened: "action_required",
  action_required: "monitoring",
  monitoring: "resolved",
  resolved: "closed",
};

const STATUS_ROLE_GATE: Record<string, string[]> = {
  screened: ["super_admin", "compliance_officer", "supervisor"],
  action_required: ["super_admin", "compliance_officer"],
  monitoring: ["super_admin", "compliance_officer"],
  resolved: ["super_admin", "compliance_officer"],
  closed: ["super_admin", "compliance_officer"],
};

const statusColors: Record<string, string> = {
  raised: "bg-info text-info-foreground",
  screened: "bg-warning text-warning-foreground",
  action_required: "bg-destructive text-destructive-foreground",
  monitoring: "bg-warning text-warning-foreground",
  resolved: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
};

const INITIAL_FORM = {
  concern_type: "distress",
  source: "staff_observation",
  detailed_description: "",
  immediate_safety_risk: false,
  immediate_action_taken: "",
  escalation_level: "monitor",
  participant_id: "",
};

export default function Safeguarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selected, setSelected] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, any>>({});

  const { data: concerns = [], isLoading } = useQuery({
    queryKey: ["safeguarding"],
    queryFn: async () => {
      const { data, error } = await supabase.from("safeguarding_concerns").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["participants-list"],
    queryFn: async () => {
      const { data } = await supabase.from("participants").select("id, first_name, last_name").eq("record_status", "active").limit(200);
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!form.participant_id) throw new Error("Please select a participant");
      const { error } = await supabase.from("safeguarding_concerns").insert({
        participant_id: form.participant_id,
        concern_type: form.concern_type as any,
        source: form.source as any,
        detailed_description: form.detailed_description || null,
        immediate_safety_risk: form.immediate_safety_risk,
        immediate_action_taken: form.immediate_action_taken || null,
        escalation_level: form.escalation_level as any,
        raised_by: user.id,
        organisation_id: user.organisation_id!,
      });
      if (error) throw error;
      await logAudit({ action: "created", module: "safeguarding_concerns", details: { concern_type: form.concern_type, participant_id: form.participant_id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safeguarding"] });
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      toast({ title: "Safeguarding concern raised" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      if (!selected) return;
      const { error } = await supabase.from("safeguarding_concerns").update(fields as any).eq("id", selected.id);
      if (error) throw error;
      await logAudit({ action: "field_updated", module: "safeguarding_concerns", record_id: selected.id, details: fields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safeguarding"] });
      toast({ title: "Saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [closureErrors, setClosureErrors] = useState<string[]>([]);

  const validateSafeguardingClosure = (): string[] => {
    if (!selected) return [];
    const errors: string[] = [];
    const outcome = editFields.outcome ?? selected.outcome;
    const reviewNotes = editFields.review_notes ?? selected.review_notes;
    if (!outcome || !outcome.trim()) errors.push("Outcome is required before closure");
    if (!reviewNotes || !reviewNotes.trim()) errors.push("Review notes are required before closure");
    return errors;
  };

  const advanceMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !user) return;
      const nextStatus = STATUS_FLOW[selected.status];
      if (!nextStatus) throw new Error("No next status");

      if (nextStatus === "closed") {
        const errors = validateSafeguardingClosure();
        if (errors.length > 0) {
          setClosureErrors(errors);
          throw new Error("Closure criteria not met");
        }
      }
      setClosureErrors([]);

      const updatePayload: any = { status: nextStatus, ...editFields };
      const { error } = await supabase.from("safeguarding_concerns").update(updatePayload).eq("id", selected.id);
      if (error) throw error;

      await logAudit({
        action: "status_advanced",
        module: "safeguarding_concerns",
        record_id: selected.id,
        details: { from: selected.status, to: nextStatus },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safeguarding"] });
      setEditFields({});
      setSelected((prev: any) => prev ? { ...prev, status: STATUS_FLOW[prev.status], ...editFields } : null);
      toast({ title: "Status updated" });
    },
    onError: (err: any) => {
      if (err.message !== "Closure criteria not met") {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const setEdit = (key: string, val: any) => setEditFields(prev => ({ ...prev, [key]: val }));
  const getField = (key: string) => editFields[key] ?? selected?.[key] ?? "";

  const activeCount = concerns.filter((c) => !["resolved", "closed"].includes(c.status)).length;
  const urgentCount = concerns.filter((c) => c.escalation_level === "immediate_intervention" || c.immediate_safety_risk).length;

  // Repeat concern check
  const participantConcernCount = selected ? concerns.filter(c => c.participant_id === selected.participant_id).length : 0;

  const nextStatus = selected ? STATUS_FLOW[selected.status] : null;
  const canAdvance = nextStatus && user && STATUS_ROLE_GATE[nextStatus]?.includes(user.role);
  const isEditable = selected?.status !== "closed";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Safeguarding</h1>
          <p className="text-muted-foreground">Participant safeguarding concerns and interventions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Raise Concern</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Raise Safeguarding Concern</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2">
                <Label>Participant *</Label>
                <Select value={form.participant_id} onValueChange={(v) => set("participant_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select participant" /></SelectTrigger>
                  <SelectContent>{participants.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Concern Type</Label>
                  <Select value={form.concern_type} onValueChange={(v) => set("concern_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="distress">Distress</SelectItem>
                      <SelectItem value="abuse_concern">Abuse Concern</SelectItem>
                      <SelectItem value="neglect_concern">Neglect Concern</SelectItem>
                      <SelectItem value="exploitation">Exploitation</SelectItem>
                      <SelectItem value="digital_safety">Digital Safety</SelectItem>
                      <SelectItem value="self_harm">Self-harm Concern</SelectItem>
                      <SelectItem value="behavioural_change">Behavioural Change</SelectItem>
                      <SelectItem value="isolation">Isolation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={form.source} onValueChange={(v) => set("source", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff_observation">Staff Observation</SelectItem>
                      <SelectItem value="ai_alert">AI Alert</SelectItem>
                      <SelectItem value="complaint">Complaint</SelectItem>
                      <SelectItem value="participant_disclosure">Participant Disclosure</SelectItem>
                      <SelectItem value="external_report">External Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Escalation Level</Label>
                <Select value={form.escalation_level} onValueChange={(v) => set("escalation_level", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monitor">Monitor</SelectItem>
                    <SelectItem value="urgent_review">Urgent Review</SelectItem>
                    <SelectItem value="immediate_intervention">Immediate Intervention</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Immediate Safety Risk?</Label>
                <Switch checked={form.immediate_safety_risk} onCheckedChange={(v) => set("immediate_safety_risk", v)} />
              </div>
              <div className="space-y-2"><Label>Detailed Description *</Label><Textarea value={form.detailed_description} onChange={(e) => set("detailed_description", e.target.value)} rows={4} required /></div>
              <div className="space-y-2"><Label>Immediate Action Taken</Label><Textarea value={form.immediate_action_taken} onChange={(e) => set("immediate_action_taken", e.target.value)} rows={2} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Submitting..." : "Raise Concern"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section aria-label="Safeguarding summary" className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Active Concerns</CardTitle><HeartHandshake className="h-4 w-4 text-destructive" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{activeCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Urgent / Immediate</CardTitle><HeartHandshake className="h-4 w-4 text-warning" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{urgentCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle><HeartHandshake className="h-4 w-4 text-muted-foreground" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{concerns.length}</div></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>All Safeguarding Concerns</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : concerns.length === 0 ? <p className="text-center py-4 text-muted-foreground">No concerns found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Source</TableHead><TableHead>Escalation</TableHead><TableHead>Status</TableHead><TableHead>Safety Risk</TableHead></TableRow></TableHeader>
                <TableBody>
                  {concerns.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelected(c); setSheetOpen(true); setEditFields({}); }}>
                      <TableCell className="text-sm">{format(new Date(c.date_raised), "PP")}</TableCell>
                      <TableCell className="capitalize text-sm">{c.concern_type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="capitalize text-sm">{c.source.replace(/_/g, " ")}</TableCell>
                      <TableCell><Badge variant={c.escalation_level === "immediate_intervention" ? "destructive" : c.escalation_level === "urgent_review" ? "outline" : "secondary"} className="capitalize">{c.escalation_level.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell><Badge className={`${statusColors[c.status] ?? ""} capitalize`}>{c.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell>{c.immediate_safety_risk ? <Badge variant="destructive">Yes</Badge> : <span className="text-muted-foreground text-sm">No</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle>Safeguarding Concern</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4">
                {/* Repeat concern banner */}
                {participantConcernCount >= 2 && (
                  <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
                    <p className="text-sm font-medium flex items-center gap-2 text-warning">
                      <AlertTriangle className="h-4 w-4" /> This participant has {participantConcernCount} safeguarding concerns on record
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Type</p><p className="text-sm capitalize">{selected.concern_type.replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm capitalize">{selected.source.replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Escalation Level</p><Badge variant={selected.escalation_level === "immediate_intervention" ? "destructive" : "outline"} className="capitalize">{selected.escalation_level.replace(/_/g, " ")}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Safety Risk</p><p className="text-sm">{selected.immediate_safety_risk ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><Badge className={`${statusColors[selected.status] ?? ""} capitalize`}>{selected.status.replace(/_/g, " ")}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Date Raised</p><p className="text-sm">{format(new Date(selected.date_raised), "PP")}</p></div>
                </div>

                {/* Linked records display */}
                {(selected.linked_incident_id || selected.linked_complaint_id || selected.linked_risk_id) && (
                  <>
                    <Separator />
                    <h4 className="text-sm font-semibold">Linked Records</h4>
                    <div className="space-y-1 text-sm">
                      {selected.linked_incident_id && <p>Linked Incident: <span className="font-mono">{selected.linked_incident_id.slice(0, 8)}...</span></p>}
                      {selected.linked_complaint_id && <p>Linked Complaint: <span className="font-mono">{selected.linked_complaint_id.slice(0, 8)}...</span></p>}
                      {selected.linked_risk_id && <p>Linked Risk: <span className="font-mono">{selected.linked_risk_id.slice(0, 8)}...</span></p>}
                    </div>
                  </>
                )}

                <Separator />
                <div><p className="text-xs text-muted-foreground">Description</p><p className="text-sm whitespace-pre-wrap">{selected.detailed_description ?? "—"}</p></div>
                {selected.immediate_action_taken && <div><p className="text-xs text-muted-foreground">Immediate Action</p><p className="text-sm whitespace-pre-wrap">{selected.immediate_action_taken}</p></div>}

                {/* Editable fields */}
                {isEditable && (
                  <>
                    <Separator />
                    <h4 className="text-sm font-semibold">Review & Actions</h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Review Notes</Label>
                        <Textarea
                          value={getField("review_notes")}
                          onChange={e => setEdit("review_notes", e.target.value)}
                          onBlur={() => editFields.review_notes !== undefined && saveMutation.mutate({ review_notes: editFields.review_notes })}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Support Actions</Label>
                        <Textarea
                          value={getField("support_actions")}
                          onChange={e => setEdit("support_actions", e.target.value)}
                          onBlur={() => editFields.support_actions !== undefined && saveMutation.mutate({ support_actions: editFields.support_actions })}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Outcome</Label>
                        <Textarea
                          value={getField("outcome")}
                          onChange={e => setEdit("outcome", e.target.value)}
                          onBlur={() => editFields.outcome !== undefined && saveMutation.mutate({ outcome: editFields.outcome })}
                          rows={2}
                        />
                      </div>
                    </div>
                  </>
                )}

                {!isEditable && selected.outcome && (
                  <>
                    <Separator />
                    <div><p className="text-xs text-muted-foreground">Outcome</p><p className="text-sm whitespace-pre-wrap">{selected.outcome}</p></div>
                  </>
                )}

                {/* Closure Validation Errors */}
                {closureErrors.length > 0 && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 space-y-1">
                    <p className="text-sm font-medium flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" /> Cannot close — criteria not met:
                    </p>
                    <ul className="text-xs text-destructive space-y-0.5 list-disc list-inside">
                      {closureErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}

                {/* Advance button */}
                {nextStatus && (
                  <div className="pt-2">
                    <Button
                      className="w-full"
                      disabled={!canAdvance || advanceMutation.isPending}
                      onClick={() => advanceMutation.mutate()}
                    >
                      {canAdvance
                        ? `Advance to ${nextStatus.replace(/_/g, " ")}`
                        : `Requires ${STATUS_ROLE_GATE[nextStatus]?.join(", ")} role`}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
