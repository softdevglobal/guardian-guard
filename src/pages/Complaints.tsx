import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Plus, MessageSquareWarning, Clock, CheckCircle, AlertTriangle,
  FileText, BarChart3, Shield, UserCheck, Search, ArrowRight,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, differenceInHours, differenceInDays, subDays } from "date-fns";
import { logAudit } from "@/lib/auditLog";
import { PhotoUpload } from "@/components/PhotoUpload";

// ── Constants ──

const STATUS_FLOW: Record<string, string> = {
  submitted: "acknowledged",
  acknowledged: "under_review",
  under_review: "investigating",
  investigating: "resolved",
  resolved: "closed",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  under_review: "Under Review",
  investigating: "Investigating",
  resolved: "Resolved",
  closed: "Closed",
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

const PIPELINE_STEPS = ["submitted", "acknowledged", "under_review", "investigating", "resolved", "closed"];

const INITIAL_FORM = {
  subject: "", description: "", priority: "medium",
  complaint_source: "participant", submission_channel: "web_form",
  complaint_category: "service_quality", complainant_name: "",
  anonymous: false, requested_outcome: "",
  immediate_risk_identified: false, escalation_required: false,
};

// ── Main Component ──

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
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // ── Queries ──

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

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["complaint-audit-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").eq("module", "complaints").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const { data: orgStaff = [] } = useQuery({
    queryKey: ["org-staff"],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("id, full_name, email").order("full_name");
      return data ?? [];
    },
  });

  // ── Derived data ──

  const filteredComplaints = useMemo(() => {
    let list = complaints;
    if (filterStatus !== "all") list = list.filter(c => c.status === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c =>
        c.complaint_number.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        (c.complainant_name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [complaints, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    const now = new Date();
    const open = complaints.filter(c => !["resolved", "closed"].includes(c.status)).length;
    const resolved = complaints.filter(c => c.status === "resolved" || c.status === "closed").length;
    const pendingAck = complaints.filter(c => c.status === "submitted" && !c.acknowledgement_date).length;
    const overdueAck = complaints.filter(c => {
      if (c.status !== "submitted") return false;
      return differenceInHours(now, new Date(c.created_at)) > 48;
    }).length;
    const stale = complaints.filter(c => {
      if (["resolved", "closed"].includes(c.status)) return false;
      return differenceInDays(now, new Date(c.updated_at)) > 7;
    }).length;

    // Resolution metrics
    const closedComplaints = complaints.filter(c => c.status === "closed" && c.resolved_at);
    const avgResolutionDays = closedComplaints.length > 0
      ? Math.round(closedComplaints.reduce((sum, c) => sum + differenceInDays(new Date(c.resolved_at!), new Date(c.created_at)), 0) / closedComplaints.length)
      : 0;

    // Category breakdown
    const categories: Record<string, number> = {};
    complaints.forEach(c => {
      const cat = c.complaint_category ?? "uncategorised";
      categories[cat] = (categories[cat] || 0) + 1;
    });

    // Repeated complaints (same participant, 3+ in 30 days)
    const thirtyDaysAgo = subDays(now, 30);
    const recentByParticipant: Record<string, number> = {};
    complaints.filter(c => new Date(c.created_at) > thirtyDaysAgo && c.participant_id).forEach(c => {
      recentByParticipant[c.participant_id!] = (recentByParticipant[c.participant_id!] || 0) + 1;
    });
    const repeatedPatterns = Object.values(recentByParticipant).filter(v => v >= 3).length;

    return { open, resolved, pendingAck, overdueAck, stale, avgResolutionDays, categories, repeatedPatterns, total: complaints.length };
  }, [complaints]);

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { count } = await supabase.from("complaints").select("id", { count: "exact", head: true });
      const num = `CMP-${String((count ?? 0) + 1).padStart(4, "0")}`;
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
      toast({ title: "Complaint logged successfully" });
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

      // Client-side pre-checks
      const errors: string[] = [];
      if (nextStatus === "under_review" || nextStatus === "investigating") {
        const handler = editFields.assigned_handler ?? selected.assigned_handler;
        if (!handler) errors.push("A handler must be assigned before investigation");
      }
      if (nextStatus === "closed") {
        const ra = editFields.resolution_actions ?? selected.resolution_actions;
        const oc = editFields.outcome_communicated_date ?? selected.outcome_communicated_date;
        if (!ra) errors.push("Resolution actions are required");
        if (!oc) errors.push("Outcome communicated date is required");
      }
      if (errors.length > 0) {
        setClosureErrors(errors);
        throw new Error("Advancement criteria not met");
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
        action: "status_advanced", module: "complaints", record_id: selected.id,
        details: { from: selected.status, to: nextStatus },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      queryClient.invalidateQueries({ queryKey: ["complaint-workflow", selected?.id] });
      setEditFields({});
      setSelected((prev: any) => prev ? { ...prev, status: STATUS_FLOW[prev.status], ...editFields } : null);
      toast({ title: "Status advanced" });
    },
    onError: (err: any) => {
      if (err.message !== "Advancement criteria not met") {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  // ── Helpers ──

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));
  const setEdit = (key: string, val: any) => setEditFields(prev => ({ ...prev, [key]: val }));
  const getField = (key: string) => editFields[key] ?? selected?.[key] ?? "";

  const nextStatus = selected ? STATUS_FLOW[selected.status] : null;
  const canAdvance = nextStatus && user && STATUS_ROLE_GATE[nextStatus]?.includes(user.role);
  const isEditable = selected?.status !== "closed";
  const isSafeguardingCategory = selected?.complaint_category === "safeguarding";

  const getAckStatus = (c: any) => {
    if (c.acknowledgement_date) return "ack";
    const hours = differenceInHours(new Date(), new Date(c.created_at));
    return hours > 48 ? "overdue" : "pending";
  };

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Complaints Management</h1>
          <p className="text-muted-foreground">NDIS-compliant complaint tracking, investigation, and resolution</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Log Complaint</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Log Complaint</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2"><Label>Subject *</Label><Input value={form.subject} onChange={e => set("subject", e.target.value)} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={form.complaint_source} onValueChange={v => set("complaint_source", v)}>
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
                  <Select value={form.submission_channel} onValueChange={v => set("submission_channel", v)}>
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
                  <Select value={form.complaint_category} onValueChange={v => set("complaint_category", v)}>
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
                  <Select value={form.priority} onValueChange={v => set("priority", v)}>
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
                <Switch checked={form.anonymous} onCheckedChange={v => set("anonymous", v)} />
              </div>
              {!form.anonymous && (
                <div className="space-y-2"><Label>Complainant Name</Label><Input value={form.complainant_name} onChange={e => set("complainant_name", e.target.value)} /></div>
              )}
              <div className="space-y-2"><Label>Description *</Label><Textarea value={form.description} onChange={e => set("description", e.target.value)} required rows={3} /></div>
              <div className="space-y-2"><Label>Requested Outcome</Label><Textarea value={form.requested_outcome} onChange={e => set("requested_outcome", e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Immediate Risk?</Label>
                  <Switch checked={form.immediate_risk_identified} onCheckedChange={v => set("immediate_risk_identified", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Escalation Required?</Label>
                  <Switch checked={form.escalation_required} onCheckedChange={v => set("escalation_required", v)} />
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

      {/* Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open</CardTitle><MessageSquareWarning className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.open}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pending Ack</CardTitle><Clock className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.pendingAck}</div>{stats.overdueAck > 0 && <p className="text-xs text-destructive font-medium">{stats.overdueAck} overdue (&gt;48h)</p>}</CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Stale (&gt;7d)</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.stale}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Resolved</CardTitle><CheckCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.resolved}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Avg Resolution</CardTitle><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.avgResolutionDays}d</div></CardContent></Card>
      </section>

      {/* Tabs */}
      <Tabs defaultValue="register" className="space-y-4">
        <TabsList>
          <TabsTrigger value="register"><FileText className="h-4 w-4 mr-1" />Register</TabsTrigger>
          <TabsTrigger value="reporting"><BarChart3 className="h-4 w-4 mr-1" />Reporting</TabsTrigger>
          <TabsTrigger value="audit"><Shield className="h-4 w-4 mr-1" />Audit Trail</TabsTrigger>
        </TabsList>

        {/* ── Register Tab ── */}
        <TabsContent value="register" className="space-y-4">
          {/* Pipeline */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-1 overflow-x-auto">
                {PIPELINE_STEPS.map((step, i) => {
                  const count = complaints.filter(c => c.status === step).length;
                  return (
                    <div key={step} className="flex items-center">
                      <button
                        onClick={() => setFilterStatus(filterStatus === step ? "all" : step)}
                        className={`flex flex-col items-center px-3 py-2 rounded-lg text-xs transition-colors min-w-[80px] ${filterStatus === step ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        <span className="font-bold text-lg">{count}</span>
                        <span className="capitalize whitespace-nowrap">{STATUS_LABELS[step]}</span>
                      </button>
                      {i < PIPELINE_STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {stats.overdueAck > 0 && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">{stats.overdueAck} complaint(s) have exceeded the 48-hour acknowledgement deadline</p>
                <p className="text-xs text-muted-foreground">NDIS Practice Standards require timely acknowledgement of all complaints.</p>
              </div>
            </div>
          )}

          {stats.repeatedPatterns > 0 && (
            <div className="rounded-md bg-warning/10 border border-warning/30 p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning">{stats.repeatedPatterns} participant(s) with 3+ complaints in 30 days</p>
                <p className="text-xs text-muted-foreground">Repeated complaint pattern detected — consider escalation or investigation.</p>
              </div>
            </div>
          )}

          {/* Search & Filter */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search complaints..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            {filterStatus !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setFilterStatus("all")}>Clear filter</Button>
            )}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : filteredComplaints.length === 0 ? <p className="text-center py-8 text-muted-foreground">No complaints found</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Handler</TableHead>
                        <TableHead>Ack</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredComplaints.map(c => {
                        const ackStatus = getAckStatus(c);
                        const handlerName = orgStaff.find(s => s.id === c.assigned_handler)?.full_name;
                        return (
                          <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelected(c); setSheetOpen(true); setEditFields({}); setClosureErrors([]); }}>
                            <TableCell className="font-mono text-xs">{c.complaint_number}</TableCell>
                            <TableCell className="font-medium max-w-[160px] truncate">{c.subject}</TableCell>
                            <TableCell className="text-sm capitalize">{(c.complaint_source ?? "—").replace(/_/g, " ")}</TableCell>
                            <TableCell className="text-sm capitalize">{(c.complaint_category ?? "—").replace(/_/g, " ")}</TableCell>
                            <TableCell><Badge variant={c.priority === "high" ? "destructive" : "outline"} className="capitalize">{c.priority}</Badge></TableCell>
                            <TableCell className="text-sm">{handlerName ?? <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                            <TableCell>
                              {ackStatus === "ack" && <Badge className="bg-success text-success-foreground text-xs">✓</Badge>}
                              {ackStatus === "overdue" && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                              {ackStatus === "pending" && <Badge variant="outline" className="text-xs">Pending</Badge>}
                            </TableCell>
                            <TableCell><Badge className={`${statusColors[c.status] ?? ""} capitalize text-xs`}>{STATUS_LABELS[c.status]}</Badge></TableCell>
                            <TableCell className="text-muted-foreground text-xs">{format(new Date(c.created_at), "PP")}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Reporting Tab ── */}
        <TabsContent value="reporting" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Category Breakdown */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-sm">Complaints by Category</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(stats.categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <Progress value={stats.total > 0 ? (count / stats.total) * 100 : 0} className="h-2" />
                  </div>
                ))}
                {Object.keys(stats.categories).length === 0 && <p className="text-sm text-muted-foreground">No data yet</p>}
              </CardContent>
            </Card>

            {/* Resolution Metrics */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Resolution Metrics</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Average Resolution Time</p>
                  <p className="text-2xl font-bold">{stats.avgResolutionDays} days</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Total Complaints</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Resolution Rate</p>
                  <p className="text-2xl font-bold">{stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Repeated Patterns</p>
                  <p className="text-2xl font-bold">{stats.repeatedPatterns}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overdue Complaints */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Overdue & Stale Complaints</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const now = new Date();
                const overdueList = complaints.filter(c => {
                  if (["resolved", "closed"].includes(c.status)) return false;
                  const ackOverdue = c.status === "submitted" && differenceInHours(now, new Date(c.created_at)) > 48;
                  const stale = differenceInDays(now, new Date(c.updated_at)) > 7;
                  return ackOverdue || stale;
                });
                if (overdueList.length === 0) return <p className="text-sm text-muted-foreground">No overdue complaints — all within compliance thresholds.</p>;
                return (
                  <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead>Issue</TableHead><TableHead>Days Open</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {overdueList.map(c => {
                        const daysOpen = differenceInDays(now, new Date(c.created_at));
                        const isAckOverdue = c.status === "submitted" && differenceInHours(now, new Date(c.created_at)) > 48;
                        return (
                          <TableRow key={c.id} className="cursor-pointer" onClick={() => { setSelected(c); setSheetOpen(true); setEditFields({}); }}>
                            <TableCell className="font-mono text-xs">{c.complaint_number}</TableCell>
                            <TableCell className="text-sm">{c.subject}</TableCell>
                            <TableCell><Badge className={`${statusColors[c.status]} capitalize text-xs`}>{STATUS_LABELS[c.status]}</Badge></TableCell>
                            <TableCell><Badge variant="destructive" className="text-xs">{isAckOverdue ? "Ack Overdue" : "Stale"}</Badge></TableCell>
                            <TableCell className="text-sm font-medium">{daysOpen}d</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Audit Trail Tab ── */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Complaint Audit Log (append-only)</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? <p className="text-sm text-muted-foreground">No audit entries yet</p> : (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>Severity</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {auditLogs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs whitespace-nowrap">{format(new Date(log.created_at), "PPp")}</TableCell>
                          <TableCell className="text-sm">{log.user_name ?? "System"}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs capitalize">{log.action.replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{log.record_id ? log.record_id.slice(0, 8) : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={log.severity === "elevated" || log.severity === "critical" ? "destructive" : "outline"} className="text-xs capitalize">
                              {log.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{log.details ? JSON.stringify(log.details).slice(0, 80) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Detail Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="font-mono text-sm">{selected.complaint_number}</span>
                  <Badge className={`${statusColors[selected.status] ?? ""} capitalize`}>{STATUS_LABELS[selected.status]}</Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <h3 className="font-semibold">{selected.subject}</h3>

                {/* Safeguarding crossover */}
                {isSafeguardingCategory && (
                  <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
                    <p className="text-sm font-medium flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" /> Safeguarding-related — consider creating a safeguarding concern</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => window.open(`/safeguarding?linked_complaint=${selected.id}`, "_self")}>Create Safeguarding Concern</Button>
                  </div>
                )}

                {/* Workflow Progress */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Workflow Progress</p>
                  <div className="flex gap-1">
                    {PIPELINE_STEPS.map(step => {
                      const currentIdx = PIPELINE_STEPS.indexOf(selected.status);
                      const stepIdx = PIPELINE_STEPS.indexOf(step);
                      return (
                        <div key={step} className={`h-2 flex-1 rounded-full ${stepIdx <= currentIdx ? "bg-primary" : "bg-muted"}`} title={STATUS_LABELS[step]} />
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Step {PIPELINE_STEPS.indexOf(selected.status) + 1} of {PIPELINE_STEPS.length}</p>
                </div>

                {/* Key Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm capitalize">{(selected.complaint_source ?? "—").replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Channel</p><p className="text-sm capitalize">{(selected.submission_channel ?? "—").replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Category</p><p className="text-sm capitalize">{(selected.complaint_category ?? "—").replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Priority</p><Badge variant={selected.priority === "high" ? "destructive" : "outline"} className="capitalize">{selected.priority}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Anonymous</p><p className="text-sm">{selected.anonymous ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Complainant</p><p className="text-sm">{selected.complainant_name ?? selected.submitted_by_name ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Immediate Risk</p><p className="text-sm">{selected.immediate_risk_identified ? "⚠️ Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Escalation</p><p className="text-sm">{selected.escalation_required ? "⚠️ Yes" : "No"}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Acknowledgement</p>
                    <p className="text-sm">{selected.acknowledgement_date ? format(new Date(selected.acknowledgement_date), "PPp") : (() => {
                      const hours = differenceInHours(new Date(), new Date(selected.created_at));
                      return hours > 48 ? <span className="text-destructive font-medium">⚠️ OVERDUE ({hours}h)</span> : <span>Pending ({hours}h elapsed)</span>;
                    })()}</p>
                  </div>
                </div>

                <Separator />
                <div><p className="text-xs text-muted-foreground">Description</p><p className="text-sm whitespace-pre-wrap">{selected.description ?? "—"}</p></div>
                {selected.requested_outcome && <div><p className="text-xs text-muted-foreground">Requested Outcome</p><p className="text-sm whitespace-pre-wrap">{selected.requested_outcome}</p></div>}

                {/* Handler Assignment */}
                <Separator />
                <h4 className="text-sm font-semibold flex items-center gap-2"><UserCheck className="h-4 w-4" /> Handler Assignment</h4>
                {isEditable ? (
                  <div className="space-y-2">
                    <Select
                      value={getField("assigned_handler") || "unassigned"}
                      onValueChange={v => {
                        const val = v === "unassigned" ? null : v;
                        setEdit("assigned_handler", val);
                        saveMutation.mutate({ assigned_handler: val });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select handler" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">— Unassigned —</SelectItem>
                        {orgStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!getField("assigned_handler") && selected.status === "acknowledged" && (
                      <p className="text-xs text-warning">⚠️ Handler must be assigned before advancing to Under Review</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm">{orgStaff.find(s => s.id === selected.assigned_handler)?.full_name ?? "Unassigned"}</p>
                )}

                {/* Investigation & Resolution */}
                <Separator />
                <h4 className="text-sm font-semibold">Investigation & Resolution</h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Investigation Summary</Label>
                    {isEditable ? (
                      <Textarea value={getField("investigation_summary")} onChange={e => setEdit("investigation_summary", e.target.value)} onBlur={() => editFields.investigation_summary !== undefined && saveMutation.mutate({ investigation_summary: editFields.investigation_summary })} rows={2} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{selected.investigation_summary ?? "—"}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Resolution Actions {selected.status === "resolved" || nextStatus === "closed" ? "*" : ""}</Label>
                    {isEditable ? (
                      <Textarea value={getField("resolution_actions")} onChange={e => setEdit("resolution_actions", e.target.value)} onBlur={() => editFields.resolution_actions !== undefined && saveMutation.mutate({ resolution_actions: editFields.resolution_actions })} rows={2} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{selected.resolution_actions ?? "—"}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Final Outcome</Label>
                    {isEditable ? (
                      <Textarea value={getField("final_outcome")} onChange={e => setEdit("final_outcome", e.target.value)} onBlur={() => editFields.final_outcome !== undefined && saveMutation.mutate({ final_outcome: editFields.final_outcome })} rows={2} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{selected.final_outcome ?? "—"}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Outcome Communicated Date {nextStatus === "closed" ? "*" : ""}</Label>
                    {isEditable ? (
                      <Input type="date" value={getField("outcome_communicated_date") ? String(getField("outcome_communicated_date")).split("T")[0] : ""} onChange={e => setEdit("outcome_communicated_date", e.target.value ? new Date(e.target.value).toISOString() : null)} onBlur={() => editFields.outcome_communicated_date !== undefined && saveMutation.mutate({ outcome_communicated_date: editFields.outcome_communicated_date })} />
                    ) : (
                      <p className="text-sm">{selected.outcome_communicated_date ? format(new Date(selected.outcome_communicated_date), "PP") : "—"}</p>
                    )}
                  </div>
                </div>

                {/* Closure errors */}
                {closureErrors.length > 0 && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 space-y-1">
                    <p className="text-sm font-medium flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Cannot advance — criteria not met:</p>
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
                    {workflowHistory.map(h => (
                      <div key={h.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="capitalize text-xs">{STATUS_LABELS[h.from_status ?? "new"] ?? h.from_status ?? "new"}</Badge>
                        <span>→</span>
                        <Badge variant="outline" className="capitalize text-xs">{STATUS_LABELS[h.to_status] ?? h.to_status}</Badge>
                        <span className="text-muted-foreground text-xs">{format(new Date(h.created_at), "PPp")}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Advance button */}
                {nextStatus && (
                  <div className="pt-2">
                    <Button className="w-full" disabled={!canAdvance || advanceMutation.isPending} onClick={() => advanceMutation.mutate()}>
                      {canAdvance ? `Advance to ${STATUS_LABELS[nextStatus]}` : `Requires ${STATUS_ROLE_GATE[nextStatus]?.join(", ")} role`}
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
