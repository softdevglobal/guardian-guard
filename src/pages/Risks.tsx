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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Plus, ShieldAlert, AlertTriangle, Search, Clock, CheckCircle,
  XCircle, Link2, BarChart3, FileText, Activity, TrendingDown
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays, isPast } from "date-fns";
import { logAudit } from "@/lib/auditLog";
import { PhotoUpload } from "@/components/PhotoUpload";
import type { Tables } from "@/integrations/supabase/types";

type Risk = Tables<"risks">;
type Mitigation = Tables<"risk_mitigations">;

const RISK_CATEGORIES = [
  { value: "participant_safety", label: "Participant Safety" },
  { value: "workforce", label: "Workforce" },
  { value: "digital_platform", label: "Digital Platform" },
  { value: "privacy", label: "Privacy" },
  { value: "compliance", label: "Compliance" },
  { value: "operational", label: "Operational" },
  { value: "financial", label: "Financial" },
  { value: "reputational", label: "Reputational" },
];

const REVIEW_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const STATUS_FLOW: Record<string, string> = {
  open: "assessed",
  assessed: "mitigating",
  mitigating: "monitoring",
  monitoring: "closed",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  assessed: "Assessed",
  mitigating: "Mitigating",
  monitoring: "Monitoring",
  closed: "Closed",
};

const STATUS_ROLE_GATE: Record<string, string[]> = {
  assessed: ["super_admin", "compliance_officer", "supervisor"],
  mitigating: ["super_admin", "compliance_officer"],
  monitoring: ["super_admin", "compliance_officer"],
  closed: ["super_admin", "compliance_officer"],
};

const STATUSES = ["open", "assessed", "mitigating", "monitoring", "closed"];

function getRiskLevel(score: number) {
  if (score >= 16) return "Critical";
  if (score >= 10) return "High";
  if (score >= 5) return "Medium";
  return "Low";
}

function getRiskBadgeVariant(level: string) {
  if (level === "Critical" || level === "High") return "destructive" as const;
  if (level === "Medium") return "outline" as const;
  return "secondary" as const;
}

const INITIAL_FORM = {
  title: "", category: "operational", description: "",
  likelihood_score: 2, impact_score: 2,
  existing_controls: "", escalation_required: false,
  review_date: "", review_frequency: "quarterly",
  linked_participant_id: "", linked_staff_id: "",
  linked_incident_id: "", linked_complaint_id: "",
};

