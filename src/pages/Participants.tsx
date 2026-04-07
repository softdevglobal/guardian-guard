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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { format, differenceInDays } from "date-fns";
import {
  Plus, Eye, EyeOff, Shield, Search, AlertTriangle, TrendingDown,
  TrendingUp, FileText, Upload, CheckCircle, XCircle, Clock, User,
  Lock, Unlock, BarChart3, Activity, Download
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { ParticipantTimeline } from "@/components/compliance/ParticipantTimeline";
import { ComplianceChainView } from "@/components/compliance/ComplianceChainView";
import { LinkedRecords } from "@/components/compliance/LinkedRecords";
import { fetchParticipantEvidenceChain, exportEvidenceChainCSV, downloadCSV } from "@/lib/evidenceChainExport";

type Participant = Tables<"participants">;
type Goal = Tables<"participant_goals">;
type ProgressEntry = Tables<"participant_progress">;

// Role-based masking levels
const getMaskLevel = (role: string): "full" | "partial" | "masked" => {
  if (["super_admin", "compliance_officer"].includes(role)) return "full";
  if (["supervisor", "hr_admin", "executive"].includes(role)) return "partial";
  return "masked";
};

const maskField = (value: string | null, level: "full" | "partial" | "masked", isRevealed: boolean): string => {
  if (!value) return "—";
  // All roles see masked data by default — reveal requires explicit toggle
  if (isRevealed) return value;
  if (level === "full") return value.slice(0, 2) + "••••••";
  if (level === "partial") return value.slice(0, 3) + "••••";
  return "••••••••";
};

const consentColors: Record<string, string> = {
  granted: "border-success text-success",
  withdrawn: "border-destructive text-destructive",
  pending: "border-warning text-warning",
};

export default function Participants() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("profiles");
  const [searchTerm, setSearchTerm] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const maskLevel = getMaskLevel(user?.role ?? "support_worker");

  // Form state
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    ndis_number: "", address: "", date_of_birth: "",
    support_type: "", consent_status: "pending" as string,
  });

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["participants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .eq("record_status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allGoals = [] } = useQuery({
    queryKey: ["participant-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_goals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allProgress = [] } = useQuery({
    queryKey: ["participant-progress"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_progress")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: accessLogs = [] } = useQuery({
    queryKey: ["access-reveal-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_reveal_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("participants").insert({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        ndis_number: form.ndis_number || null,
        address: form.address || null,
        date_of_birth: form.date_of_birth || null,
        support_type: form.support_type || null,
        consent_status: form.consent_status as "granted" | "withdrawn" | "pending",
        consent_date: form.consent_status === "granted" ? new Date().toISOString() : null,
        organisation_id: user.organisation_id!,
        created_by: user.id,
      });
      if (error) throw error;
      await logAudit({ action: "participant_created", module: "participants", details: { name: `${form.first_name} ${form.last_name}` } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setDialogOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", ndis_number: "", address: "", date_of_birth: "", support_type: "", consent_status: "pending" });
      toast({ title: "Participant added successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleReveal = async (participantId: string, field: string) => {
    const key = `${participantId}:${field}`;
    if (!revealed.has(key) && user) {
      await supabase.from("access_reveal_logs").insert({
        participant_id: participantId,
        user_id: user.id,
        field_accessed: field,
        reason: "Operational access",
        access_granted: true,
      });
      await logAudit({
        action: "data_unmasked",
        module: "participants",
        record_id: participantId,
        details: { field, role: user.role },
        severity: "elevated",
      });
      queryClient.invalidateQueries({ queryKey: ["access-reveal-logs"] });
    }
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const isRevealed = (id: string, field: string) => revealed.has(`${id}:${field}`);

  const filtered = participants.filter(p => {
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase()) ||
      (p.ndis_number ?? "").toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Stats
  const stats = useMemo(() => {
    const consented = participants.filter(p => (p as any).consent_status === "granted").length;
    const pending = participants.filter(p => (p as any).consent_status === "pending").length;
    const withdrawn = participants.filter(p => (p as any).consent_status === "withdrawn").length;
    const withGoals = new Set(allGoals.map(g => g.participant_id)).size;
    const noProgress = allGoals.filter(g => {
      const entries = allProgress.filter(p => p.goal_id === g.id);
      return entries.length === 0 && differenceInDays(new Date(), new Date(g.created_at)) > 14;
    });
    return { total: participants.length, consented, pending, withdrawn, withGoals, noProgress: noProgress.length };
  }, [participants, allGoals, allProgress]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Participant Profiles & Outcomes</h1>
          <p className="text-muted-foreground">Privacy-first profiles with outcome tracking, evidence & audit trail</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            Access: {maskLevel === "full" ? "Full" : maskLevel === "partial" ? "Partial" : "Masked"}
          </Badge>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Participant</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Participant</DialogTitle></DialogHeader>
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required /></div>
                  <div className="space-y-2"><Label>Last Name *</Label><Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>NDIS Number</Label><Input value={form.ndis_number} onChange={e => setForm(f => ({ ...f, ndis_number: e.target.value }))} placeholder="e.g. 431234567" /></div>
                </div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Support Type</Label>
                    <Select value={form.support_type} onValueChange={v => setForm(f => ({ ...f, support_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="core">Core Supports</SelectItem>
                        <SelectItem value="capacity">Capacity Building</SelectItem>
                        <SelectItem value="capital">Capital Supports</SelectItem>
                        <SelectItem value="coordination">Support Coordination</SelectItem>
                        <SelectItem value="specialist">Specialist Disability</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Consent Status</Label>
                    <Select value={form.consent_status} onValueChange={v => setForm(f => ({ ...f, consent_status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="granted">Granted</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="withdrawn">Withdrawn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add Participant"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="outcomes">Outcome Tracking</TabsTrigger>
          <TabsTrigger value="compliance">Compliance & Alerts</TabsTrigger>
          <TabsTrigger value="access-log">Access Logs</TabsTrigger>
        </TabsList>

        {/* PROFILES TAB */}
        <TabsContent value="profiles" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold">{stats.total}</div><p className="text-sm text-muted-foreground">Total Participants</p></CardContent></Card>
            <Card className="border-success/30"><CardContent className="pt-6 text-center"><div className="text-2xl font-bold text-success">{stats.consented}</div><p className="text-sm text-muted-foreground">Consent Granted</p></CardContent></Card>
            <Card className="border-warning/30"><CardContent className="pt-6 text-center"><div className="text-2xl font-bold text-warning">{stats.pending}</div><p className="text-sm text-muted-foreground">Consent Pending</p></CardContent></Card>
            <Card className="border-destructive/30"><CardContent className="pt-6 text-center"><div className="text-2xl font-bold text-destructive">{stats.withdrawn}</div><p className="text-sm text-muted-foreground">Consent Withdrawn</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Participant Register</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search name or NDIS#..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> :
               filtered.length === 0 ? <p className="text-center py-4 text-muted-foreground">No participants found</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>NDIS Number</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Support Type</TableHead>
                        <TableHead>Consent</TableHead>
                        <TableHead>Risk Flags</TableHead>
                        <TableHead>Access</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(p => {
                        const consent = (p as any).consent_status as string ?? "pending";
                        const riskFlags = ((p as any).risk_flags as string[] | null) ?? [];
                        const supportType = (p as any).support_type as string | null;
                        return (
                          <TableRow
                            key={p.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => { setSelectedParticipant(p); setDetailOpen(true); }}
                          >
                            <TableCell className="font-medium">
                              {maskField(`${p.first_name} ${p.last_name}`, maskLevel, isRevealed(p.id, "name"))}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {maskField(p.ndis_number, maskLevel, isRevealed(p.id, "ndis"))}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div>{maskField(p.email, maskLevel, isRevealed(p.id, "email"))}</div>
                              <div className="text-muted-foreground">{maskField(p.phone, maskLevel, isRevealed(p.id, "phone"))}</div>
                            </TableCell>
                            <TableCell>
                              {supportType ? <Badge variant="outline" className="capitalize">{supportType}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={consentColors[consent] ?? ""}>
                                {consent === "granted" ? <CheckCircle className="h-3 w-3 mr-1" /> :
                                 consent === "withdrawn" ? <XCircle className="h-3 w-3 mr-1" /> :
                                 <Clock className="h-3 w-3 mr-1" />}
                                {consent}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {riskFlags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {riskFlags.map(f => <Badge key={f} variant="destructive" className="text-[10px]">{f}</Badge>)}
                                </div>
                              ) : <span className="text-muted-foreground text-xs">None</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {["name", "ndis", "email", "phone"].map(field => (
                                  <Button
                                    key={field}
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={e => { e.stopPropagation(); toggleReveal(p.id, field); }}
                                    title={`${isRevealed(p.id, field) ? "Mask" : "Reveal"} ${field}`}
                                  >
                                    {isRevealed(p.id, field) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </Button>
                                ))}
                              </div>
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

        {/* OUTCOMES TAB */}
        <TabsContent value="outcomes" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold">{allGoals.length}</div><p className="text-sm text-muted-foreground">Active Goals</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold">{allProgress.length}</div><p className="text-sm text-muted-foreground">Progress Entries</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><div className="text-2xl font-bold">{stats.withGoals}</div><p className="text-sm text-muted-foreground">Participants with Goals</p></CardContent></Card>
          </div>

          {allGoals.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No goals recorded yet. Open a participant profile to add goals.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {allGoals.map(goal => {
                const participant = participants.find(p => p.id === goal.participant_id);
                const entries = allProgress.filter(p => p.goal_id === goal.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const latest = entries[0];
                const baseline = (goal as any).baseline_score as number | null;
                const target = (goal as any).target_score as number | null;
                const progressPct = baseline != null && target != null && latest?.metric_value != null
                  ? Math.min(100, Math.max(0, ((latest.metric_value - baseline) / (target - baseline)) * 100))
                  : null;
                const isStale = entries.length === 0 && differenceInDays(new Date(), new Date(goal.created_at)) > 14;

                return (
                  <Card key={goal.id} className={isStale ? "border-warning/50" : ""}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{goal.title}</h3>
                            <Badge variant="outline" className="capitalize text-xs">{goal.status}</Badge>
                            {isStale && <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />No Progress</Badge>}
                          </div>
                          {participant && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {maskField(`${participant.first_name} ${participant.last_name}`, maskLevel, false)}
                            </p>
                          )}
                          {goal.description && <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>}
                        </div>
                        <div className="text-right text-sm">
                          {baseline != null && <div>Baseline: <span className="font-medium">{baseline}</span></div>}
                          {target != null && <div>Target: <span className="font-medium">{target}</span></div>}
                          {latest?.metric_value != null && <div>Current: <span className="font-bold">{latest.metric_value}</span></div>}
                        </div>
                      </div>
                      {progressPct != null && (
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>{Math.round(progressPct)}%</span>
                          </div>
                          <Progress value={progressPct} className="h-2" />
                        </div>
                      )}
                      {entries.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">{entries.length} progress entries</p>
                          <div className="flex gap-1">
                            {entries.slice(0, 10).map((e, i) => {
                              const prev = entries[i + 1];
                              const trend = prev && e.metric_value != null && prev.metric_value != null
                                ? e.metric_value > prev.metric_value ? "up" : e.metric_value < prev.metric_value ? "down" : "flat"
                                : "flat";
                              return (
                                <div key={e.id} className={`w-3 h-3 rounded-full ${trend === "up" ? "bg-success" : trend === "down" ? "bg-destructive" : "bg-muted-foreground/30"}`} title={`${e.metric_value} - ${format(new Date(e.created_at), "PP")}`} />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* COMPLIANCE & ALERTS TAB */}
        <TabsContent value="compliance" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* No Progress Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Goals Without Progress (&gt;14 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const staleGoals = allGoals.filter(g => {
                    const entries = allProgress.filter(p => p.goal_id === g.id);
                    return entries.length === 0 && differenceInDays(new Date(), new Date(g.created_at)) > 14;
                  });
                  return staleGoals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">All goals have recent progress</p>
                  ) : (
                    <div className="space-y-2">
                      {staleGoals.map(g => {
                        const p = participants.find(pp => pp.id === g.participant_id);
                        return (
                          <div key={g.id} className="flex items-center justify-between text-sm p-2 rounded bg-warning/5 border border-warning/20">
                            <div>
                              <span className="font-medium">{g.title}</span>
                              {p && <span className="text-muted-foreground ml-2">({p.first_name} {p.last_name.charAt(0)}.)</span>}
                            </div>
                            <Badge variant="outline" className="text-xs">{differenceInDays(new Date(), new Date(g.created_at))}d ago</Badge>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Consent Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4 text-destructive" />
                  Consent Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const issues = participants.filter(p => {
                    const consent = (p as any).consent_status as string;
                    return consent === "withdrawn" || consent === "pending";
                  });
                  return issues.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">All participants have granted consent</p>
                  ) : (
                    <div className="space-y-2">
                      {issues.map(p => {
                        const consent = (p as any).consent_status as string;
                        return (
                          <div key={p.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                            <span>{p.first_name} {p.last_name.charAt(0)}.</span>
                            <Badge variant="outline" className={consentColors[consent]}>{consent}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Compliance Summary */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Outcome Compliance Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Total participants</span><span className="font-bold">{stats.total}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>With active goals</span><span className="font-bold">{stats.withGoals}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Without goals</span><span className="font-bold text-warning">{stats.total - stats.withGoals}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Goals with no progress (&gt;14d)</span><span className="font-bold text-destructive">{stats.noProgress}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total progress entries</span><span className="font-bold">{allProgress.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span>Data unmask events (recent)</span><span className="font-bold">{accessLogs.length}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACCESS LOGS TAB */}
        <TabsContent value="access-log" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Data Access Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {accessLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No access events recorded</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Participant</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Granted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accessLogs.map(log => {
                        const participant = participants.find(p => p.id === log.participant_id);
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {format(new Date(log.created_at), "PP p")}
                            </TableCell>
                            <TableCell className="text-sm font-mono">{log.user_id.slice(0, 8)}...</TableCell>
                            <TableCell className="text-sm">
                              {participant ? `${participant.first_name} ${participant.last_name.charAt(0)}.` : log.participant_id.slice(0, 8)}
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs capitalize">{log.field_accessed}</Badge></TableCell>
                            <TableCell className="text-sm">{log.reason}</TableCell>
                            <TableCell>
                              {log.access_granted ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
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
      </Tabs>

      {/* Participant Detail Sheet */}
      {selectedParticipant && (
        <ParticipantDetailSheet
          participant={selectedParticipant}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          goals={allGoals.filter(g => g.participant_id === selectedParticipant.id)}
          progress={allProgress.filter(p => {
            const goalIds = allGoals.filter(g => g.participant_id === selectedParticipant.id).map(g => g.id);
            return goalIds.includes(p.goal_id ?? "");
          })}
          maskLevel={maskLevel}
          isRevealed={(field) => isRevealed(selectedParticipant.id, field)}
          onToggleReveal={(field) => toggleReveal(selectedParticipant.id, field)}
        />
      )}
    </div>
  );
}

// ── Participant Detail Sheet ──
function ParticipantDetailSheet({
  participant, open, onOpenChange, goals, progress, maskLevel, isRevealed, onToggleReveal,
}: {
  participant: Participant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: Goal[];
  progress: ProgressEntry[];
  maskLevel: "full" | "partial" | "masked";
  isRevealed: (field: string) => boolean;
  onToggleReveal: (field: string) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [goalForm, setGoalForm] = useState({ title: "", description: "", baseline_score: "", target_score: "", measurement_unit: "score", target_date: "" });
  const [progressForm, setProgressForm] = useState({ metric_value: "", notes: "", evidence_notes: "" });

  const consent = (participant as any).consent_status as string ?? "pending";
  const isConsentGranted = consent === "granted";
  const supportType = (participant as any).support_type as string | null;
  const riskFlags = ((participant as any).risk_flags as string[] | null) ?? [];

  const addGoalMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("participant_goals").insert({
        participant_id: participant.id,
        title: goalForm.title,
        description: goalForm.description || null,
        baseline_score: goalForm.baseline_score ? Number(goalForm.baseline_score) : null,
        target_score: goalForm.target_score ? Number(goalForm.target_score) : null,
        measurement_unit: goalForm.measurement_unit,
        target_date: goalForm.target_date || null,
        created_by: user.id,
      } as any);
      if (error) throw error;
      await logAudit({ action: "goal_created", module: "participant_goals", record_id: participant.id, details: { title: goalForm.title } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participant-goals"] });
      setGoalDialogOpen(false);
      setGoalForm({ title: "", description: "", baseline_score: "", target_score: "", measurement_unit: "score", target_date: "" });
      toast({ title: "Goal added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addProgressMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!selectedGoalId) throw new Error("Select a goal");
      const goal = goals.find(g => g.id === selectedGoalId);
      const { error } = await supabase.from("participant_progress").insert({
        participant_id: participant.id,
        goal_id: selectedGoalId,
        metric_name: goal?.title ?? "Progress",
        metric_value: progressForm.metric_value ? Number(progressForm.metric_value) : null,
        notes: progressForm.notes || null,
        evidence_notes: progressForm.evidence_notes || null,
        evidence_type: "notes",
        recorded_by: user.id,
      } as any);
      if (error) throw error;
      await logAudit({ action: "progress_recorded", module: "participant_progress", record_id: participant.id, details: { goal_id: selectedGoalId, value: progressForm.metric_value } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participant-progress"] });
      setProgressDialogOpen(false);
      setProgressForm({ metric_value: "", notes: "", evidence_notes: "" });
      toast({ title: "Progress recorded" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const MaskedField = ({ label, value, field }: { label: string; value: string | null; field: string }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{maskField(value, maskLevel, isRevealed(field))}</span>
        {maskLevel !== "full" && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onToggleReveal(field)}>
            {isRevealed(field) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {maskField(`${participant.first_name} ${participant.last_name}`, maskLevel, isRevealed("name"))}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Consent Banner */}
          {!isConsentGranted && (
            <div className={`p-3 rounded-lg border ${consent === "withdrawn" ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/5"}`}>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {consent === "withdrawn" ? "Consent withdrawn — data access and updates are blocked" : "Consent pending — some operations may be restricted"}
                </span>
              </div>
            </div>
          )}

          {/* Profile Section */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Profile Details</CardTitle></CardHeader>
            <CardContent className="space-y-0">
              <MaskedField label="Full Name" value={`${participant.first_name} ${participant.last_name}`} field="name" />
              <Separator />
              <MaskedField label="Date of Birth" value={participant.date_of_birth} field="dob" />
              <Separator />
              <MaskedField label="NDIS Number" value={participant.ndis_number} field="ndis" />
              <Separator />
              <MaskedField label="Email" value={participant.email} field="email" />
              <Separator />
              <MaskedField label="Phone" value={participant.phone} field="phone" />
              <Separator />
              <MaskedField label="Address" value={participant.address} field="address" />
              <Separator />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-muted-foreground">Support Type</span>
                <span className="text-sm font-medium capitalize">{supportType ?? "—"}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-muted-foreground">Consent</span>
                <Badge variant="outline" className={consentColors[consent]}>{consent}</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm text-muted-foreground">Risk Flags</span>
                <div className="flex gap-1">
                  {riskFlags.length > 0 ? riskFlags.map(f => <Badge key={f} variant="destructive" className="text-xs">{f}</Badge>) : <span className="text-sm text-muted-foreground">None</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Goals & Outcomes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Goals & Outcomes</CardTitle>
                <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={!isConsentGranted}>
                      <Plus className="h-3 w-3 mr-1" />Add Goal
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Goal</DialogTitle></DialogHeader>
                    <form className="space-y-4" onSubmit={e => { e.preventDefault(); addGoalMutation.mutate(); }}>
                      <div className="space-y-2"><Label>Goal Title *</Label><Input value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} required /></div>
                      <div className="space-y-2"><Label>Description</Label><Textarea value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} /></div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2"><Label>Baseline</Label><Input type="number" value={goalForm.baseline_score} onChange={e => setGoalForm(f => ({ ...f, baseline_score: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Target</Label><Input type="number" value={goalForm.target_score} onChange={e => setGoalForm(f => ({ ...f, target_score: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Unit</Label><Input value={goalForm.measurement_unit} onChange={e => setGoalForm(f => ({ ...f, measurement_unit: e.target.value }))} /></div>
                      </div>
                      <div className="space-y-2"><Label>Target Date</Label><Input type="date" value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))} /></div>
                      <Button type="submit" className="w-full" disabled={addGoalMutation.isPending}>
                        {addGoalMutation.isPending ? "Adding..." : "Add Goal"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No goals yet</p>
              ) : (
                <div className="space-y-4">
                  {goals.map(goal => {
                    const entries = progress.filter(p => p.goal_id === goal.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    const latest = entries[0];
                    const baseline = (goal as any).baseline_score as number | null;
                    const target = (goal as any).target_score as number | null;
                    const unit = (goal as any).measurement_unit as string | null;
                    const pct = baseline != null && target != null && latest?.metric_value != null
                      ? Math.min(100, Math.max(0, ((latest.metric_value - baseline) / (target - baseline)) * 100))
                      : null;

                    return (
                      <div key={goal.id} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium">{goal.title}</h4>
                            {goal.description && <p className="text-xs text-muted-foreground">{goal.description}</p>}
                          </div>
                          <Badge variant="outline" className="capitalize text-xs">{goal.status}</Badge>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {baseline != null && <span>Baseline: {baseline} {unit}</span>}
                          {target != null && <span>Target: {target} {unit}</span>}
                          {latest?.metric_value != null && <span className="font-medium text-foreground">Current: {latest.metric_value} {unit}</span>}
                        </div>
                        {pct != null && <Progress value={pct} className="h-1.5" />}
                        {entries.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {entries.slice(0, 5).map(e => (
                              <div key={e.id} className="flex items-center justify-between text-xs p-1.5 bg-muted/50 rounded">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{e.metric_value ?? "—"}</span>
                                  {e.notes && <span className="text-muted-foreground truncate max-w-[150px]">{e.notes}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {(e as any).evidence_notes && <span title="Has evidence"><FileText className="h-3 w-3 text-primary" /></span>}
                                  <span className="text-muted-foreground">{format(new Date(e.created_at), "PP")}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Progress Button */}
              {goals.length > 0 && (
                <div className="mt-4">
                  <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="w-full" disabled={!isConsentGranted}>
                        <Plus className="h-3 w-3 mr-1" />Record Progress
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Record Progress</DialogTitle></DialogHeader>
                      <form className="space-y-4" onSubmit={e => { e.preventDefault(); addProgressMutation.mutate(); }}>
                        <div className="space-y-2">
                          <Label>Goal *</Label>
                          <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                            <SelectTrigger><SelectValue placeholder="Select goal..." /></SelectTrigger>
                            <SelectContent>
                              {goals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2"><Label>Score / Value</Label><Input type="number" value={progressForm.metric_value} onChange={e => setProgressForm(f => ({ ...f, metric_value: e.target.value }))} /></div>
                        <div className="space-y-2"><Label>Notes</Label><Textarea value={progressForm.notes} onChange={e => setProgressForm(f => ({ ...f, notes: e.target.value }))} /></div>
                        <div className="space-y-2">
                          <Label>Evidence Notes * <span className="text-xs text-muted-foreground">(required)</span></Label>
                          <Textarea
                            value={progressForm.evidence_notes}
                            onChange={e => setProgressForm(f => ({ ...f, evidence_notes: e.target.value }))}
                            placeholder="Describe the evidence supporting this progress entry..."
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={addProgressMutation.isPending || !selectedGoalId}>
                          {addProgressMutation.isPending ? "Recording..." : "Record Progress"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
