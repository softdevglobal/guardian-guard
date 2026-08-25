import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import {
  EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, ReadOnlyNotice, StatusPill,
} from "@/components/compliance/GateUI";
import { RecordSheet, type FieldDef } from "@/components/compliance/RecordSheet";
import { toOptions, useStaff, withOrg } from "@/hooks/useComplianceLookups";
import {
  CAPA_PRIORITIES, CAPA_SOURCES, CAPA_STATUSES, capaBlockers, capaSummary, closureRate, isOverdue, labelValue,
} from "@/lib/correctiveActions";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function CorrectiveActions() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canEdit = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer", "supervisor", "executive"]);
  const { data: staff = [] } = useStaff();
  const [sheet, setSheet] = useState<{ open: boolean; initial?: Record<string, any> }>({ open: false });
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["corrective-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corrective_actions" as any)
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["capa-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organisation_documents" as any)
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const payload = withOrg(values, user?.organisation_id, user?.id);
      if (values.id) {
        const { id, created_at, updated_at, organisation_id, created_by, ...rest } = payload;
        const { error } = await supabase.from("corrective_actions" as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("corrective_actions" as any).insert(payload);
        if (error) throw error;
      }
      await logAudit({ action: values.id ? "updated" : "created", module: "corrective_actions", record_id: values.id ?? undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corrective-actions"] });
      qc.invalidateQueries({ queryKey: ["compliance-calendar"] });
      toast({ title: "Saved", description: "The corrective action has been written to the audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked by the compliance engine", description: e.message }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (statusFilter === "overdue" ? !isOverdue(r) : statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !`${r.action} ${r.reference ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, statusFilter, search]);

  const summary = capaSummary(data);

  const fields: FieldDef[] = [
    { name: "action", label: "Corrective action", type: "textarea", required: true, help: "What will change, specifically." },
    { name: "description", label: "Finding or root cause", type: "textarea" },
    { name: "reference", label: "Reference", type: "text", help: "Optional internal reference, e.g. CA-2026-014." },
    { name: "source_type", label: "Raised from", type: "select", required: true, options: CAPA_SOURCES.map((v) => ({ value: v, label: labelValue(v) })) },
    { name: "owner_id", label: "Accountable owner", type: "select", required: true, options: toOptions(staff) },
    { name: "priority", label: "Priority", type: "select", required: true, options: CAPA_PRIORITIES.map((v) => ({ value: v, label: labelValue(v) })) },
    { name: "due_date", label: "Due date", type: "date", required: true },
    { name: "status", label: "Status", type: "select", required: true, options: CAPA_STATUSES.map((v) => ({ value: v, label: labelValue(v) })) },
    { name: "evidence_required", label: "Evidence is required to close", type: "checkbox" },
    {
      name: "evidence_document_id", label: "Evidence document", type: "select",
      options: documents.map((d) => ({ value: d.id, label: d.title })),
      showIf: (v) => !!v.evidence_required,
    },
    { name: "evidence_notes", label: "Evidence notes", type: "textarea", showIf: (v) => !!v.evidence_required },
    { name: "closure_notes", label: "Closure notes", type: "textarea", showIf: (v) => v.status === "complete" },
    {
      name: "approved_by", label: "Approved by", type: "select", options: toOptions(staff),
      showIf: (v) => v.status === "complete" || v.status === "awaiting_approval",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Corrective actions"
        description="One register for every corrective and preventative action raised from audits, incidents, complaints, risks, policy reviews and Guardian Guard reviews. Closure requires evidence and approval."
        actions={
          canEdit ? (
            <Button className="min-h-[44px]" onClick={() => setSheet({ open: true, initial: { status: "open", priority: "medium", source_type: "internal" } })}>
              Raise corrective action
            </Button>
          ) : undefined
        }
      />

      {isMockAudit && <ReadOnlyNotice reason="Mock audit mode is on — the register is read only while an auditor is reviewing it." />}
      <HumanReviewNotice>
        Closure rates are operational metrics. They do not determine compliance with the NDIS Practice Standards — an authorised person must review each closed action.
      </HumanReviewNotice>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Open actions" value={String(summary.open)} />
        <Metric label="Overdue" value={String(summary.overdue)} hint="Past the recorded due date" />
        <Metric label="Awaiting approval" value={String(summary.awaitingApproval)} />
        <Metric label="Complete" value={String(summary.complete)} />
        <Metric label="Closure rate" value={`${closureRate(data)}%`} hint="Requires human review" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="capa-search">Search</Label>
            <Input id="capa-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Action or reference" className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="capa-status">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="capa-status" className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="overdue">Overdue only</SelectItem>
                {CAPA_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{labelValue(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          title="No corrective actions"
          description="Raise an action whenever an audit, incident, complaint, risk or review identifies something that has to change."
        />
      )}

      {filtered.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Raised from</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-sm">
                      <p className="font-medium">{r.action}</p>
                      {r.reference && <p className="text-xs text-muted-foreground">{r.reference}</p>}
                    </TableCell>
                    <TableCell>{labelValue(r.source_type)}</TableCell>
                    <TableCell>{staff.find((s) => s.id === r.owner_id)?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{r.due_date ?? "—"}</span>
                        {isOverdue(r) && <StatusPill tone="bad">Overdue</StatusPill>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={r.priority === "critical" || r.priority === "high" ? "bad" : "neutral"}>{labelValue(r.priority)}</StatusPill>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={r.status === "complete" ? "ok" : r.status === "awaiting_approval" ? "warn" : "neutral"}>
                        {labelValue(r.status)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="min-h-[36px]" onClick={() => setSheet({ open: true, initial: r })}>
                        {canEdit ? "Update" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <RecordSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        title={sheet.initial?.id ? "Update corrective action" : "Raise corrective action"}
        description="Actions cannot be completed without closure notes, the required evidence and an approver."
        fields={fields}
        initial={sheet.initial}
        blockers={capaBlockers}
        readOnly={!canEdit}
        readOnlyReason="Your role can view the register but not change it."
        onSubmit={async (values) => {
          await save.mutateAsync({
            ...values,
            approved_at: values.status === "complete" ? new Date().toISOString() : null,
          });
        }}
      />
    </div>
  );
}
