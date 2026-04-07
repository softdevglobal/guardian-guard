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
import { Plus, MessageSquareWarning, Clock, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  submitted: "bg-info text-info-foreground",
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

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ["complaints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("complaints").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      toast({ title: "Complaint logged" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const openCount = complaints.filter((c) => !["resolved", "closed"].includes(c.status)).length;
  const resolvedCount = complaints.filter((c) => c.status === "resolved").length;
  const pendingAck = complaints.filter((c) => c.status === "submitted" && !(c as any).acknowledgement_date).length;

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
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelected(c); setSheetOpen(true); }}>
                      <TableCell className="font-mono text-sm">{c.complaint_number}</TableCell>
                      <TableCell className="font-medium max-w-[180px] truncate">{c.subject}</TableCell>
                      <TableCell className="text-sm capitalize">{((c as any).complaint_source ?? "—").replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-sm capitalize">{((c as any).complaint_category ?? "—").replace(/_/g, " ")}</TableCell>
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
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm capitalize">{((selected as any).complaint_source ?? "—").replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Channel</p><p className="text-sm capitalize">{((selected as any).submission_channel ?? "—").replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Category</p><p className="text-sm capitalize">{((selected as any).complaint_category ?? "—").replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Priority</p><Badge variant={selected.priority === "high" ? "destructive" : "outline"} className="capitalize">{selected.priority}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Anonymous</p><p className="text-sm">{(selected as any).anonymous ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Complainant</p><p className="text-sm">{(selected as any).complainant_name ?? selected.submitted_by_name ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Immediate Risk</p><p className="text-sm">{(selected as any).immediate_risk_identified ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Escalation Required</p><p className="text-sm">{(selected as any).escalation_required ? "Yes" : "No"}</p></div>
                </div>
                <Separator />
                <div><p className="text-xs text-muted-foreground">Description</p><p className="text-sm whitespace-pre-wrap">{selected.description ?? "—"}</p></div>
                {(selected as any).requested_outcome && (
                  <div><p className="text-xs text-muted-foreground">Requested Outcome</p><p className="text-sm whitespace-pre-wrap">{(selected as any).requested_outcome}</p></div>
                )}
                {(selected as any).resolution_actions && (
                  <>
                    <Separator />
                    <div><p className="text-xs text-muted-foreground">Resolution Actions</p><p className="text-sm whitespace-pre-wrap">{(selected as any).resolution_actions}</p></div>
                  </>
                )}
                {(selected as any).final_outcome && (
                  <div><p className="text-xs text-muted-foreground">Final Outcome</p><p className="text-sm whitespace-pre-wrap">{(selected as any).final_outcome}</p></div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
