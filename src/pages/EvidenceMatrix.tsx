import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Download, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { downloadCSV } from "@/lib/evidenceChainExport";
import {
  buildEvidencePackCSV,
  derivedStatus,
  EVIDENCE_STATUS_LABEL,
  readyBlockers,
  summariseMatrix,
  type EvidenceRequirementLike,
  type EvidenceStatus,
} from "@/lib/evidenceMatrix";

const STATUS_STYLE: Record<EvidenceStatus, { icon: typeof CheckCircle2; className: string }> = {
  ready: { icon: CheckCircle2, className: "border-success text-success" },
  in_progress: { icon: Clock, className: "border-primary text-primary" },
  missing: { icon: CircleDashed, className: "border-muted-foreground text-muted-foreground" },
  overdue: { icon: AlertTriangle, className: "border-destructive text-destructive" },
};

function StatusBadge({ status }: { status: EvidenceStatus }) {
  const { icon: Icon, className } = STATUS_STYLE[status];
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {EVIDENCE_STATUS_LABEL[status]}
    </Badge>
  );
}

interface Row extends EvidenceRequirementLike {
  quality_indicator: string | null;
  module_code: string;
  outcome_name: string;
  part_name: string | null;
  policy_title: string | null;
  owner_name: string | null;
  requires_human_review: boolean;
}

