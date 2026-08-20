// Client-side mirrors of the database enforcement gates.
// The database triggers are the source of truth; these functions let the UI explain
// *why* an action is blocked before the user attempts it, and are covered by tests.

export type Role =
  | "super_admin" | "compliance_officer" | "supervisor" | "trainer"
  | "support_worker" | "hr_admin" | "executive" | "participant";

const AUTHORISER_ROLES: Role[] = ["super_admin", "compliance_officer", "supervisor"];
const COMPLIANCE_ROLES: Role[] = ["super_admin", "compliance_officer"];

function blank(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim() === "";
}

/* ---------------- Service agreements & service delivery ---------------- */

export interface AgreementLike {
  status: string;
  record_status?: string;
  start_date?: string | null;
  end_date?: string | null;
}

export function agreementCoversDate(a: AgreementLike, date: string): boolean {
  if (a.status !== "active") return false;
  if ((a.record_status ?? "active") !== "active") return false;
  if (a.start_date && a.start_date > date) return false;
  if (a.end_date && a.end_date < date) return false;
  return true;
}

export function serviceDeliveryBlockers(args: {
  serviceDate: string;
  agreements: AgreementLike[];
  exceptionReason?: string | null;
  authoriserRole?: Role | null;
}): string[] {
  if (args.agreements.some((a) => agreementCoversDate(a, args.serviceDate))) return [];
  const blockers: string[] = [];
  if (blank(args.exceptionReason)) {
    blockers.push("No active service agreement covers this date — an authorised exception reason is required.");
  }
  if (!args.authoriserRole || !AUTHORISER_ROLES.includes(args.authoriserRole)) {
    blockers.push("The exception must be authorised by a supervisor, compliance officer or administrator.");
  }
  return blockers;
}

export function canFinaliseServiceDelivery(args: Parameters<typeof serviceDeliveryBlockers>[0]): boolean {
  return serviceDeliveryBlockers(args).length === 0;
}

export function agreementSignBlockers(a: {
  signature_method?: string | null;
  signed_by_name?: string | null;
  signed_at?: string | null;
  privacy_notice_acknowledged?: boolean;
  advocate_rights_acknowledged?: boolean;
  complaints_path?: string | null;
}): string[] {
  const b: string[] = [];
  if (blank(a.signature_method) || blank(a.signed_by_name) || !a.signed_at) {
    b.push("Signature method, signatory name and signed date are required.");
  }
  if (!a.privacy_notice_acknowledged) b.push("The privacy notice must be acknowledged.");
  if (!a.advocate_rights_acknowledged) b.push("Advocate rights must be acknowledged.");
  if (blank(a.complaints_path)) b.push("The complaints pathway must be recorded.");
  return b;
}

/* ---------------- Support plans & worker assignment ---------------- */

export function supportPlanActivationBlockers(p: {
  goals?: string | null;
  communication_method?: string | null;
  review_due_date?: string | null;
}): string[] {
  const b: string[] = [];
  if (blank(p.goals)) b.push("Goals are required.");
  if (blank(p.communication_method)) b.push("The participant's communication method is required.");
  if (!p.review_due_date) b.push("A review due date is required.");
  return b;
}

export function workerAssignmentBlockers(a: {
  plan_briefing_completed: boolean;
  briefing_support_plan_id?: string | null;
  workerEligible: boolean;
  workerEligibilityReason?: string | null;
}): string[] {
  const b: string[] = [];
  if (!a.plan_briefing_completed || !a.briefing_support_plan_id) {
    b.push("The worker must be briefed on the participant's support plan.");
  }
  if (!a.workerEligible) {
    b.push(`Worker compliance and training are not current${a.workerEligibilityReason ? `: ${a.workerEligibilityReason}` : "."}`);
  }
  return b;
}

export interface TrainingRecordLike {
  training_code: string;
  status: string;
  verified_by?: string | null;
  expiry_date?: string | null;
}

export function hasCurrentTraining(records: TrainingRecordLike[], code: string, today = new Date()): boolean {
  return records.some(
    (r) =>
      r.training_code === code &&
      r.status === "completed" &&
      !!r.verified_by &&
      (!r.expiry_date || new Date(r.expiry_date) >= new Date(today.toISOString().split("T")[0]))
  );
}

