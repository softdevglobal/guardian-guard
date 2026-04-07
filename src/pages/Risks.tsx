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
import { Plus, ShieldAlert, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { logAudit } from "@/lib/auditLog";

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

const STATUS_FLOW: Record<string, string> = {
  open: "assessed",
  assessed: "mitigating",
  mitigating: "monitoring",
  monitoring: "closed",
};

const STATUS_ROLE_GATE: Record<string, string[]> = {
  assessed: ["super_admin", "compliance_officer", "supervisor"],
  mitigating: ["super_admin", "compliance_officer"],
  monitoring: ["super_admin", "compliance_officer"],
  closed: ["super_admin", "compliance_officer"],
};

function getRiskLevel(score: number) {
  if (score >= 16) return "Critical";
  if (score >= 10) return "High";
  if (score >= 5) return "Medium";
  return "Low";
}

function getRiskBadgeVariant(level: string) {
  if (level === "Critical") return "destructive" as const;
  if (level === "High") return "destructive" as const;
  if (level === "Medium") return "outline" as const;
  return "secondary" as const;
}

const INITIAL_FORM = {
  title: "", category: "operational", description: "",
  likelihood_score: 2, impact_score: 2,
  existing_controls: "", escalation_required: false,
  review_date: "",
  linked_participant_id: "", linked_staff_id: "",
  linked_incident_id: "", linked_complaint_id: "",
};

export default function Risks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [selected, setSelected] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, any>>({});

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ["risks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("risks").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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
      setDialogOpen(false);
      setForm(INITIAL_FORM);
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
      toast({ title: "Saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const advanceMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !user) return;
      const nextStatus = STATUS_FLOW[selected.status];
      if (!nextStatus) throw new Error("No next status");

      const updatePayload: any = { status: nextStatus, ...editFields };
      const { error } = await supabase.from("risks").update(updatePayload).eq("id", selected.id);
      if (error) throw error;

      await logAudit({
        action: "status_advanced",
        module: "risks",
        record_id: selected.id,
        details: { from: selected.status, to: nextStatus },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      setEditFields({});
      setSelected((prev: any) => prev ? { ...prev, status: STATUS_FLOW[prev.status], ...editFields } : null);
      toast({ title: "Status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const setEdit = (key: string, val: any) => setEditFields(prev => ({ ...prev, [key]: val }));
  const getField = (key: string) => editFields[key] ?? selected?.[key] ?? "";
  const riskScore = form.likelihood_score * form.impact_score;

  const openCount = risks.filter((r) => r.status === "open").length;
  const mitigatingCount = risks.filter((r) => r.status === "mitigating").length;
  const closedCount = risks.filter((r) => ["closed", "resolved"].includes(r.status)).length;

  const nextStatus = selected ? STATUS_FLOW[selected.status] : null;
  const canAdvance = nextStatus && user && STATUS_ROLE_GATE[nextStatus]?.includes(user.role);
  const isEditable = selected?.status !== "closed";
  const selectedScore = selected?.risk_score ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk Register</h1>
          <p className="text-muted-foreground">Identify, assess, and mitigate compliance risks</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Add Risk</Button></DialogTrigger>
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
                    <AlertTriangle className="h-3 w-3" /> High risk score — escalation auto-enabled, review date recommended within 7 days
                  </p>
                </div>
              )}
              <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
              <div className="space-y-2"><Label>Existing Controls</Label><Textarea value={form.existing_controls} onChange={(e) => set("existing_controls", e.target.value)} /></div>
              <div className="space-y-2"><Label>Review Date</Label><Input type="date" value={form.review_date} onChange={(e) => set("review_date", e.target.value)} /></div>
              <div className="flex items-center justify-between">
                <Label>Escalation Required?</Label>
                <Switch checked={form.escalation_required || riskScore >= 7} onCheckedChange={(v) => set("escalation_required", v)} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Add Risk"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section aria-label="Risk summary" className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open Risks</CardTitle><ShieldAlert className="h-4 w-4 text-destructive" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{openCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Mitigating</CardTitle><ShieldAlert className="h-4 w-4 text-warning" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{mitigatingCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Closed</CardTitle><ShieldAlert className="h-4 w-4 text-success" aria-hidden /></CardHeader><CardContent><div className="text-2xl font-bold">{closedCount}</div></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>All Risks</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : risks.length === 0 ? <p className="text-center py-4 text-muted-foreground">No risks found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Score</TableHead><TableHead>Level</TableHead><TableHead>Status</TableHead><TableHead>Review Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {risks.map((r) => {
                    const score = r.risk_score ?? 0;
                    const level = r.risk_level ?? getRiskLevel(score);
                    return (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelected(r); setSheetOpen(true); setEditFields({}); }}>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell className="capitalize">{r.category.replace(/_/g, " ")}</TableCell>
                        <TableCell className="font-mono">{score}</TableCell>
                        <TableCell><Badge variant={getRiskBadgeVariant(level)}>{level}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.review_date ? format(new Date(r.review_date), "PP") : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.title}
                  <Badge variant={getRiskBadgeVariant(selected.risk_level ?? "")}>{selected.risk_level ?? "—"}</Badge>
                  <Badge variant="secondary" className="capitalize">{selected.status}</Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {selectedScore >= 7 && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2">
                    <p className="text-xs font-medium flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" /> High risk — compliance review mandatory
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Category</p><p className="text-sm capitalize">{selected.category.replace(/_/g, " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Risk Score</p><p className="text-sm font-mono">{selectedScore}</p></div>
                  <div><p className="text-xs text-muted-foreground">Likelihood</p><p className="text-sm">{selected.likelihood_score ?? selected.likelihood}</p></div>
                  <div><p className="text-xs text-muted-foreground">Impact</p><p className="text-sm">{selected.impact_score ?? selected.impact}</p></div>
                  <div><p className="text-xs text-muted-foreground">Escalation Required</p><p className="text-sm">{selected.escalation_required ? "Yes" : "No"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Review Date</p><p className="text-sm">{selected.review_date ? format(new Date(selected.review_date), "PP") : "—"}</p></div>
                </div>

                {/* Linked records */}
                {(selected.linked_participant_id || selected.linked_staff_id || selected.linked_incident_id || selected.linked_complaint_id) && (
                  <>
                    <Separator />
                    <h4 className="text-sm font-semibold">Linked Records</h4>
                    <div className="space-y-1 text-sm">
                      {selected.linked_participant_id && <p>Participant: <span className="font-mono">{selected.linked_participant_id.slice(0, 8)}...</span></p>}
                      {selected.linked_staff_id && <p>Staff: <span className="font-mono">{selected.linked_staff_id.slice(0, 8)}...</span></p>}
                      {selected.linked_incident_id && <p>Incident: <span className="font-mono">{selected.linked_incident_id.slice(0, 8)}...</span></p>}
                      {selected.linked_complaint_id && <p>Complaint: <span className="font-mono">{selected.linked_complaint_id.slice(0, 8)}...</span></p>}
                    </div>
                  </>
                )}

                <Separator />
                <div><p className="text-xs text-muted-foreground">Description</p><p className="text-sm whitespace-pre-wrap">{selected.description ?? "—"}</p></div>
                {selected.existing_controls && (
                  <div><p className="text-xs text-muted-foreground">Existing Controls</p><p className="text-sm whitespace-pre-wrap">{selected.existing_controls}</p></div>
                )}

                {/* Editable mitigation fields */}
                {isEditable && (
                  <>
                    <Separator />
                    <h4 className="text-sm font-semibold">Mitigation</h4>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Review Date</Label>
                        <Input
                          type="date"
                          value={getField("review_date") ?? ""}
                          onChange={e => setEdit("review_date", e.target.value || null)}
                          onBlur={() => editFields.review_date !== undefined && saveMutation.mutate({ review_date: editFields.review_date })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Existing Controls</Label>
                        <Textarea
                          value={getField("existing_controls")}
                          onChange={e => setEdit("existing_controls", e.target.value)}
                          onBlur={() => editFields.existing_controls !== undefined && saveMutation.mutate({ existing_controls: editFields.existing_controls })}
                          rows={2}
                        />
                      </div>
                    </div>
                  </>
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
