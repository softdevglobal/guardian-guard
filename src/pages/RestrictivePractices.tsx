import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import {
  EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill,
} from "@/components/compliance/GateUI";
import { RecordSheet, type FieldDef } from "@/components/compliance/RecordSheet";
import { toOptions, useParticipants, withOrg } from "@/hooks/useComplianceLookups";

export default function RestrictivePractices() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canEdit = !isMockAudit && hasRole(["super_admin", "compliance_officer", "supervisor"]);
  const canAuthorise = !isMockAudit && hasRole(["super_admin", "compliance_officer"]);
  const { data: participants = [] } = useParticipants();
  const [sheet, setSheet] = useState<Record<string, any> | null>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["restrictive-practices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restrictive_practices" as any)
        .select("*")
        .eq("record_status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const payload = withOrg(values, user?.organisation_id, user?.id);
      if (values.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("restrictive_practices" as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("restrictive_practices" as any).insert(payload);
        if (error) throw error;
      }
      await logAudit({
        action: values.id ? "updated" : "created",
        module: "restrictive_practices",
        record_id: values.id ?? undefined,
        severity: "high",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restrictive-practices"] });
      toast({ title: "Saved", description: "The restrictive practice record was written to the audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked by the compliance engine", description: e.message }),
  });

  const participantName = (id: string) => participants.find((p) => p.id === id)?.full_name ?? "Restricted";
  const today = new Date().toISOString().split("T")[0];

  const stats = useMemo(() => ({
    total: rows.length,
    unauthorised: rows.filter((r) => !r.is_authorised).length,
    expiring: rows.filter((r) => r.authorisation_expiry && r.authorisation_expiry <= today).length,
    reviewDue: rows.filter((r) => r.review_date && r.review_date <= today).length,
  }), [rows, today]);

  const fields: FieldDef[] = [
    { name: "participant_id", label: "Participant", type: "select", required: true, options: toOptions(participants) },
    {
      name: "practice_type", label: "Practice type", type: "select", required: true,
      options: ["seclusion", "chemical_restraint", "mechanical_restraint", "physical_restraint", "environmental_restraint"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
    { name: "description", label: "Description of the practice used", type: "textarea", required: true },
    { name: "least_restrictive_review", label: "Why this is the least restrictive option available", type: "textarea", required: true },
    { name: "behaviour_support_plan_url", label: "Behaviour support plan reference", type: "text", required: true },
    { name: "behaviour_support_practitioner", label: "Behaviour support practitioner", type: "text", required: true },
    {
      name: "is_authorised", label: "Authorisation is in place", type: "checkbox",
      help: "Tick only when a person with authority has confirmed a valid state or territory authorisation. The system cannot verify this.",
    },
    { name: "authorisation_reference", label: "Authorisation reference", type: "text", showIf: (v) => !!v.is_authorised },
    { name: "authorisation_expiry", label: "Authorisation expiry", type: "date", showIf: (v) => !!v.is_authorised },
    { name: "reduction_plan", label: "Reduction and elimination plan", type: "textarea", required: true },
    { name: "reporting_actions", label: "Reporting actions taken", type: "textarea", required: true },
    { name: "review_date", label: "Next review date", type: "date", required: true },
    {
      name: "status", label: "Status", type: "select", required: true,
      options: ["proposed", "authorised", "in_use", "under_review", "ceased"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
  ];

  const blockers = (v: Record<string, any>) => {
    const out: string[] = [];
    if (["authorised", "in_use"].includes(v.status)) {
      if (!v.is_authorised) out.push("An authorised or in-use practice requires a recorded authorisation confirmed by a person with authority.");
      if (!String(v.authorisation_reference ?? "").trim()) out.push("An authorisation reference is required.");
      if (!v.authorisation_expiry) out.push("An authorisation expiry date is required.");
      if (!String(v.behaviour_support_plan_url ?? "").trim()) out.push("A behaviour support plan must be linked before a practice is used.");
      if (!canAuthorise) out.push("Only a compliance officer or administrator can move a practice into an authorised or in-use state.");
    }
    return out;
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Restrictive practices register"
        description="Regulated restrictive practices require a behaviour support plan, an authorisation confirmed by a person with authority, and a reduction plan. This register records that evidence — it does not grant or verify authorisation."
        actions={<Button onClick={() => setSheet({})} disabled={!canEdit}>Register a practice</Button>}
      />
      <HumanReviewNotice>
        Every entry in this register requires human authorisation under the applicable state or territory framework. The system blocks
        unauthorised entries from being marked as in use, but it cannot confirm that an authorisation is valid.
      </HumanReviewNotice>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Registered practices</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{stats.total}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Without authorisation</CardDescription></CardHeader><CardContent className="text-2xl font-semibold text-destructive">{stats.unauthorised}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Authorisation expired</CardDescription></CardHeader><CardContent className="text-2xl font-semibold text-warning">{stats.expiring}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Review due</CardDescription></CardHeader><CardContent className="text-2xl font-semibold text-warning">{stats.reviewDue}</CardContent></Card>
      </div>

      {error ? <ErrorState error={error} /> : isLoading ? <LoadingState /> : rows.length === 0 ? (
        <EmptyState title="No restrictive practices registered" description="An empty register is expected where no regulated restrictive practice is used." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead>
                <TableHead>Authorisation</TableHead><TableHead>Expiry</TableHead><TableHead>Review</TableHead><TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{participantName(r.participant_id)}</TableCell>
                  <TableCell>{String(r.practice_type).replace(/_/g, " ")}</TableCell>
                  <TableCell><StatusPill tone={r.status === "ceased" ? "neutral" : r.status === "in_use" ? "warn" : "neutral"}>{String(r.status).replace(/_/g, " ")}</StatusPill></TableCell>
                  <TableCell>{r.is_authorised ? <StatusPill tone="ok">{r.authorisation_reference || "Recorded"}</StatusPill> : <StatusPill tone="bad">Not authorised</StatusPill>}</TableCell>
                  <TableCell>{r.authorisation_expiry ?? "—"}</TableCell>
                  <TableCell>{r.review_date ?? "—"}</TableCell>
                  <TableCell><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setSheet(r)}>Open</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {sheet && (
        <RecordSheet
          open
          onOpenChange={(o) => !o && setSheet(null)}
          title="Restrictive practice"
          description="Records the practice, its authorisation evidence, and the plan to reduce and eliminate its use."
          fields={fields}
          initial={sheet}
          blockers={blockers}
          readOnly={!canEdit}
          readOnlyReason="Mock audit mode or your role prevents changes."
          onSubmit={async (values) => {
            const extra = values.is_authorised && canAuthorise
              ? { authorised_by: values.authorised_by ?? user?.id, authorised_at: values.authorised_at ?? new Date().toISOString() }
              : {};
            await save.mutateAsync({ ...values, ...extra });
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