export function mealtimeRosterBlockers(args: {
  competencyCode: string;
  training: TrainingRecordLike[];
  planActive: boolean;
  today?: Date;
}): string[] {
  const b: string[] = [];
  if (!args.planActive) b.push("The mealtime management plan is not active.");
  if (!hasCurrentTraining(args.training, args.competencyCode, args.today ?? new Date())) {
    b.push(`Current verified ${args.competencyCode} competency is required to be rostered to mealtime support.`);
  }
  return b;
}

/* ---------------- Medication ---------------- */

export function medicationProfileActivationBlockers(p: {
  authorised_record_url?: string | null;
  consent_obtained: boolean;
  dose?: string | null;
  timing?: string | null;
  route?: string | null;
}): string[] {
  const b: string[] = [];
  if (blank(p.authorised_record_url)) b.push("The authorised medication record must be uploaded.");
  if (!p.consent_obtained) b.push("Consent must be recorded.");
  if (blank(p.dose) || blank(p.timing) || blank(p.route)) b.push("Dose, timing and route are required.");
  return b;
}

export type MedicationResult = "administered" | "refused" | "withheld" | "missed" | "self_administered";

export function medicationRecordBlockers(r: {
  result: MedicationResult;
  reason?: string | null;
  witness_id?: string | null;
  worker_id?: string | null;
  doubleCheckRequired: boolean;
  profileActive: boolean;
}): string[] {
  const b: string[] = [];
  if (!r.profileActive) b.push("The medication profile is not active.");
  if (r.doubleCheckRequired && r.result === "administered" && !r.witness_id) {
    b.push("This medication requires a second-person check — record a witness.");
  }
  if (r.witness_id && r.witness_id === r.worker_id) b.push("The witness must be a different worker.");
  if (["refused", "withheld", "missed"].includes(r.result) && blank(r.reason)) {
    b.push("A reason is required when medication is refused, withheld or missed.");
  }
  return b;
}

/** Alerts escalate to supervisor and compliance; overdue is time-based, not clinical advice. */
export function medicationAlertLevel(
  r: { result?: MedicationResult | null; due_at: string },
  now: Date = new Date()
): "none" | "overdue" | "escalate" {
  if (r.result && ["refused", "withheld", "missed"].includes(r.result)) return "escalate";
  if (!r.result && new Date(r.due_at) < now) return "overdue";
  return "none";
}

/* ---------------- Reportable incidents ---------------- */

export type ReportableStatus = "requires_human_confirmation" | "reportable" | "not_reportable";

export const REPORTABLE_CHECKLIST: { key: string; label: string; immediate: boolean }[] = [
  { key: "death", label: "Death of a person with disability", immediate: true },
  { key: "serious_injury", label: "Serious injury of a person with disability", immediate: true },
  { key: "abuse_neglect", label: "Abuse or neglect of a person with disability", immediate: true },
  { key: "unlawful_sexual_physical", label: "Unlawful sexual or physical contact with, or assault of, a person with disability", immediate: true },
  { key: "sexual_misconduct", label: "Sexual misconduct committed against, or in the presence of, a person with disability", immediate: true },
  { key: "unauthorised_restrictive_practice", label: "Use of an unauthorised restrictive practice", immediate: false },
];

/**
 * Time-critical due date. 24 hours for the immediate categories, otherwise 5 days.
 * This is a calculator to support a human decision — it never makes the decision.
 */
export function reportableDueDate(checklist: Record<string, boolean>, reportedAt: Date): Date {
  const immediate = REPORTABLE_CHECKLIST.some((c) => c.immediate && checklist[c.key]);
  const due = new Date(reportedAt);
  due.setHours(due.getHours() + (immediate ? 24 : 24 * 5));
  return due;
}

export function reportableAssessmentBlockers(a: {
  decision: string;
  rationale?: string | null;
  evidence?: string | null;
  assessorRole?: Role | null;
}): string[] {
  const b: string[] = [];
  if (!["reportable", "not_reportable"].includes(a.decision)) b.push("Select a decision.");
  if (blank(a.rationale)) b.push("A written rationale is required.");
  if (blank(a.evidence)) b.push("Record the evidence the decision is based on.");
  if (!a.assessorRole || !COMPLIANCE_ROLES.includes(a.assessorRole)) {
    b.push("Only a Compliance Officer or administrator can make this determination.");
  }
  return b;
}

/** Never infer reportability from a single data point such as "injury = yes". */
export function displayReportableStatus(status: ReportableStatus): string {
  switch (status) {
    case "reportable": return "Assessed: reportable to the NDIS Commission";
    case "not_reportable": return "Assessed: not reportable";
    default: return "Requires human confirmation";
  }
}

