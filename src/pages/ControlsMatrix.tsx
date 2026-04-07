import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Grid3X3, CheckCircle, AlertTriangle, Link } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ControlsMatrix() {
  const { user, hasRole, isMockAudit } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Form state
  const [standardId, setStandardId] = useState("");
  const [qualityIndicator, setQualityIndicator] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [workflowModule, setWorkflowModule] = useState("");
  const [evidenceTable, setEvidenceTable] = useState("");
  const [evidenceDesc, setEvidenceDesc] = useState("");

  const { data: standards = [] } = useQuery({
    queryKey: ["practice-standards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("practice_standards").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: policies = [] } = useQuery({
    queryKey: ["policies-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("policies").select("id, title, status, current_version, approved_at, next_review_date").eq("record_status", "active");
      if (error) throw error;
      return data;
    },
  });

  const { data: controls = [], isLoading } = useQuery({
    queryKey: ["controls-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controls_matrix")
        .select("*, practice_standards(code, name, category), policies(title, status, current_version, approved_at, next_review_date)")
        .eq("record_status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("controls_matrix").insert({
        practice_standard_id: standardId,
        quality_indicator: qualityIndicator,
        linked_policy_id: policyId || null,
        workflow_module: workflowModule || null,
        evidence_table: evidenceTable || null,
        evidence_description: evidenceDesc || null,
        organisation_id: user.organisation_id!,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controls-matrix"] });
      setDialogOpen(false);
      setStandardId(""); setQualityIndicator(""); setPolicyId(""); setWorkflowModule(""); setEvidenceTable(""); setEvidenceDesc("");
      toast({ title: "Control mapping created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const categories = [...new Set(standards.map(s => s.category))];
  const filtered = categoryFilter === "all"
    ? controls
    : controls.filter((c: any) => c.practice_standards?.category === categoryFilter);

  const linkedCount = controls.filter((c: any) => c.linked_policy_id).length;
  const unlinkedCount = controls.length - linkedCount;

  const MODULES = ["incidents", "complaints", "risks", "safeguarding", "training", "staff", "policies", "participants"];
  const EVIDENCE_TABLES = ["incidents", "complaints", "risks", "safeguarding_concerns", "training_completions", "staff_compliance_records", "audit_logs", "participant_progress"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Controls Matrix</h1>
          <p className="text-muted-foreground">Practice Standard → Quality Indicator → Policy → Workflow → Evidence</p>
        </div>
        {!isMockAudit && hasRole(["super_admin", "compliance_officer"]) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Add Control Mapping</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Control Mapping</DialogTitle></DialogHeader>
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
                <div className="space-y-2">
                  <Label>Practice Standard *</Label>
                  <Select value={standardId} onValueChange={setStandardId}>
                    <SelectTrigger><SelectValue placeholder="Select standard" /></SelectTrigger>
                    <SelectContent>{standards.map(s => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Quality Indicator *</Label><Input value={qualityIndicator} onChange={e => setQualityIndicator(e.target.value)} required placeholder="e.g. Staff screening verified before assignment" /></div>
                <div className="space-y-2">
                  <Label>Linked Policy</Label>
                  <Select value={policyId} onValueChange={setPolicyId}>
                    <SelectTrigger><SelectValue placeholder="Select policy (optional)" /></SelectTrigger>
                    <SelectContent>{policies.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Workflow Module</Label>
                  <Select value={workflowModule} onValueChange={setWorkflowModule}>
                    <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                    <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Evidence Table</Label>
                  <Select value={evidenceTable} onValueChange={setEvidenceTable}>
                    <SelectTrigger><SelectValue placeholder="Select evidence source" /></SelectTrigger>
                    <SelectContent>{EVIDENCE_TABLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Evidence Description</Label><Textarea value={evidenceDesc} onChange={e => setEvidenceDesc(e.target.value)} placeholder="What evidence proves this control is operating?" /></div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create Mapping</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Controls</CardTitle><Grid3X3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{controls.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Linked to Policy</CardTitle><CheckCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">{linkedCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Missing Policy Link</CardTitle><AlertTriangle className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">{unlinkedCount}</div></CardContent></Card>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm">Filter by Category:</Label>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Control Mappings</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : filtered.length === 0 ? <p className="text-center py-4 text-muted-foreground">No control mappings found. Add one to map standards to evidence.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Standard</TableHead>
                    <TableHead>Quality Indicator</TableHead>
                    <TableHead>Linked Policy</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Evidence Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c: any) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(c)}>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="font-mono">{c.practice_standards?.code}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">{c.practice_standards?.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{c.quality_indicator}</TableCell>
                      <TableCell>
                        {c.policies ? (
                          <div className="flex items-center gap-1">
                            <Link className="h-3 w-3 text-success" />
                            <span className="text-sm">{c.policies.title}</span>
                          </div>
                        ) : <Badge variant="outline" className="text-warning">Not linked</Badge>}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{c.workflow_module ?? "—"}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.evidence_table ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Control Chain Detail</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">PRACTICE STANDARD</h3>
                  <div className="rounded-lg border p-4">
                    <Badge variant="outline" className="font-mono text-lg">{selected.practice_standards?.code}</Badge>
                    <p className="mt-1 font-medium">{selected.practice_standards?.name}</p>
                    <Badge variant="secondary" className="mt-1">{selected.practice_standards?.category}</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-center"><span className="text-muted-foreground text-2xl">↓</span></div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">QUALITY INDICATOR</h3>
                  <div className="rounded-lg border p-4">
                    <p>{selected.quality_indicator}</p>
                  </div>
                </div>

                <div className="flex items-center justify-center"><span className="text-muted-foreground text-2xl">↓</span></div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">LINKED POLICY</h3>
                  <div className="rounded-lg border p-4">
                    {selected.policies ? (
                      <div className="space-y-1">
                        <p className="font-medium">{selected.policies.title}</p>
                        <div className="flex gap-2">
                          <Badge variant="outline">v{selected.policies.current_version}</Badge>
                          <Badge className="capitalize">{selected.policies.status}</Badge>
                        </div>
                        {selected.policies.approved_at && <p className="text-xs text-muted-foreground">Approved: {new Date(selected.policies.approved_at).toLocaleDateString()}</p>}
                        {selected.policies.next_review_date && <p className="text-xs text-muted-foreground">Next Review: {selected.policies.next_review_date}</p>}
                      </div>
                    ) : <p className="text-warning">No policy linked</p>}
                  </div>
                </div>

                <div className="flex items-center justify-center"><span className="text-muted-foreground text-2xl">↓</span></div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">WORKFLOW MODULE</h3>
                  <div className="rounded-lg border p-4">
                    <Badge variant="secondary" className="capitalize text-base">{selected.workflow_module ?? "Not specified"}</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-center"><span className="text-muted-foreground text-2xl">↓</span></div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">EVIDENCE RECORD</h3>
                  <div className="rounded-lg border p-4">
                    <p className="font-mono text-sm">{selected.evidence_table ?? "Not specified"}</p>
                    {selected.evidence_description && <p className="text-sm text-muted-foreground mt-1">{selected.evidence_description}</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