export default function Risks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("register");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selected, setSelected] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [closureErrors, setClosureErrors] = useState<string[]>([]);

  // Mitigation form
  const [mitigationDialogOpen, setMitigationDialogOpen] = useState(false);
  const [mitigationForm, setMitigationForm] = useState({ action: "", due_date: "", assigned_to: "" });

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ["risks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("risks").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allMitigations = [] } = useQuery({
    queryKey: ["risk-mitigations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("risk_mitigations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents-for-risks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incidents").select("id, incident_number, title, severity, status").eq("record_status", "active").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["risk-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*").eq("module", "risks").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: staffProfiles = [] } = useQuery({
    queryKey: ["staff-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_profiles").select("id, full_name, email");
      if (error) throw error;
      return data;
    },
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["participants-for-risks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("participants").select("id, first_name, last_name").eq("record_status", "active").limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Filtered risks
  const filtered = useMemo(() => {
    return risks.filter(r => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterLevel !== "all" && (r.risk_level ?? getRiskLevel(r.risk_score ?? 0)) !== filterLevel) return false;
      if (searchTerm && !r.title.toLowerCase().includes(searchTerm.toLowerCase()) && !(r.description ?? "").toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [risks, filterStatus, filterLevel, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const overdue = risks.filter(r => r.review_date && isPast(new Date(r.review_date)) && r.status !== "closed");
    const critical = risks.filter(r => (r.risk_level === "Critical" || r.risk_level === "High") && r.status !== "closed");
    const inactive = risks.filter(r => r.status !== "closed" && differenceInDays(new Date(), new Date(r.updated_at)) > 30);
    return {
      total: risks.length,
      open: risks.filter(r => r.status === "open").length,
      mitigating: risks.filter(r => r.status === "mitigating").length,
      monitoring: risks.filter(r => r.status === "monitoring").length,
      closed: risks.filter(r => r.status === "closed").length,
      overdue: overdue.length,
      critical: critical.length,
      inactive: inactive.length,
      overdueRisks: overdue,
      criticalRisks: critical,
      inactiveRisks: inactive,
    };
  }, [risks]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const score = form.likelihood_score * form.impact_score;
      const { error } = await supabase.from("risks").insert({
        title: form.title,
        category: form.category,
        description: form.description,
        likelihood: form.likelihood_score <= 2 ? "low" : form.likelihood_score <= 3 ? "medium" : "high",
        impact: form.impact_score <= 2 ? "low" : form.impact_score <= 3 ? "medium" : form.impact_score <= 4 ? "high" : "critical",
        likelihood_score: form.likelihood_score,
        impact_score: form.impact_score,
        risk_level: getRiskLevel(score),
        existing_controls: form.existing_controls || null,
        escalation_required: form.escalation_required || score >= 7,
        review_date: form.review_date || null,
        date_identified: new Date().toISOString().split("T")[0],
        linked_participant_id: form.linked_participant_id || null,
        linked_staff_id: form.linked_staff_id || null,
        linked_incident_id: form.linked_incident_id || null,
        linked_complaint_id: form.linked_complaint_id || null,
        created_by: user.id,
        organisation_id: user.organisation_id!,
      });
      if (error) throw error;
      await logAudit({ action: "created", module: "risks", details: { title: form.title, risk_score: score } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      queryClient.invalidateQueries({ queryKey: ["risk-audit-logs"] });
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      setPhotos([]);
      toast({ title: "Risk added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      if (!selected) return;
      const { error } = await supabase.from("risks").update(fields as any).eq("id", selected.id);
      if (error) throw error;
      await logAudit({ action: "field_updated", module: "risks", record_id: selected.id, details: fields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      queryClient.invalidateQueries({ queryKey: ["risk-audit-logs"] });
      toast({ title: "Saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addMitigationMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selected) throw new Error("Not authenticated");
      const { error } = await supabase.from("risk_mitigations").insert({
        risk_id: selected.id,
        action: mitigationForm.action,
        due_date: mitigationForm.due_date || null,
        assigned_to: mitigationForm.assigned_to || null,
        created_by: user.id,
      });
      if (error) throw error;
      await logAudit({ action: "mitigation_added", module: "risks", record_id: selected.id, details: { action: mitigationForm.action } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risk-mitigations"] });
      queryClient.invalidateQueries({ queryKey: ["risk-audit-logs"] });
      setMitigationDialogOpen(false);
      setMitigationForm({ action: "", due_date: "", assigned_to: "" });
      toast({ title: "Mitigation action added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const completeMitigationMutation = useMutation({
    mutationFn: async (mitigationId: string) => {
      const { error } = await supabase.from("risk_mitigations").update({ status: "completed", completed_at: new Date().toISOString() } as any).eq("id", mitigationId);
      if (error) throw error;
      await logAudit({ action: "mitigation_completed", module: "risks", record_id: selected?.id, details: { mitigation_id: mitigationId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risk-mitigations"] });
      queryClient.invalidateQueries({ queryKey: ["risk-audit-logs"] });
      toast({ title: "Mitigation completed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const advanceMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !user) return;
      const nextStatus = STATUS_FLOW[selected.status];
      if (!nextStatus) throw new Error("No next status");
      setClosureErrors([]);

      if (nextStatus === "closed") {
        const errors: string[] = [];
        const desc = editFields.description ?? selected.description;
        const controls = editFields.existing_controls ?? selected.existing_controls;
        if (!desc || !desc.trim()) errors.push("Description is required");
        if (!controls || !controls.trim()) errors.push("Existing controls must be documented");
        if (!selected.review_date && !editFields.review_date) errors.push("Review date must be set");
        // Mitigation check is also enforced by DB trigger
        const riskMitigations = allMitigations.filter(m => m.risk_id === selected.id);
        if (riskMitigations.length === 0) errors.push("At least one mitigation action required");
        const pending = riskMitigations.filter(m => m.status !== "completed" && m.status !== "cancelled");
        if (pending.length > 0) errors.push(`${pending.length} mitigation action(s) still pending`);
        if (errors.length > 0) {
          setClosureErrors(errors);
          throw new Error("Closure criteria not met");
        }
      }

      const updatePayload: any = { status: nextStatus, ...editFields };
      const { error } = await supabase.from("risks").update(updatePayload).eq("id", selected.id);
      if (error) throw error;

      await logAudit({ action: "status_advanced", module: "risks", record_id: selected.id, details: { from: selected.status, to: nextStatus } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      queryClient.invalidateQueries({ queryKey: ["risk-audit-logs"] });
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
  const riskScore = form.likelihood_score * form.impact_score;

  const nextStatus = selected ? STATUS_FLOW[selected.status] : null;
  const canAdvance = nextStatus && user && STATUS_ROLE_GATE[nextStatus]?.includes(user.role);
  const isEditable = selected?.status !== "closed";
  const selectedMitigations = allMitigations.filter(m => m.risk_id === selected?.id);

  const getStaffName = (id: string | null) => {
    if (!id) return "—";
    const p = staffProfiles.find(s => s.id === id);
    return p?.full_name ?? id.slice(0, 8) + "...";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk Register</h1>
          <p className="text-muted-foreground">NDIS-compliant risk identification, assessment, and mitigation</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Risk</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Risk</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} required /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RISK_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Likelihood (1-5): {form.likelihood_score}</Label>
                  <Input type="range" min={1} max={5} value={form.likelihood_score} onChange={(e) => set("likelihood_score", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Impact (1-5): {form.impact_score}</Label>
                  <Input type="range" min={1} max={5} value={form.impact_score} onChange={(e) => set("impact_score", Number(e.target.value))} />
                </div>
              </div>
              <div className="rounded-md bg-muted p-3 text-center">
                <p className="text-sm">Risk Score: <strong>{riskScore}</strong> — <Badge variant={getRiskBadgeVariant(getRiskLevel(riskScore))}>{getRiskLevel(riskScore)}</Badge></p>
              </div>
              {riskScore >= 7 && (
                <div className="rounded-md bg-warning/10 border border-warning/30 p-2">
                  <p className="text-xs font-medium flex items-center gap-1 text-warning">
                    <AlertTriangle className="h-3 w-3" /> High risk score — escalation auto-enabled, review date within 7 days required
                  </p>
                </div>
              )}
              <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
              <div className="space-y-2"><Label>Existing Controls</Label><Textarea value={form.existing_controls} onChange={(e) => set("existing_controls", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Review Date</Label><Input type="date" value={form.review_date} onChange={(e) => set("review_date", e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Review Frequency</Label>
                  <Select value={form.review_frequency} onValueChange={(v) => set("review_frequency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{REVIEW_FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Escalation Required?</Label>
                <Switch checked={form.escalation_required || riskScore >= 7} onCheckedChange={(v) => set("escalation_required", v)} />
              </div>

              {/* Linked Records */}
              <Separator />
              <h4 className="text-sm font-semibold">Link Records (optional)</h4>
              <div className="space-y-2">
                <Label className="text-xs">Linked Incident</Label>
                <Select value={form.linked_incident_id} onValueChange={(v) => set("linked_incident_id", v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {incidents.map(i => <SelectItem key={i.id} value={i.id}>{i.incident_number} — {i.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Linked Participant</Label>
                <Select value={form.linked_participant_id} onValueChange={(v) => set("linked_participant_id", v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {participants.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Risk Owner</Label>
                <Select value={form.linked_staff_id} onValueChange={(v) => set("linked_staff_id", v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {staffProfiles.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {user && (
                <div className="space-y-2">
                  <Label>Photos & Evidence</Label>
                  <PhotoUpload folder="risks" userId={user.id} photos={photos} onPhotosChange={setPhotos} />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Add Risk"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        {/* REGISTER TAB */}
        <TabsContent value="register" className="space-y-4 mt-4">
          {/* Dashboard Cards */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
            <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">Total Risks</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold">{stats.open}</div><p className="text-xs text-muted-foreground">Open</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold">{stats.mitigating}</div><p className="text-xs text-muted-foreground">Mitigating</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold">{stats.closed}</div><p className="text-xs text-muted-foreground">Closed</p></CardContent></Card>
            <Card className={stats.critical > 0 ? "border-destructive/50" : ""}><CardContent className="pt-6 text-center"><div className={`text-2xl font-bold ${stats.critical > 0 ? "text-destructive" : ""}`}>{stats.critical}</div><p className="text-xs text-muted-foreground">High/Critical</p></CardContent></Card>
            <Card className={stats.overdue > 0 ? "border-warning/50" : ""}><CardContent className="pt-6 text-center"><div className={`text-2xl font-bold ${stats.overdue > 0 ? "text-warning" : ""}`}>{stats.overdue}</div><p className="text-xs text-muted-foreground">Overdue Review</p></CardContent></Card>
          </div>

          {/* Alerts */}
          {(stats.overdue > 0 || stats.inactive > 0) && (
            <div className="space-y-2">
              {stats.overdue > 0 && (
                <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
                  <p className="text-sm font-medium flex items-center gap-2 text-warning"><Clock className="h-4 w-4" /> {stats.overdue} risk(s) have overdue reviews</p>
                  <div className="mt-1 space-y-0.5">
                    {stats.overdueRisks.slice(0, 5).map(r => (
                      <p key={r.id} className="text-xs text-muted-foreground">• {r.title} — review was {r.review_date ? format(new Date(r.review_date), "PP") : "not set"}</p>
                    ))}
                  </div>
                </div>
              )}
              {stats.inactive > 0 && (
                <div className="rounded-md bg-muted border p-3">
                  <p className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4" /> {stats.inactive} risk(s) have had no updates in 30+ days</p>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search risks..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {["Critical", "High", "Medium", "Low"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Risk Table */}
          <Card>
            <CardContent className="pt-4">
              {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : filtered.length === 0 ? <p className="text-center py-4 text-muted-foreground">No risks found</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Review</TableHead>
                        <TableHead>Mitigations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => {
                        const score = r.risk_score ?? 0;
                        const level = r.risk_level ?? getRiskLevel(score);
                        const mits = allMitigations.filter(m => m.risk_id === r.id);
                        const completedMits = mits.filter(m => m.status === "completed").length;
                        const isOverdue = r.review_date && isPast(new Date(r.review_date)) && r.status !== "closed";
                        return (
                          <TableRow key={r.id} className={`cursor-pointer hover:bg-muted/50 ${isOverdue ? "bg-warning/5" : ""}`} onClick={() => { setSelected(r); setSheetOpen(true); setEditFields({}); setClosureErrors([]); }}>
                            <TableCell className="font-medium">{r.title}</TableCell>
                            <TableCell className="capitalize text-sm">{r.category.replace(/_/g, " ")}</TableCell>
                            <TableCell className="font-mono">{score}</TableCell>
                            <TableCell><Badge variant={getRiskBadgeVariant(level)}>{level}</Badge></TableCell>
                            <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                            <TableCell className="text-sm">{getStaffName(r.assigned_to ?? r.linked_staff_id)}</TableCell>
                            <TableCell className="text-sm">
                              {r.review_date ? (
                                <span className={isOverdue ? "text-warning font-medium" : "text-muted-foreground"}>
                                  {isOverdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                                  {format(new Date(r.review_date), "PP")}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              {mits.length > 0 ? (
                                <span className="text-xs">{completedMits}/{mits.length}</span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
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

        {/* REPORTING TAB */}
        <TabsContent value="reporting" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* High/Critical Summary */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" />High & Critical Risks</CardTitle></CardHeader>
              <CardContent>
                {stats.criticalRisks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No high/critical active risks</p>
                ) : (
                  <div className="space-y-2">
                    {stats.criticalRisks.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded bg-destructive/5 border border-destructive/20 cursor-pointer" onClick={() => { setSelected(r); setSheetOpen(true); setEditFields({}); }}>
                        <div>
                          <span className="font-medium">{r.title}</span>
                          <span className="text-muted-foreground ml-2 text-xs">Score: {r.risk_score}</span>
                        </div>
                        <Badge variant="destructive" className="text-xs">{r.risk_level}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Overdue Reviews */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-warning" />Overdue Reviews</CardTitle></CardHeader>
              <CardContent>
                {stats.overdueRisks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">All reviews up to date</p>
                ) : (
                  <div className="space-y-2">
                    {stats.overdueRisks.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded bg-warning/5 border border-warning/20 cursor-pointer" onClick={() => { setSelected(r); setSheetOpen(true); setEditFields({}); }}>
                        <span className="font-medium">{r.title}</span>
                        <Badge variant="outline" className="text-xs text-warning">{r.review_date ? differenceInDays(new Date(), new Date(r.review_date)) + "d overdue" : "No date"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Compliance Summary */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Risk Compliance Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span>Total active risks</span><span className="font-bold">{stats.total - stats.closed}</span></div>
              <div className="flex justify-between text-sm"><span>Risks with mitigations</span><span className="font-bold">{new Set(allMitigations.map(m => m.risk_id)).size}</span></div>
              <div className="flex justify-between text-sm"><span>Completed mitigations</span><span className="font-bold">{allMitigations.filter(m => m.status === "completed").length}</span></div>
              <div className="flex justify-between text-sm"><span>Pending mitigations</span><span className="font-bold text-warning">{allMitigations.filter(m => m.status === "pending").length}</span></div>
              <Separator />
              <div className="flex justify-between text-sm"><span>Overdue reviews</span><span className="font-bold text-destructive">{stats.overdue}</span></div>
              <div className="flex justify-between text-sm"><span>Inactive (&gt;30d no updates)</span><span className="font-bold text-warning">{stats.inactive}</span></div>
              <Separator />
              {/* Status breakdown bar */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status Distribution</p>
                <div className="flex h-3 rounded-full overflow-hidden">
                  {stats.total > 0 && (
                    <>
                      {stats.open > 0 && <div className="bg-destructive" style={{ width: `${(stats.open / stats.total) * 100}%` }} title={`Open: ${stats.open}`} />}
                      {risks.filter(r => r.status === "assessed").length > 0 && <div className="bg-warning" style={{ width: `${(risks.filter(r => r.status === "assessed").length / stats.total) * 100}%` }} title="Assessed" />}
                      {stats.mitigating > 0 && <div className="bg-primary" style={{ width: `${(stats.mitigating / stats.total) * 100}%` }} title={`Mitigating: ${stats.mitigating}`} />}
                      {stats.monitoring > 0 && <div className="bg-primary/60" style={{ width: `${(stats.monitoring / stats.total) * 100}%` }} title={`Monitoring: ${stats.monitoring}`} />}
                      {stats.closed > 0 && <div className="bg-muted-foreground/30" style={{ width: `${(stats.closed / stats.total) * 100}%` }} title={`Closed: ${stats.closed}`} />}
                    </>
                  )}
                </div>
                <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" />Open</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" />Assessed</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Mitigating</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/60 inline-block" />Monitoring</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />Closed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Linked Incidents */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4" />Incident-Linked Risks</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const linked = risks.filter(r => r.linked_incident_id);
                return linked.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No risks linked to incidents</p>
                ) : (
                  <div className="space-y-2">
                    {linked.map(r => {
                      const inc = incidents.find(i => i.id === r.linked_incident_id);
                      return (
                        <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50 border">
                          <div>
                            <span className="font-medium">{r.title}</span>
                            {inc && <span className="text-muted-foreground ml-2 text-xs">← {inc.incident_number}: {inc.title}</span>}
                          </div>
                          <Badge variant={getRiskBadgeVariant(r.risk_level ?? "")} className="text-xs">{r.risk_level}</Badge>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT TRAIL TAB */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Risk Audit Trail</CardTitle></CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No audit events recorded</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(log.created_at), "PP p")}</TableCell>
                          <TableCell className="text-sm">{log.user_name ?? "System"}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize text-xs">{(log.action ?? "").replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={log.severity === "elevated" || log.severity === "critical" ? "destructive" : "secondary"} className="text-xs">{log.severity}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {log.details ? JSON.stringify(log.details).slice(0, 80) : "—"}
                          </TableCell>
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

      {/* Risk Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  {selected.title}
                  <Badge variant={getRiskBadgeVariant(selected.risk_level ?? "")}>{selected.risk_level ?? "—"}</Badge>
                  <Badge variant="secondary" className="capitalize">{selected.status}</Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {/* Workflow Progress */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Workflow Progress</p>
                  <div className="flex gap-1">
                    {STATUSES.map((s, i) => (
                      <div key={s} className={`flex-1 h-2 rounded-full ${STATUSES.indexOf(selected.status) >= i ? "bg-primary" : "bg-muted"}`} title={STATUS_LABELS[s]} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    {STATUSES.map(s => <span key={s} className={selected.status === s ? "font-bold text-foreground" : ""}>{STATUS_LABELS[s]}</span>)}
                  </div>
                </div>

                {/* Alerts */}
                {(selected.risk_score ?? 0) >= 10 && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2">
                    <p className="text-xs font-medium flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" /> High/Critical risk — compliance review mandatory
                    </p>
                  </div>
                )}
                {selected.review_date && isPast(new Date(selected.review_date)) && selected.status !== "closed" && (
                  <div className="rounded-md bg-warning/10 border border-warning/30 p-2">
                    <p className="text-xs font-medium flex items-center gap-1 text-warning">
                      <Clock className="h-3 w-3" /> Review overdue by {differenceInDays(new Date(), new Date(selected.review_date))} days
                    </p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Category</p><p className="text-sm capitalize">{selected.category.replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Risk Score</p><p className="text-sm font-mono font-bold">{selected.risk_score ?? 0}</p></div>
                  <div><p className="text-xs text-muted-foreground">Likelihood</p><p className="text-sm">{selected.likelihood_score ?? selected.likelihood}</p></div>
                  <div><p className="text-xs text-muted-foreground">Impact</p><p className="text-sm">{selected.impact_score ?? selected.impact}</p></div>
                  <div><p className="text-xs text-muted-foreground">Escalation Required</p><p className="text-sm">{selected.escalation_required ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Review Date</p><p className="text-sm">{selected.review_date ? format(new Date(selected.review_date), "PP") : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Owner</p><p className="text-sm">{getStaffName(selected.assigned_to ?? selected.linked_staff_id)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Identified</p><p className="text-sm">{selected.date_identified ? format(new Date(selected.date_identified), "PP") : "—"}</p></div>
                </div>

                {/* Linked records */}
                {(selected.linked_participant_id || selected.linked_staff_id || selected.linked_incident_id || selected.linked_complaint_id) && (
                  <>
                    <Separator />
                    <h4 className="text-sm font-semibold flex items-center gap-1"><Link2 className="h-3 w-3" />Linked Records</h4>
                    <div className="space-y-1 text-sm">
                      {selected.linked_incident_id && (() => {
                        const inc = incidents.find(i => i.id === selected.linked_incident_id);
                        return <p>Incident: <span className="font-medium">{inc ? `${inc.incident_number} — ${inc.title}` : selected.linked_incident_id.slice(0, 8)}</span></p>;
                      })()}
                      {selected.linked_participant_id && (() => {
                        const p = participants.find(pp => pp.id === selected.linked_participant_id);
                        return <p>Participant: <span className="font-medium">{p ? `${p.first_name} ${p.last_name}` : selected.linked_participant_id.slice(0, 8)}</span></p>;
                      })()}
                      {selected.linked_staff_id && <p>Staff: <span className="font-medium">{getStaffName(selected.linked_staff_id)}</span></p>}
                      {selected.linked_complaint_id && <p>Complaint: <span className="font-mono text-xs">{selected.linked_complaint_id.slice(0, 8)}...</span></p>}
                    </div>
                  </>
                )}

                <Separator />
                <div><p className="text-xs text-muted-foreground">Description</p><p className="text-sm whitespace-pre-wrap">{selected.description ?? "—"}</p></div>
                {selected.existing_controls && (
                  <div><p className="text-xs text-muted-foreground">Existing Controls</p><p className="text-sm whitespace-pre-wrap">{selected.existing_controls}</p></div>
                )}

                {/* Editable Fields */}
                {isEditable && (
                  <>
                    <Separator />
                    <h4 className="text-sm font-semibold">Risk Management</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Review Date</Label>
                          <Input type="date" value={getField("review_date") ?? ""} onChange={e => setEdit("review_date", e.target.value || null)} onBlur={() => editFields.review_date !== undefined && saveMutation.mutate({ review_date: editFields.review_date })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Owner</Label>
                          <Select value={getField("assigned_to") || ""} onValueChange={v => { setEdit("assigned_to", v || null); saveMutation.mutate({ assigned_to: v || null }); }}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Assign..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Unassigned</SelectItem>
                              {staffProfiles.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Existing Controls</Label>
                        <Textarea value={getField("existing_controls")} onChange={e => setEdit("existing_controls", e.target.value)} onBlur={() => editFields.existing_controls !== undefined && saveMutation.mutate({ existing_controls: editFields.existing_controls })} rows={2} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea value={getField("description")} onChange={e => setEdit("description", e.target.value)} onBlur={() => editFields.description !== undefined && saveMutation.mutate({ description: editFields.description })} rows={2} />
                      </div>
                    </div>
                  </>
                )}

                {/* Mitigation Actions */}
                <Separator />
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Mitigation Actions</h4>
                  {isEditable && (
                    <Dialog open={mitigationDialogOpen} onOpenChange={setMitigationDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Add</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Add Mitigation Action</DialogTitle></DialogHeader>
                        <form className="space-y-4" onSubmit={e => { e.preventDefault(); addMitigationMutation.mutate(); }}>
                          <div className="space-y-2"><Label>Action Description *</Label><Textarea value={mitigationForm.action} onChange={e => setMitigationForm(f => ({ ...f, action: e.target.value }))} required /></div>
                          <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={mitigationForm.due_date} onChange={e => setMitigationForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                          <div className="space-y-2">
                            <Label>Assigned To</Label>
                            <Select value={mitigationForm.assigned_to} onValueChange={v => setMitigationForm(f => ({ ...f, assigned_to: v }))}>
                              <SelectTrigger><SelectValue placeholder="Select owner..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Unassigned</SelectItem>
                                {staffProfiles.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="submit" className="w-full" disabled={addMitigationMutation.isPending}>
                            {addMitigationMutation.isPending ? "Adding..." : "Add Mitigation"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {selectedMitigations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No mitigation actions recorded</p>
                ) : (
                  <div className="space-y-2">
                    {selectedMitigations.map(m => {
                      const isOverdueMit = m.due_date && isPast(new Date(m.due_date)) && m.status !== "completed" && m.status !== "cancelled";
                      return (
                        <div key={m.id} className={`p-3 rounded-lg border space-y-1 ${isOverdueMit ? "border-warning/50 bg-warning/5" : m.status === "completed" ? "border-muted bg-muted/30" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm">{m.action}</p>
                            <Badge variant={m.status === "completed" ? "secondary" : m.status === "cancelled" ? "outline" : "default"} className="text-xs capitalize shrink-0">{m.status}</Badge>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {m.assigned_to && <span>Owner: {getStaffName(m.assigned_to)}</span>}
                            {m.due_date && (
                              <span className={isOverdueMit ? "text-warning font-medium" : ""}>
                                {isOverdueMit && <AlertTriangle className="h-3 w-3 inline mr-0.5" />}
                                Due: {format(new Date(m.due_date), "PP")}
                              </span>
                            )}
                            {m.completed_at && <span className="text-muted-foreground">Completed: {format(new Date(m.completed_at), "PP")}</span>}
                          </div>
                          {m.status === "pending" && isEditable && (
                            <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={() => completeMitigationMutation.mutate(m.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" />Mark Complete
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Closure Validation Errors */}
                {closureErrors.length > 0 && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 space-y-1">
                    <p className="text-sm font-medium flex items-center gap-2 text-destructive">
                      <XCircle className="h-3 w-3" /> Cannot close — criteria not met:
                    </p>
                    <ul className="text-xs text-destructive space-y-0.5 list-disc list-inside">
                      {closureErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
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
