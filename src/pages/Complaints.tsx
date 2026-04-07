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
import { Plus, MessageSquareWarning, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { logAudit } from "@/lib/auditLog";
import { PhotoUpload } from "@/components/PhotoUpload";

const STATUS_FLOW: Record<string, string> = {
  submitted: "acknowledged",
  acknowledged: "under_review",
  under_review: "investigating",
  investigating: "resolved",
  resolved: "closed",
};

const STATUS_ROLE_GATE: Record<string, string[]> = {
  acknowledged: ["super_admin", "compliance_officer", "supervisor"],
  under_review: ["super_admin", "compliance_officer"],
  investigating: ["super_admin", "compliance_officer"],
  resolved: ["super_admin", "compliance_officer"],
  closed: ["super_admin", "compliance_officer"],
};

const statusColors: Record<string, string> = {
  submitted: "bg-info text-info-foreground",
  acknowledged: "bg-info text-info-foreground",
  under_review: "bg-warning text-warning-foreground",
  investigating: "bg-destructive text-destructive-foreground",
  resolved: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
};

const INITIAL_FORM = {
  subject: "", description: "", priority: "medium",
  complaint_source: "participant", submission_channel: "web_form",
  complaint_category: "service_quality", complainant_name: "",
  anonymous: false, requested_outcome: "",
  immediate_risk_identified: false, escalation_required: false,
};

export default function Complaints() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selected, setSelected] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [closureErrors, setClosureErrors] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ["complaints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("complaints").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: workflowHistory = [] } = useQuery({
    queryKey: ["complaint-workflow", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase.from("complaint_workflow_history").select("*").eq("complaint_id", selected!.id).order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data: countData } = await supabase.from("complaints").select("id", { count: "exact", head: true });
      const num = `CMP-${String(((countData as any)?.length ?? 0) + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("complaints").insert({
        complaint_number: num,
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        complaint_source: form.complaint_source,
        submission_channel: form.submission_channel,
        complaint_category: form.complaint_category,
        complainant_name: form.anonymous ? null : form.complainant_name || null,
        anonymous: form.anonymous,
        requested_outcome: form.requested_outcome || null,
        immediate_risk_identified: form.immediate_risk_identified,
        escalation_required: form.escalation_required,
        submitted_by: user.id,
        submitted_by_name: user.full_name,
        organisation_id: user.organisation_id!,
      });
      if (error) throw error;
      await logAudit({ action: "created", module: "complaints", details: { subject: form.subject, category: form.complaint_category } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      setPhotos([]);
      toast({ title: "Complaint logged" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      if (!selected) return;
      const { error } = await supabase.from("complaints").update(fields as any).eq("id", selected.id);
      if (error) throw error;
      await logAudit({ action: "field_updated", module: "complaints", record_id: selected.id, details: fields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      toast({ title: "Saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const advanceMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !user) return;
      const nextStatus = STATUS_FLOW[selected.status];
      if (!nextStatus) throw new Error("No next status");

      if (nextStatus === "closed") {
        const errors: string[] = [];
        const ra = editFields.resolution_actions ?? selected.resolution_actions;
        const oc = editFields.outcome_communicated_date ?? selected.outcome_communicated_date;
        if (!ra) errors.push("Resolution actions are required");
        if (!oc) errors.push("Outcome communicated date is required");
        if (errors.length > 0) {
          setClosureErrors(errors);
          throw new Error("Closure criteria not met");
        }
      }
      setClosureErrors([]);

      const updatePayload: any = { status: nextStatus, ...editFields };
      if (nextStatus === "acknowledged") {
        updatePayload.acknowledgement_date = new Date().toISOString();
      }
      if (nextStatus === "resolved") {
        updatePayload.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase.from("complaints").update(updatePayload).eq("id", selected.id);
      if (error) throw error;

      await supabase.from("complaint_workflow_history").insert({
        complaint_id: selected.id,
        from_status: selected.status,
        to_status: nextStatus as any,
        changed_by: user.id,
      });

      await logAudit({
        action: "status_advanced",
        module: "complaints",
        record_id: selected.id,
        details: { from: selected.status, to: nextStatus },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      queryClient.invalidateQueries({ queryKey: ["complaint-workflow", selected?.id] });
      setEditFields({});
      // Refresh selected
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

  const openCount = complaints.filter((c) => !["resolved", "closed"].includes(c.status)).length;
  const resolvedCount = complaints.filter((c) => c.status === "resolved").length;
  const pendingAck = complaints.filter((c) => c.status === "submitted" && !c.acknowledgement_date).length;

  const nextStatus = selected ? STATUS_FLOW[selected.status] : null;
  const canAdvance = nextStatus && user && STATUS_ROLE_GATE[nextStatus]?.includes(user.role);
  const isSafeguardingCategory = selected?.complaint_category === "safeguarding";
  const isEditable = selected?.status !== "closed";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Complaints Management</h1>
          <p className="text-muted-foreground">Track, investigate, and resolve complaints</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Log Complaint</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Log Complaint</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2"><Label>Subject *</Label><Input value={form.subject} onChange={(e) => set("subject", e.target.value)} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={form.complaint_source} onValueChange={(v) => set("complaint_source", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="participant">Participant</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="advocate">Advocate</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="external">External</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select value={form.submission_channel} onValueChange={(v) => set("submission_channel", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="web_form">Web Form</SelectItem>
                      <SelectItem value="in_person">In Person</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.complaint_category} onValueChange={(v) => set("complaint_category", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service_quality">Service Quality</SelectItem>
                      <SelectItem value="staff_conduct">Staff Conduct</SelectItem>
                      <SelectItem value="delay">Delay</SelectItem>
                      <SelectItem value="communication">Communication</SelectItem>
                      <SelectItem value="privacy">Privacy</SelectItem>
                      <SelectItem value="safeguarding">Safeguarding</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Anonymous Complaint?</Label>
                <Switch checked={form.anonymous} onCheckedChange={(v) => set("anonymous", v)} />
              </div>
              {!form.anonymous && (
                <div className="space-y-2"><Label>Complainant Name</Label><Input value={form.complainant_name} onChange={(e) => set("complainant_name", e.target.value)} /></div>
              )}
              <div className="space-y-2"><Label>Description *</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} required rows={3} /></div>
              <div className="space-y-2"><Label>Requested Outcome</Label><Textarea value={form.requested_outcome} onChange={(e) => set("requested_outcome", e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Immediate Risk?</Label>
                  <Switch checked={form.immediate_risk_identified} onCheckedChange={(v) => set("immediate_risk_identified", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Escalation Required?</Label>
                  <Switch checked={form.escalation_required} onCheckedChange={(v) => set("escalation_required", v)} />
                </div>
              </div>
              {user && (
                <div className="space-y-2">
                  <Label>Photos & Evidence</Label>
                  <PhotoUpload folder="complaints" userId={user.id} photos={photos} onPhotosChange={setPhotos} />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Submitting..." : "Submit Complaint"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section aria-label="Complaint summary" className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open Complaints</CardTitle><MessageSquareWarning className="h-4 w-4 text-destructive" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{openCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pending Acknowledgement</CardTitle><Clock className="h-4 w-4 text-warning" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{pendingAck}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Resolved</CardTitle><CheckCircle className="h-4 w-4 text-success" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{resolvedCount}</div></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>All Complaints</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : complaints.length === 0 ? <p className="text-center py-4 text-muted-foreground">No complaints found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Subject</TableHead><TableHead>Source</TableHead><TableHead>Category</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {complaints.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelected(c); setSheetOpen(true); setEditFields({}); setClosureErrors([]); }}>
                      <TableCell className="font-mono text-sm">{c.complaint_number}</TableCell>
                      <TableCell className="font-medium max-w-[180px] truncate">{c.subject}</TableCell>
                      <TableCell className="text-sm capitalize">{(c.complaint_source ?? "—").replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-sm capitalize">{(c.complaint_category ?? "—").replace(/_/g, " ")}</TableCell>
                      <TableCell><Badge variant={c.priority === "high" ? "destructive" : "outline"} className="capitalize">{c.priority}</Badge></TableCell>
                      <TableCell><Badge className={`${statusColors[c.status] ?? ""} capitalize`}>{c.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(c.created_at), "PP")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complaint Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="font-mono text-sm">{selected.complaint_number}</span>
                  <Badge className={`${statusColors[selected.status] ?? ""} capitalize`}>{selected.status.replace(/_/g, " ")}</Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <h3 className="font-semibold">{selected.subject}</h3>

                {/* Safeguarding crossover warning */}
                {isSafeguardingCategory && (
                  <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
                    <p className="text-sm font-medium flex items-center gap-2 text-warning">
                      <AlertTriangle className="h-4 w-4" /> Safeguarding-related complaint — consider creating a safeguarding concern
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        window.open(`/safeguarding?linked_complaint=${selected.id}`, "_self");
                      }}
                    >
                      Create Safeguarding Concern
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm capitalize">{(selected.complaint_source ?? "—").replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Channel</p><p className="text-sm capitalize">{(selected.submission_channel ?? "—").replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Category</p><p className="text-sm capitalize">{(selected.complaint_category ?? "—").replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Priority</p><Badge variant={selected.priority === "high" ? "destructive" : "outline"} className="capitalize">{selected.priority}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Anonymous</p><p className="text-sm">{selected.anonymous ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Complainant</p><p className="text-sm">{selected.complainant_name ?? selected.submitted_by_name ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Immediate Risk</p><p className="text-sm">{selected.immediate_risk_identified ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Escalation Required</p><p className="text-sm">{selected.escalation_required ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Acknowledgement</p><p className="text-sm">{selected.acknowledgement_date ? format(new Date(selected.acknowledgement_date), "PPp") : "Pending"}</p></div>
                </div>

                <Separator />
                <div><p className="text-xs text-muted-foreground">Description</p><p className="text-sm whitespace-pre-wrap">{selected.description ?? "—"}</p></div>
                {selected.requested_outcome && <div><p className="text-xs text-muted-foreground">Requested Outcome</p><p className="text-sm whitespace-pre-wrap">{selected.requested_outcome}</p></div>}

                {/* Editable Investigation & Resolution */}
                {["investigating", "resolved", "closed"].includes(selected.status) && (
                  <>
                    <Separator />
                    <h4 className="text-sm font-semibold">Investigation & Resolution</h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Investigation Summary</Label>
                        {isEditable ? (
                          <Textarea
                            value={getField("investigation_summary")}
                            onChange={e => setEdit("investigation_summary", e.target.value)}
                            onBlur={() => editFields.investigation_summary !== undefined && saveMutation.mutate({ investigation_summary: editFields.investigation_summary })}
                            rows={2}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{selected.investigation_summary ?? "—"}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Resolution Actions</Label>
                        {isEditable ? (
                          <Textarea
                            value={getField("resolution_actions")}
                            onChange={e => setEdit("resolution_actions", e.target.value)}
                            onBlur={() => editFields.resolution_actions !== undefined && saveMutation.mutate({ resolution_actions: editFields.resolution_actions })}
                            rows={2}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{selected.resolution_actions ?? "—"}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Final Outcome</Label>
                        {isEditable ? (
                          <Textarea
                            value={getField("final_outcome")}
                            onChange={e => setEdit("final_outcome", e.target.value)}
                            onBlur={() => editFields.final_outcome !== undefined && saveMutation.mutate({ final_outcome: editFields.final_outcome })}
                            rows={2}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{selected.final_outcome ?? "—"}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Outcome Communicated Date</Label>
                        {isEditable ? (
                          <Input
                            type="date"
                            value={getField("outcome_communicated_date") ? String(getField("outcome_communicated_date")).split("T")[0] : ""}
                            onChange={e => {
                              setEdit("outcome_communicated_date", e.target.value ? new Date(e.target.value).toISOString() : null);
                            }}
                            onBlur={() => editFields.outcome_communicated_date !== undefined && saveMutation.mutate({ outcome_communicated_date: editFields.outcome_communicated_date })}
                          />
                        ) : (
                          <p className="text-sm">{selected.outcome_communicated_date ? format(new Date(selected.outcome_communicated_date), "PP") : "—"}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Closure errors */}
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

                {/* Workflow History */}
                <Separator />
                <h4 className="text-sm font-semibold">Workflow History</h4>
                {workflowHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No status changes yet</p>
                ) : (
                  <div className="space-y-2">
                    {workflowHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="capitalize text-xs">{(h.from_status ?? "new").replace(/_/g, " ")}</Badge>
                        <span>→</span>
                        <Badge variant="outline" className="capitalize text-xs">{h.to_status.replace(/_/g, " ")}</Badge>
                        <span className="text-muted-foreground text-xs">{format(new Date(h.created_at), "PPp")}</span>
                      </div>
                    ))}
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
