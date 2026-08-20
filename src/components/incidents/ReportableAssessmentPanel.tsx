import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import {
  EmptyState, ErrorState, HumanReviewNotice, LoadingState, StatusPill,
} from "@/components/compliance/GateUI";
import { RecordSheet, type FieldDef } from "@/components/compliance/RecordSheet";
import { reportableAssessmentBlockers } from "@/lib/complianceGates";

/**
 * Reportable incident assessment is a human decision. The panel records the assessor's
 * reasoning and the notification reference; it never decides reportability by itself.
 */
export function ReportableAssessmentPanel() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canAssess = !isMockAudit && hasRole(["super_admin", "compliance_officer"]);
  const [sheet, setSheet] = useState<Record<string, any> | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reportable-assessments"],
    queryFn: async () => {
      const [incidents, assessments] = await Promise.all([
        supabase
          .from("incidents")
          .select("id, incident_number, title, severity, category, status, is_reportable, occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(200),
        supabase.from("reportable_incident_assessments" as any).select("*").order("created_at", { ascending: false }),
      ]);
      if (incidents.error) throw incidents.error;
      if (assessments.error) throw assessments.error;
      return { incidents: (incidents.data as any[]) ?? [], assessments: (assessments.data as any[]) ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const payload: Record<string, any> = {
        ...values,
        organisation_id: user?.organisation_id,
        assessed_by: user?.id,
        assessed_at: new Date().toISOString(),
      };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "" || payload[k] === undefined) payload[k] = null;
      });
      if (values.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("reportable_incident_assessments" as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reportable_incident_assessments" as any).insert(payload);
        if (error) throw error;
      }
      await logAudit({
        action: "reportable_assessment_recorded",
        module: "reportable_incident_assessments",
        record_id: values.incident_id,
        severity: "high",
        details: { decision: values.decision },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reportable-assessments"] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
      toast({ title: "Assessment recorded", description: "The decision and its rationale were written to the audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked by the compliance engine", description: e.message }),
  });

  const assessmentFor = (incidentId: string) => data?.assessments.find((a) => a.incident_id === incidentId);
  const candidates = (data?.incidents ?? []).filter(
    (i) => i.is_reportable || ["high", "critical"].includes(i.severity) || ["abuse_allegation", "neglect_concern"].includes(i.category),
  );
  const outstanding = candidates.filter((i) => !assessmentFor(i.id));

  const fields: FieldDef[] = [
    {
      name: "decision", label: "Assessment decision", type: "select", required: true,
      options: [
        { value: "reportable", label: "Reportable to the NDIS Commission" },
        { value: "not_reportable", label: "Not reportable" },
      ],
    },
    { name: "decision_rationale", label: "Rationale for the decision", type: "textarea", required: true },
    { name: "evidence", label: "Evidence considered", type: "textarea", required: true },
    { name: "due_at", label: "Notification due", type: "datetime", showIf: (v) => v.decision === "reportable" },
    { name: "notified_at", label: "Notification submitted at", type: "datetime", showIf: (v) => v.decision === "reportable" },
    { name: "notification_reference", label: "Notification reference", type: "text", showIf: (v) => v.decision === "reportable" },
  ];

  const blockers = (v: Record<string, any>) => {
    const out = reportableAssessmentBlockers({
      decision: v.decision,
      rationale: v.decision_rationale,
      evidence: v.evidence,
      assessorRole: canAssess ? (user?.role as any) : null,
    });
    if (v.decision === "reportable" && !v.due_at) out.push("A reportable decision requires a notification due date and time.");
    if (v.notified_at && !String(v.notification_reference ?? "").trim()) {
      out.push("Record the notification reference once a notification has been submitted.");
    }
    return out;
  };

  return (
    <div className="space-y-4">
      <HumanReviewNotice>
        Reportability is assessed by an authorised person. The system flags candidate incidents and blocks closure until an
        assessment has been recorded — it does not classify an incident as reportable and does not submit notifications.
      </HumanReviewNotice>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Candidate incidents</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{candidates.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Awaiting human assessment</CardDescription></CardHeader><CardContent className="text-2xl font-semibold text-destructive">{outstanding.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Assessed as reportable</CardDescription></CardHeader><CardContent className="text-2xl font-semibold">{(data?.assessments ?? []).filter((a) => a.decision === "reportable").length}</CardContent></Card>
      </div>

      {error ? <ErrorState error={error} /> : isLoading ? <LoadingState /> : candidates.length === 0 ? (
        <EmptyState title="No incidents require a reportability assessment" description="High severity, abuse and neglect incidents appear here for human assessment." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead><TableHead>Severity</TableHead><TableHead>Assessment</TableHead>
                <TableHead>Notified</TableHead><TableHead className="w-32">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((i) => {
                const a = assessmentFor(i.id);
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="font-medium">{i.title}</div>
                      <div className="text-xs text-muted-foreground">{i.incident_number}</div>
                    </TableCell>
                    <TableCell><StatusPill tone={["high", "critical"].includes(i.severity) ? "bad" : "warn"}>{i.severity}</StatusPill></TableCell>
                    <TableCell>
                      {a ? <StatusPill tone={a.decision === "reportable" ? "bad" : a.decision === "not_reportable" ? "ok" : "warn"}>{String(a.decision).replace(/_/g, " ")}</StatusPill>
                        : <StatusPill tone="warn">Requires human review</StatusPill>}
                    </TableCell>
                    <TableCell>{a?.notified_at ? new Date(a.notified_at).toLocaleString() : "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" disabled={!canAssess} onClick={() => setSheet(a ?? { incident_id: i.id })}>
                        {a ? "Open" : "Assess"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {sheet && (
        <RecordSheet
          open
          onOpenChange={(o) => !o && setSheet(null)}
          title="Reportable incident assessment"
          description="Records the authorised assessor's decision, rationale and any notification reference."
          fields={fields}
          initial={sheet}
          blockers={blockers}
          readOnly={!canAssess}
          readOnlyReason="Only a compliance officer or administrator can record a reportability assessment, and mock audit mode is read only."
          submitLabel="Record assessment"
          onSubmit={async (values) => {
            await save.mutateAsync({ ...values, incident_id: sheet.incident_id });
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
