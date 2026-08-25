import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import {
  BlockerAlert, EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill,
} from "@/components/compliance/GateUI";
import { RecordSheet, type FieldDef } from "@/components/compliance/RecordSheet";
import { toOptions, useParticipants, useStaff, withOrg } from "@/hooks/useComplianceLookups";
import {
  agreementSignBlockers, mealtimeRosterBlockers,
  supportPlanActivationBlockers, workerAssignmentBlockers, type Role,
} from "@/lib/complianceGates";

type Entity =
  | "participant_consents" | "service_agreements" | "support_plans"
  | "participant_risk_assessments" | "participant_continuity_plans" | "worker_assignments"
  | "mealtime_profiles" | "participant_concerns";

const YES_NO = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

export default function ParticipantCare() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const role = (user?.role ?? "support_worker") as Role;
  const canEdit = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer", "supervisor", "trainer"]);
  const readOnlyReason = isMockAudit
    ? "Mock audit mode is active — records are locked."
    : "Your role can view these records but cannot change them.";

  const { data: participants = [], isLoading: loadingParticipants } = useParticipants();
  const { data: staff = [] } = useStaff();
  const [participantId, setParticipantId] = useState<string>("");
  const selected = participants.find((p) => p.id === participantId);
  const [sheet, setSheet] = useState<{ entity: Entity; initial?: Record<string, any> } | null>(null);

  const tables: Entity[] = [
    "participant_consents", "service_agreements", "support_plans",
    "participant_risk_assessments", "participant_continuity_plans", "worker_assignments",
    "mealtime_profiles", "participant_concerns",
  ];

  const { data, isLoading, error } = useQuery({
    queryKey: ["participant-care", participantId],
    enabled: !!participantId,
    queryFn: async () => {
      const results = await Promise.all(
        tables.map((t) =>
          supabase.from(t as any).select("*").eq("participant_id", participantId).order("created_at", { ascending: false })
        )
      );
      const out: Record<Entity, any[]> = {} as any;
      results.forEach((r, i) => {
        if (r.error) throw r.error;
        out[tables[i]] = (r.data as any[]) ?? [];
      });
      return out;
    },
  });

  const { data: workerTraining = [] } = useQuery({
    queryKey: ["worker-training-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_completions")
        .select("user_id, training_code, status, verified_by, expiry_date");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: eligibility = [] } = useQuery({
    queryKey: ["staff-eligibility-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_eligibility_status")
        .select("staff_id, is_eligible_for_assignment, reason_summary");
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async ({ entity, values }: { entity: Entity; values: Record<string, any> }) => {
      const payload = withOrg({ ...values, participant_id: participantId }, (user as any)?.organisation_id ?? selected?.organisation_id, user?.id);
      if (values.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from(entity as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(entity as any).insert(payload);
        if (error) throw error;
      }
      await logAudit({
        action: values.id ? "updated" : "created",
        module: entity,
        record_id: values.id ?? undefined,
        details: { participant_id: participantId },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["participant-care", participantId] });
      toast({ title: "Record saved", description: "The change has been written to the audit trail." });
    },
    onError: (e: any) =>
      toast({ variant: "destructive", title: "Blocked by the compliance engine", description: e.message }),
  });

  const consentGranted = selected?.consent_status === "granted";
  const activeAgreements = (data?.service_agreements ?? []).filter((a) => a.status === "active");
  const activePlans = (data?.support_plans ?? []).filter((p) => p.status === "active");
  const mealtimePlan = (data?.mealtime_profiles ?? []).find((m) => m.status === "active");

  const fieldsFor = (entity: Entity): FieldDef[] => {
    switch (entity) {
      case "participant_consents":
        return [
          { name: "purpose_collection", label: "Why information is collected", type: "textarea", required: true },
          { name: "purpose_use", label: "How information is used", type: "textarea", required: true },
          { name: "purpose_disclosure", label: "Who information is disclosed to", type: "textarea", required: true },
          { name: "communication_preference", label: "Communication preference", type: "text", required: true },
          { name: "accessible_format", label: "Accessible format provided", type: "text", help: "Easy Read, large print, interpreter, Auslan…" },
          { name: "interpreter_required", label: "Interpreter required", type: "checkbox" },
          { name: "nominee_name", label: "Nominee name", type: "text" },
          { name: "nominee_relationship", label: "Nominee relationship", type: "text" },
          { name: "nominee_contact", label: "Nominee contact", type: "text" },
          { name: "advocate_name", label: "Advocate name", type: "text" },
          { name: "advocate_contact", label: "Advocate contact", type: "text" },
          {
            name: "consent_status", label: "Consent status", type: "select", required: true,
            options: [
              { value: "granted", label: "Granted" },
              { value: "pending", label: "Pending" },
              { value: "withdrawn", label: "Withdrawn" },
            ],
          },
          { name: "notes", label: "Notes", type: "textarea" },
        ];
      case "service_agreements":
        return [
          { name: "agreement_number", label: "Agreement number", type: "text", required: true },
          {
            name: "status", label: "Status", type: "select", required: true,
            options: ["draft", "signed", "active", "ended"].map((v) => ({ value: v, label: v })),
          },
          { name: "support_items", label: "Supports and items", type: "textarea", required: true },
          { name: "price_notes", label: "Pricing notes", type: "textarea" },
          { name: "start_date", label: "Start date", type: "date", required: true },
          { name: "end_date", label: "End date", type: "date" },
          { name: "cancellation_terms", label: "Cancellation terms", type: "textarea", required: true },
          { name: "emergency_continuity_arrangement", label: "Emergency and continuity arrangement", type: "textarea", required: true },
          { name: "complaints_path", label: "Complaints pathway explained", type: "textarea", required: true },
          { name: "advocate_rights_acknowledged", label: "Advocate and representation rights explained and acknowledged", type: "checkbox" },
          { name: "privacy_notice_acknowledged", label: "Privacy notice provided and acknowledged", type: "checkbox" },
          { name: "accessible_format_provided", label: "Accessible format provided", type: "checkbox" },
          { name: "signature_method", label: "Signature method", type: "text", help: "Required before the agreement can be signed or active." },
          { name: "signed_by_name", label: "Signed by (name)", type: "text" },
          { name: "signed_at", label: "Signed at", type: "datetime" },
          { name: "signed_copy_url", label: "Signed copy URL", type: "text" },
        ];
      case "support_plans":
        return [
          { name: "goals", label: "Goals", type: "textarea", required: true },
          { name: "strengths", label: "Strengths", type: "textarea" },
          { name: "preferences", label: "Preferences", type: "textarea" },
          { name: "culture_values_beliefs", label: "Culture, values and beliefs", type: "textarea" },
          { name: "communication_method", label: "Communication method", type: "textarea", required: true },
          { name: "decision_making_supports", label: "Supported decision making arrangements", type: "textarea" },
          { name: "support_network_permissions", label: "Support network and permissions", type: "textarea" },
          { name: "health_contacts", label: "Health contacts", type: "textarea" },
          { name: "emergency_contacts", label: "Emergency contacts", type: "textarea" },
          { name: "daily_support_needs", label: "Daily support needs", type: "textarea" },
          { name: "community_participation", label: "Community participation", type: "textarea" },
          { name: "review_due_date", label: "Review due date", type: "date", required: true },
          { name: "participant_involved", label: "Participant was involved in developing this plan", type: "checkbox" },
          {
            name: "status", label: "Status", type: "select", required: true,
            options: ["draft", "active", "superseded"].map((v) => ({ value: v, label: v })),
          },
        ];
      case "participant_risk_assessments":
        return [
          { name: "risk_description", label: "Risk description", type: "textarea", required: true },
          { name: "likelihood_score", label: "Likelihood (1-5)", type: "number", required: true },
          { name: "consequence_score", label: "Consequence (1-5)", type: "number", required: true },
          { name: "existing_controls", label: "Existing controls", type: "textarea", required: true },
          { name: "escalation_pathway", label: "Escalation pathway", type: "textarea", required: true },
          { name: "person_consulted", label: "Participant or representative consulted", type: "text", required: true },
          { name: "review_date", label: "Review date", type: "date", required: true },
          {
            name: "status", label: "Status", type: "select", required: true,
            options: ["open", "monitoring", "closed"].map((v) => ({ value: v, label: v })),
          },
        ];
      case "participant_continuity_plans":
        return [
          { name: "critical_supports", label: "Critical supports that cannot be interrupted", type: "textarea", required: true },
          { name: "alternative_worker_id", label: "Alternative worker", type: "select", options: toOptions(staff) },
          { name: "alternative_provider", label: "Alternative provider", type: "text" },
          { name: "evacuation_requirements", label: "Evacuation requirements", type: "textarea", required: true },
          { name: "communication_requirements", label: "Communication requirements in an emergency", type: "textarea", required: true },
          { name: "last_tested_date", label: "Last tested", type: "date" },
          { name: "test_notes", label: "Test notes", type: "textarea" },
          { name: "review_date", label: "Review date", type: "date", required: true },
        ];
      case "worker_assignments":
        return [
          { name: "worker_id", label: "Worker", type: "select", required: true, options: toOptions(staff) },
          { name: "role_on_team", label: "Role on the support team", type: "text", required: true },
          { name: "plan_briefing_completed", label: "Worker has been briefed on the participant's support plan", type: "checkbox" },
          {
            name: "briefing_support_plan_id", label: "Support plan used for the briefing", type: "select",
            options: activePlans.map((p) => ({ value: p.id, label: `Version ${p.version_number}` })),
          },
          { name: "plan_briefing_date", label: "Briefing date", type: "date" },
          { name: "start_date", label: "Start date", type: "date", required: true },
          {
            name: "status", label: "Status", type: "select", required: true,
            options: ["pending", "active", "ended"].map((v) => ({ value: v, label: v })),
          },
        ];
      case "mealtime_profiles":
        return [
          { name: "mealtime_support_required", label: "Mealtime support is required", type: "checkbox" },
          { name: "practitioner_plan_url", label: "Practitioner mealtime plan URL", type: "text", required: true },
          { name: "plan_practitioner", label: "Practitioner name", type: "text", required: true },
          { name: "texture_modification", label: "Texture modification", type: "text" },
          { name: "fluid_consistency", label: "Fluid consistency", type: "text" },
          { name: "allergies", label: "Allergies", type: "textarea" },
          { name: "identified_risks", label: "Identified risks", type: "textarea", required: true },
          { name: "seating_positioning", label: "Seating and positioning", type: "textarea" },
          { name: "choking_emergency_response", label: "Choking emergency response", type: "textarea", required: true },
          { name: "required_competency_code", label: "Required competency code", type: "text", required: true, help: "Workers must hold current verified training with this code." },
          { name: "plan_review_date", label: "Plan review date", type: "date", required: true },
          {
            name: "status", label: "Status", type: "select", required: true,
            options: ["draft", "active", "archived"].map((v) => ({ value: v, label: v })),
          },
        ];
      case "participant_concerns":
        return [
          { name: "concern", label: "Concern raised", type: "textarea", required: true },
          { name: "support_requested", label: "Support requested", type: "textarea" },
          { name: "anonymous", label: "Recorded anonymously", type: "checkbox" },
          { name: "advocacy_referral", label: "Referred to an advocate", type: "checkbox" },
          { name: "no_retaliation_acknowledged", label: "Non-retaliation commitment explained and acknowledged", type: "checkbox" },
          {
            name: "status", label: "Status", type: "select", required: true,
            options: ["open", "in_progress", "resolved", "escalated_to_complaint"].map((v) => ({ value: v, label: v })),
          },
          { name: "outcome", label: "Outcome", type: "textarea" },
        ];
    }
  };

  const blockersFor = (entity: Entity) => (values: Record<string, any>): string[] => {
    switch (entity) {
      case "service_agreements":
        return ["signed", "active"].includes(values.status) ? agreementSignBlockers(values) : [];
      case "support_plans":
        return values.status === "active" ? supportPlanActivationBlockers(values) : [];
      case "worker_assignments": {
        if (values.status !== "active") return [];
        const elig = eligibility.find((e) => e.staff_id === values.worker_id);
        return workerAssignmentBlockers({
          plan_briefing_completed: !!values.plan_briefing_completed,
          briefing_support_plan_id: values.briefing_support_plan_id,
          workerEligible: !!elig?.is_eligible_for_assignment,
          workerEligibilityReason: elig?.reason_summary,
        });
      }
      case "mealtime_profiles":
        return values.status === "active" && !values.practitioner_plan_url
          ? ["An assessed practitioner mealtime plan must be attached before the profile is active."]
          : [];
      default:
        return consentGranted ? [] : ["Consent is not granted for this participant — records cannot be added."];
    }
  };

  const rosterCheck = useMemo(() => {
    if (!mealtimePlan) return null;
    return (data?.worker_assignments ?? [])
      .filter((a) => a.status === "active")
      .map((a) => ({
        worker: staff.find((s) => s.id === a.worker_id)?.full_name ?? a.worker_id,
        blockers: mealtimeRosterBlockers({
          competencyCode: mealtimePlan.required_competency_code,
          training: workerTraining.filter((t) => t.user_id === a.worker_id),
          planActive: mealtimePlan.status === "active",
        }),
      }));
  }, [mealtimePlan, data, staff, workerTraining]);

  const TABS: { value: Entity; label: string; columns: { key: string; label: string }[] }[] = [
    { value: "participant_consents", label: "Consent", columns: [
      { key: "consent_version", label: "Version" }, { key: "consent_status", label: "Status" },
      { key: "communication_preference", label: "Communication" }, { key: "consent_date", label: "Recorded" },
    ]},
    { value: "service_agreements", label: "Agreements", columns: [
      { key: "agreement_number", label: "Number" }, { key: "status", label: "Status" },
      { key: "start_date", label: "Start" }, { key: "end_date", label: "End" }, { key: "signed_by_name", label: "Signed by" },
    ]},
    { value: "support_plans", label: "Support plans", columns: [
      { key: "version_number", label: "Version" }, { key: "status", label: "Status" }, { key: "review_due_date", label: "Review due" },
    ]},
    { value: "participant_risk_assessments", label: "Risk", columns: [
      { key: "risk_description", label: "Risk" }, { key: "risk_score", label: "Score" },
      { key: "risk_level", label: "Level" }, { key: "review_date", label: "Review" },
    ]},
    { value: "participant_continuity_plans", label: "Continuity", columns: [
      { key: "critical_supports", label: "Critical supports" }, { key: "last_tested_date", label: "Last tested" },
      { key: "review_date", label: "Review" },
    ]},
    { value: "worker_assignments", label: "Workers", columns: [
      { key: "worker_id", label: "Worker" }, { key: "role_on_team", label: "Role" },
      { key: "status", label: "Status" }, { key: "blocked_reason", label: "Blocked reason" },
    ]},
    { value: "mealtime_profiles", label: "Mealtime", columns: [
      { key: "status", label: "Status" }, { key: "texture_modification", label: "Texture" },
      { key: "required_competency_code", label: "Competency" }, { key: "plan_review_date", label: "Review" },
    ]},
    { value: "participant_concerns", label: "Concerns", columns: [
      { key: "concern", label: "Concern" }, { key: "status", label: "Status" }, { key: "advocacy_referral", label: "Advocate" },
    ]},
  ];

  const cell = (row: any, key: string) => {
    const v = row[key];
    if (key === "worker_id" || key === "alternative_worker_id") return staff.find((s) => s.id === v)?.full_name ?? "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (v === null || v === undefined || v === "") return "—";
    return String(v).length > 60 ? `${String(v).slice(0, 60)}…` : String(v);
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Participant care record"
        description="Onboarding, consent, service agreements, support planning, continuity and worker assignment evidence for each participant. Every gate below mirrors a database rule — the record is refused if the evidence is not there."
      />
      <HumanReviewNotice />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select a participant</CardTitle>
          <CardDescription>You can only see participants your role and assignments allow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingParticipants ? (
            <LoadingState rows={1} />
          ) : participants.length === 0 ? (
            <EmptyState title="No participants available" description="No participant records are visible to your role." />
          ) : (
            <div className="max-w-md space-y-1.5">
              <Label htmlFor="participant-select">Participant</Label>
              <Select value={participantId} onValueChange={setParticipantId}>
                <SelectTrigger id="participant-select">
                  <SelectValue placeholder="Choose a participant" />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.participant_code ? `${p.participant_code} — ` : ""}{p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {selected && (
            <div className="flex flex-wrap gap-2 pt-2">
              <StatusPill tone={consentGranted ? "ok" : "bad"}>Consent: {selected.consent_status}</StatusPill>
              <StatusPill tone={activeAgreements.length ? "ok" : "warn"}>
                {activeAgreements.length} active agreement{activeAgreements.length === 1 ? "" : "s"}
              </StatusPill>
              <StatusPill tone={activePlans.length ? "ok" : "warn"}>
                {activePlans.length ? "Support plan active" : "No active support plan"}
              </StatusPill>
            </div>
          )}
          {selected && !consentGranted && (
            <BlockerAlert
              title="Consent is not granted"
              blockers={["Care records cannot be created or changed until consent is recorded as granted. Access attempts are written to the audit trail."]}
            />
          )}
        </CardContent>
      </Card>

      {!participantId ? (
        <EmptyState title="No participant selected" description="Choose a participant to view their care record." />
      ) : error ? (
        <ErrorState error={error} />
      ) : isLoading ? (
        <LoadingState />
      ) : (
        <Tabs defaultValue="participant_consents">
          <TabsList className="flex flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => {
            const rows = data?.[t.value] ?? [];
            return (
              <TabsContent key={t.value} value={t.value} className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{t.label}</h2>
                  <Button
                    onClick={() => setSheet({ entity: t.value })}
                    disabled={!canEdit || (!consentGranted && t.value !== "participant_concerns")}
                  >
                    Add record
                  </Button>
                </div>

                {t.value === "mealtime_profiles" && rosterCheck && rosterCheck.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Mealtime competency check</CardTitle>
                      <CardDescription>Assigned workers are checked against the competency the plan requires.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {rosterCheck.map((r) => (
                        <div key={r.worker} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{r.worker}</span>
                          {r.blockers.length === 0 ? (
                            <StatusPill tone="ok">Competency current</StatusPill>
                          ) : (
                            <StatusPill tone="bad">{r.blockers.join(" ")}</StatusPill>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {rows.length === 0 ? (
                  <EmptyState title={`No ${t.label.toLowerCase()} records`} description="Records added here form part of the audit evidence pack." />
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {t.columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                          <TableHead className="w-24">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.id}>
                            {t.columns.map((c) => <TableCell key={c.key}>{cell(row, c.key)}</TableCell>)}
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => setSheet({ entity: t.value, initial: row })}>
                                Open
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {sheet && (
        <RecordSheet
          open
          onOpenChange={(o) => !o && setSheet(null)}
          title={TABS.find((t) => t.value === sheet.entity)?.label ?? "Record"}
          description="Fields marked with an asterisk are required. Additional gates are enforced by the database."
          fields={fieldsFor(sheet.entity)}
          initial={sheet.initial}
          blockers={blockersFor(sheet.entity)}
          readOnly={!canEdit}
          readOnlyReason={readOnlyReason}
          onSubmit={async (values) => {
            await save.mutateAsync({ entity: sheet.entity, values });
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