export default function EvidenceMatrix() {
  const { user, hasRole, isMockAudit } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer"]);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Row | null>(null);

  const { data: modules = [] } = useQuery({
    queryKey: ["standard-modules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("standard_modules" as any).select("*").order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: policies = [] } = useQuery({
    queryKey: ["policies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("id, title, current_version")
        .eq("record_status", "active")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["profiles-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["evidence-requirements"],
    queryFn: async (): Promise<Row[]> => {
      const [reqRes, outcomeRes, linkRes] = await Promise.all([
        supabase.from("evidence_requirements" as any).select("*").eq("record_status", "active"),
        supabase.from("practice_outcomes" as any).select("*").order("sort_order"),
        supabase.from("evidence_requirement_links" as any).select("requirement_id"),
      ]);
      if (reqRes.error) throw reqRes.error;
      if (outcomeRes.error) throw outcomeRes.error;

      const outcomes = new Map((outcomeRes.data as any[]).map((o) => [o.outcome_code, o]));
      const counts = new Map<string, number>();
      ((linkRes.data as any[]) ?? []).forEach((l) => counts.set(l.requirement_id, (counts.get(l.requirement_id) ?? 0) + 1));

      return (reqRes.data as any[]).map((r) => {
        const o = outcomes.get(r.outcome_code);
        return {
          ...r,
          module_code: o?.module_code ?? "—",
          outcome_name: o?.outcome_name ?? r.outcome_code,
          part_name: o?.part_name ?? null,
          policy_title: policies.find((p) => p.id === r.linked_policy_id)?.title ?? null,
          owner_name: staff.find((s) => s.id === r.owner_id)?.full_name ?? null,
          linked_count: counts.get(r.id) ?? 0,
        } as Row;
      }).sort((a, b) => a.outcome_code.localeCompare(b.outcome_code, undefined, { numeric: true }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch, action }: { id: string; patch: Record<string, any>; action: string }) => {
      const { error: err } = await supabase.from("evidence_requirements" as any).update(patch).eq("id", id);
      if (err) throw err;
      await logAudit({ action, module: "evidence_matrix", record_id: id, details: patch });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence-requirements"] });
      toast({ title: "Requirement updated", description: "Change recorded in the audit log." });
      setSelected(null);
    },
    onError: (e: any) => toast({ title: "Update blocked", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (moduleFilter === "all" || r.module_code === moduleFilter) &&
          (statusFilter === "all" || derivedStatus(r) === statusFilter)
      ),
    [rows, moduleFilter, statusFilter]
  );

  const summary = summariseMatrix(filtered);

  const handleExport = async () => {
    const csv = buildEvidencePackCSV(filtered);
    downloadCSV(csv, `evidence-pack-${moduleFilter}-${new Date().toISOString().split("T")[0]}.csv`);
    await logAudit({
      action: "Exported evidence pack",
      module: "evidence_matrix",
      details: { module: moduleFilter, status: statusFilter, rows: filtered.length },
    });
    toast({ title: "Evidence pack exported", description: "Export recorded in the audit log." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Practice Standards Evidence Matrix</h1>
          <p className="text-muted-foreground">
            Module → outcome → required evidence → linked policy → linked records → owner → review
          </p>
        </div>
        <Button onClick={handleExport} className="touch-target" disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Export evidence pack
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Audit readiness only — requires human review</AlertTitle>
        <AlertDescription>
          This matrix records the evidence your organisation holds. It does not determine or state NDIS compliance,
          certification or registration approval. Every outcome must be reviewed and signed off by an authorised person
          before audit.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Requirements", value: summary.total },
          { label: "Evidence ready", value: summary.ready },
          { label: "In progress", value: summary.inProgress },
          { label: "Missing", value: summary.missing },
          { label: "Review overdue", value: summary.overdue },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="module-filter">Module</Label>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger id="module-filter" className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {modules.map((m) => (
                <SelectItem key={m.code} value={m.code}>
                  {m.name}{m.is_conditional ? " (conditional)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="status-filter">Evidence status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="status-filter" className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(EVIDENCE_STATUS_LABEL) as EvidenceStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{EVIDENCE_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evidence requirements</CardTitle>
          <CardDescription>Select a row to record evidence, owner, review date and auditor notes.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-center text-muted-foreground">Loading evidence matrix…</p>
          ) : error ? (
            <p className="py-6 text-center text-destructive">Could not load the evidence matrix. Please retry.</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">No requirements match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <caption className="sr-only">Practice standards evidence requirements and their evidence status</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Outcome</TableHead>
                    <TableHead scope="col">Requirement</TableHead>
                    <TableHead scope="col">Required evidence</TableHead>
                    <TableHead scope="col">Policy</TableHead>
                    <TableHead scope="col">Records</TableHead>
                    <TableHead scope="col">Owner</TableHead>
                    <TableHead scope="col">Review</TableHead>
                    <TableHead scope="col">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open ${r.outcome_code} ${r.requirement_title}`}
                      className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted"
                      onClick={() => setSelected(r)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(r); } }}
                    >
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{r.outcome_code}</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">{r.module_code}</p>
                      </TableCell>
                      <TableCell className="max-w-xs">{r.requirement_title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.required_evidence_type}</TableCell>
                      <TableCell className="text-sm">{r.policy_title ?? <span className="text-muted-foreground">Not linked</span>}</TableCell>
                      <TableCell className="text-sm">{r.linked_count ?? 0}</TableCell>
                      <TableCell className="text-sm">{r.owner_name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                      <TableCell className="text-sm">{r.review_date ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={derivedStatus(r)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RequirementSheet
        row={selected}
        open={!!selected}
        canEdit={canEdit}
        policies={policies}
        staff={staff}
        onClose={() => setSelected(null)}
        onSave={(patch, action) => selected && updateMutation.mutate({ id: selected.id, patch, action })}
        saving={updateMutation.isPending}
      />
    </div>
  );
}

function RequirementSheet({
  row, open, canEdit, policies, staff, onClose, onSave, saving,
}: {
  row: Row | null;
  open: boolean;
  canEdit: boolean;
  policies: { id: string; title: string; current_version: number }[];
  staff: { id: string; full_name: string }[];
  onClose: () => void;
  onSave: (patch: Record<string, any>, action: string) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, any>>({});
  const key = row?.id ?? "none";
  const value = <K extends keyof Row>(k: K) => (k in draft ? draft[k as string] : row?.[k]);

  const pending: Row | null = row ? ({ ...row, ...draft } as Row) : null;
  const blockers = pending ? readyBlockers(pending, new Date()) : [];

  return (
    <Sheet key={key} open={open} onOpenChange={(o) => { if (!o) { setDraft({}); onClose(); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle>
                {row.outcome_code} — {row.outcome_name}
              </SheetTitle>
              <SheetDescription>{row.part_name ?? row.module_code}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold">Requirement</h3>
                <p className="text-sm text-muted-foreground">{row.requirement_title}</p>
                {row.quality_indicator && (
                  <p className="mt-2 text-sm"><span className="font-medium">Quality indicator: </span>{row.quality_indicator}</p>
                )}
                <p className="mt-2 text-sm"><span className="font-medium">Required evidence: </span>{row.required_evidence_type}</p>
                <p className="mt-2 text-sm"><span className="font-medium">Linked evidence records: </span>{row.linked_count ?? 0}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="req-policy">Linked policy</Label>
                <Select
                  disabled={!canEdit}
                  value={(value("linked_policy_id") as string) ?? "__none__"}
                  onValueChange={(v) => setDraft((d) => ({ ...d, linked_policy_id: v === "__none__" ? null : v }))}
                >
                  <SelectTrigger id="req-policy"><SelectValue placeholder="Select a policy" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not linked</SelectItem>
                    {policies.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.title} (v{p.current_version})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="req-owner">Owner</Label>
                <Select
                  disabled={!canEdit}
                  value={(value("owner_id") as string) ?? "__none__"}
                  onValueChange={(v) => setDraft((d) => ({ ...d, owner_id: v === "__none__" ? null : v }))}
                >
                  <SelectTrigger id="req-owner"><SelectValue placeholder="Assign an owner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="req-review">Review date</Label>
                <Input
                  id="req-review"
                  type="date"
                  disabled={!canEdit}
                  value={(value("review_date") as string) ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, review_date: e.target.value || null }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="req-status">Evidence status</Label>
                <Select
                  disabled={!canEdit}
                  value={(value("status") as string) ?? "missing"}
                  onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                >
                  <SelectTrigger id="req-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVIDENCE_STATUS_LABEL) as EvidenceStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{EVIDENCE_STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(value("status") as string) === "ready" && blockers.length > 0 && (
                <Alert variant="destructive" role="alert">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <AlertTitle>Cannot mark as evidence ready</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {blockers.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="req-notes">Auditor notes</Label>
                <Textarea
                  id="req-notes"
                  disabled={!canEdit}
                  value={(value("auditor_notes") as string) ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, auditor_notes: e.target.value }))}
                  placeholder="Notes for the auditor about how this evidence is held and maintained."
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="req-export"
                  disabled={!canEdit}
                  checked={Boolean(value("include_in_export"))}
                  onCheckedChange={(c) => setDraft((d) => ({ ...d, include_in_export: c === true }))}
                />
                <Label htmlFor="req-export">Include in evidence pack export</Label>
              </div>

              {canEdit ? (
                <Button
                  className="w-full"
                  disabled={saving || ((value("status") as string) === "ready" && blockers.length > 0)}
                  onClick={() => onSave(draft, `Updated evidence requirement ${row.outcome_code}`)}
                >
                  {saving ? "Saving…" : "Save requirement"}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Read-only. Only compliance officers and administrators can record evidence status.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