export function incidentClosureBlockers(i: {
  root_cause?: string | null;
  contributing_factors?: string | null;
  corrective_actions?: string | null;
  description?: string | null;
  participant_followup_completed?: boolean | null;
  immediate_safety_action?: string | null;
  affected_person_support?: string | null;
  participant_communication?: string | null;
  reportable_status?: ReportableStatus | null;
}): string[] {
  const b: string[] = [];
  if (blank(i.description)) b.push("A description is required.");
  if (blank(i.root_cause)) b.push("A root cause is required.");
  if (blank(i.contributing_factors)) b.push("Contributing factors are required.");
  if (blank(i.corrective_actions)) b.push("Corrective actions are required.");
  if (blank(i.immediate_safety_action)) b.push("The immediate safety action taken is required.");
  if (blank(i.affected_person_support)) b.push("Support provided to affected people is required.");
  if (blank(i.participant_communication)) b.push("Communication with the participant or representative is required.");
  if (!i.participant_followup_completed) b.push("Participant follow-up must be completed.");
  if ((i.reportable_status ?? "requires_human_confirmation") === "requires_human_confirmation") {
    b.push("A Compliance Officer must complete the reportable incident assessment.");
  }
  return b;
}

/* ---------------- Restrictive practices ---------------- */

export function restrictivePracticeBlockers(p: {
  is_authorised: boolean;
  authorisation_reference?: string | null;
  behaviour_support_plan_url?: string | null;
  least_restrictive_review?: string | null;
  review_date?: string | null;
  authoriserRole?: Role | null;
}): string[] {
  const b: string[] = [];
  if (!p.is_authorised || blank(p.authorisation_reference)) {
    b.push("State or territory authorisation must be recorded.");
  }
  if (blank(p.behaviour_support_plan_url)) b.push("A behaviour support plan must be attached.");
  if (blank(p.least_restrictive_review)) b.push("A least-restrictive-alternative review must be documented.");
  if (!p.review_date) b.push("A review date is required.");
  if (!p.authoriserRole || !COMPLIANCE_ROLES.includes(p.authoriserRole)) {
    b.push("A named human Compliance Officer or administrator must authorise this practice — automated approval is never permitted.");
  }
  return b;
}

/* ---------------- SIL availability ---------------- */

export function silAvailability(cfg: {
  is_enabled?: boolean;
  registration_group_0138_confirmed?: boolean;
}): { available: boolean; message: string } {
  if (!cfg.registration_group_0138_confirmed) {
    return {
      available: false,
      message:
        "Supported Independent Living is unavailable until registration group 0138 is confirmed by an authorised administrator.",
    };
  }
  if (!cfg.is_enabled) {
    return { available: false, message: "Registration group 0138 is confirmed. An administrator must now enable the SIL module." };
  }
  return { available: true, message: "SIL module enabled." };
}

/** A tenancy agreement is never contingent on a service agreement, or vice versa. */
export function tenancyIsIndependentOfService(): true {
  return true;
}

/* ---------------- Participant data isolation ---------------- */

export function canViewParticipantRecord(args: {
  viewerId: string;
  viewerRole: Role;
  viewerOrgId: string | null;
  participant: {
    id: string;
    user_id?: string | null;
    organisation_id: string;
    assigned_trainer_id?: string | null;
  };
  activeAssignments?: { participant_id: string; worker_id: string; status: string }[];
}): boolean {
  const { viewerId, viewerRole, viewerOrgId, participant } = args;
  if (participant.user_id && participant.user_id === viewerId) return true;
  if (viewerRole === "participant") return false;
  if (!viewerOrgId || viewerOrgId !== participant.organisation_id) return false;
  if (["super_admin", "compliance_officer", "supervisor", "executive", "hr_admin"].includes(viewerRole)) return true;
  if (participant.assigned_trainer_id === viewerId) return true;
  return (args.activeAssignments ?? []).some(
    (a) => a.participant_id === participant.id && a.worker_id === viewerId && a.status === "active"
  );
}

/* ---------------- Truthfulness guard ---------------- */

const BANNED_CLAIMS = ["ndis compliant", "ndis-compliant", "certified", "certification achieved", "registration approved", "fully compliant"];

/** Guards user-facing copy: the system reports audit readiness, never compliance. */
export function containsProhibitedComplianceClaim(text: string): boolean {
  const t = text.toLowerCase();
  return BANNED_CLAIMS.some((c) => t.includes(c));
}
