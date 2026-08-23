// Pure, testable mirrors of the database gates for the worker service workflow.
// The database triggers remain the source of truth; these helpers let the UI explain
// *why* an action is blocked before the worker attempts it.

import type { Role } from "@/lib/complianceGates";

export type ShiftStatus =
  | "scheduled"
  | "checked_in"
  | "in_progress"
  | "submitted"
  | "approved"
  | "correction_required"
  | "cancelled";

export type EvidenceType = "before" | "after" | "issue";
export type GeofenceResult = "inside" | "outside" | "unknown" | "inaccurate";

export const OVERSIGHT_ROLES: Role[] = ["tenant_admin", "super_admin", "compliance_officer", "supervisor"];

function blank(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim() === "";
}

/* ---------------- Tenant / assignment isolation ---------------- */

export interface ShiftLike {
  id: string;
  organisation_id: string;
  worker_id: string;
  participant_id: string;
  status: ShiftStatus;
}

export function canViewShift(args: {
  viewerId: string;
  viewerRole: Role;
  viewerOrgId: string | null;
  shift: ShiftLike;
  participantUserId?: string | null;
}): boolean {
  const { viewerId, viewerRole, viewerOrgId, shift } = args;
  // Participants only ever see their own approved service records.
  if (args.participantUserId && args.participantUserId === viewerId) {
    return shift.status === "approved";
  }
  if (viewerRole === "participant") return false;
  if (!viewerOrgId || viewerOrgId !== shift.organisation_id) return false;
  if (shift.worker_id === viewerId) return true;
  return [...OVERSIGHT_ROLES, "executive"].includes(viewerRole);
}

export function canEditShift(args: { viewerId: string; viewerRole: Role; viewerOrgId: string | null; shift: ShiftLike }): boolean {
  const { viewerId, viewerRole, viewerOrgId, shift } = args;
  if (!viewerOrgId || viewerOrgId !== shift.organisation_id) return false;
  if (OVERSIGHT_ROLES.includes(viewerRole)) return true;
  if (shift.worker_id !== viewerId) return false;
  return ["scheduled", "checked_in", "in_progress", "correction_required"].includes(shift.status);
}

export function canApproveShift(role: Role | null | undefined, shift: { status: ShiftStatus }): boolean {
  if (!role || !OVERSIGHT_ROLES.includes(role)) return false;
  return shift.status === "submitted";
}

export function approvalDecisionBlockers(args: {
  role: Role | null | undefined;
  decision: "approve" | "request_correction";
  reason?: string | null;
}): string[] {
  const b: string[] = [];
  if (!args.role || !OVERSIGHT_ROLES.includes(args.role)) {
    b.push("Only a supervisor, compliance officer or administrator can decide on a submitted service.");
  }
  if (args.decision === "request_correction" && blank(args.reason)) {
    b.push("A written reason is required when requesting a correction.");
  }
  return b;
}

/* ---------------- Assignment eligibility (check-in gate) ---------------- */

export function checkInBlockers(args: {
  shift: { status: ShiftStatus };
  workerEligible: boolean;
  workerEligibilityReason?: string | null;
  hasActiveAgreement: boolean;
}): string[] {
  const b: string[] = [];
  if (args.shift.status === "cancelled") b.push("This shift has been cancelled.");
  if (["submitted", "approved"].includes(args.shift.status)) b.push("This service has already been submitted.");
  if (!args.workerEligible) {
    b.push(
      `Your compliance and training are not current${args.workerEligibilityReason ? `: ${args.workerEligibilityReason}` : "."}`
    );
  }
  if (!args.hasActiveAgreement) {
    b.push("No active service agreement covers this shift — a supervisor must authorise an exception.");
  }
  return b;
}

export function assignmentBlockers(args: {
  workerEligible: boolean;
  workerEligibilityReason?: string | null;
  hasActiveAgreement: boolean;
  participantAccessible: boolean;
}): string[] {
  const b: string[] = [];
  if (!args.workerEligible) {
    b.push(`Worker is not eligible for assignment${args.workerEligibilityReason ? `: ${args.workerEligibilityReason}` : "."}`);
  }
  if (!args.hasActiveAgreement) b.push("The participant has no active service agreement covering this date.");
  if (!args.participantAccessible) b.push("You do not have access to this participant's record.");
  return b;
}

/* ---------------- Geofence ---------------- */

/** Haversine distance in metres. Returns null when either point is unknown. */
export function haversineMetres(
  a: { latitude?: number | null; longitude?: number | null },
  b: { latitude?: number | null; longitude?: number | null }
): number | null {
  if (a?.latitude == null || a?.longitude == null || b?.latitude == null || b?.longitude == null) return null;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}

export const INACCURATE_ACCURACY_METRES = 250;

export function evaluateGeofence(args: {
  captured?: { latitude?: number | null; longitude?: number | null; accuracy_metres?: number | null } | null;
  fence?: { latitude?: number | null; longitude?: number | null; radius_metres?: number | null } | null;
}): { result: GeofenceResult; distance_metres: number | null } {
  const distance = haversineMetres(args.captured ?? {}, args.fence ?? {});
  if (distance === null) return { result: "unknown", distance_metres: null };
  if (args.captured?.accuracy_metres != null && args.captured.accuracy_metres > INACCURATE_ACCURACY_METRES) {
    return { result: "inaccurate", distance_metres: distance };
  }
  const radius = args.fence?.radius_metres ?? 150;
  return { result: distance <= radius ? "inside" : "outside", distance_metres: distance };
}

/** Location problems never block the service — they require a reason and supervisor review. */
export function attendanceExceptionRequired(result: GeofenceResult): boolean {
  return result !== "inside";
}

/* ---------------- Evidence & consent ---------------- */

export interface EvidencePreferences {
  photography_consent_status: "granted" | "withdrawn" | "pending";
  allowed_evidence_types?: EvidenceType[] | null;
  participant_may_appear?: boolean;
  photography_restrictions?: string | null;
  private_area_restrictions?: string | null;
  alternative_evidence_method?: string | null;
}

export function photographyAllowed(prefs: EvidencePreferences | null | undefined, type: EvidenceType): boolean {
  if (!prefs) return false;
  if (prefs.photography_consent_status !== "granted") return false;
  const allowed = prefs.allowed_evidence_types ?? [];
  return allowed.length === 0 ? true : allowed.includes(type);
}

/**
 * A participant declining photography must never prevent service delivery.
 * The worker records the refusal and provides written alternative evidence instead.
 */
export function photoRefusalAlternative(prefs: EvidencePreferences | null | undefined): {
  blocksService: false;
  requiresWrittenAlternative: boolean;
  message: string;
} {
  const granted = prefs?.photography_consent_status === "granted";
  if (granted) {
    return { blocksService: false, requiresWrittenAlternative: false, message: "Photo evidence is permitted for this participant." };
  }
  return {
    blocksService: false,
    requiresWrittenAlternative: true,
    message:
      prefs?.alternative_evidence_method?.trim() ||
      "This participant has not consented to photographs. Continue the service and record written service notes as alternative evidence.",
  };
}

export interface ShiftTaskLike {
  id: string;
  status: "pending" | "completed" | "not_completed" | "not_applicable";
  requires_before_photo?: boolean;
  requires_after_photo?: boolean;
  exception_reason?: string | null;
  participant_confirmation_required?: boolean;
}

export interface EvidenceLike {
  shift_task_id?: string | null;
  evidence_type: EvidenceType;
  record_status?: string;
}

export function shiftCompletionBlockers(args: {
  shift: {
    actual_start?: string | null;
    actual_end?: string | null;
    evidence_exception?: boolean;
    evidence_exception_reason?: string | null;
  };
  tasks: ShiftTaskLike[];
  evidence: EvidenceLike[];
  preferences?: EvidencePreferences | null;
  confirmationRecorded?: boolean;
}): string[] {
  const b: string[] = [];
  if (!args.shift.actual_start) b.push("Check in has not been recorded.");
  if (!args.shift.actual_end) b.push("Check out has not been recorded.");

  const pending = args.tasks.filter((t) => t.status === "pending").length;
  if (pending > 0) b.push(`${pending} task(s) still pending.`);

  const active = args.evidence.filter((e) => (e.record_status ?? "active") === "active");
  const has = (taskId: string, type: EvidenceType) =>
    active.some((e) => e.shift_task_id === taskId && e.evidence_type === type);

  const missing = args.tasks.filter(
    (t) =>
      t.status !== "not_applicable" &&
      blank(t.exception_reason) &&
      ((t.requires_before_photo && !has(t.id, "before")) || (t.requires_after_photo && !has(t.id, "after")))
  );

  if (missing.length > 0) {
    const refusal = photoRefusalAlternative(args.preferences);
    if (!refusal.requiresWrittenAlternative) {
      const authorisedException =
        !!args.shift.evidence_exception && !blank(args.shift.evidence_exception_reason);
      if (!authorisedException) {
        b.push(
          `${missing.length} task(s) are missing required photo evidence. Record an authorised exception with a reason, or written alternative evidence.`
        );
      }
    }
  }

  if (args.tasks.some((t) => t.participant_confirmation_required) && !args.confirmationRecorded) {
    b.push("Participant confirmation is required — record confirmation, decline or a not-practicable reason.");
  }

  return b;
}

/** Evidence is append-only: the only permitted change is superseding it with a reason. */
export function evidenceUpdateBlockers(args: {
  changedFields: string[];
  supersedeReason?: string | null;
}): string[] {
  const immutable = ["storage_path", "sha256_hash", "evidence_type", "shift_id", "server_created_at"];
  const b: string[] = [];
  const touched = args.changedFields.filter((f) => immutable.includes(f));
  if (touched.length > 0) {
    b.push(`Evidence is immutable — ${touched.join(", ")} cannot be changed. Upload a superseding record instead.`);
  }
  if (args.changedFields.includes("record_status") && blank(args.supersedeReason)) {
    b.push("A reason is required when replacing an evidence item.");
  }
  return b;
}

/* ---------------- Presentation helpers ---------------- */

export type ShiftTab = "today" | "upcoming" | "completed";

export function shiftTab(shift: { scheduled_start: string; status: ShiftStatus }, now = new Date()): ShiftTab {
  if (["submitted", "approved", "cancelled"].includes(shift.status)) return "completed";
  const start = new Date(shift.scheduled_start);
  const sameDay = start.toDateString() === now.toDateString();
  if (sameDay) return "today";
  return start.getTime() < now.getTime() ? "today" : "upcoming";
}

export function shiftDurationMinutes(shift: { actual_start?: string | null; actual_end?: string | null }): number | null {
  if (!shift.actual_start || !shift.actual_end) return null;
  const mins = (new Date(shift.actual_end).getTime() - new Date(shift.actual_start).getTime()) / 60000;
  return mins < 0 ? null : Math.round(mins);
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function billingSummary(shifts: { actual_start?: string | null; actual_end?: string | null; transport_kilometres?: number | null }[]) {
  const minutes = shifts.reduce((sum, s) => sum + (shiftDurationMinutes(s) ?? 0), 0);
  const kilometres = shifts.reduce((sum, s) => sum + (Number(s.transport_kilometres) || 0), 0);
  return { minutes, kilometres: Math.round(kilometres * 100) / 100 };
}

export const SHIFT_STATUS_LABEL: Record<ShiftStatus, string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  in_progress: "In progress",
  submitted: "Awaiting approval",
  approved: "Approved",
  correction_required: "Correction requested",
  cancelled: "Cancelled",
};

export const WORKFLOW_STEPS = [
  "Scheduled",
  "Check in",
  "Start service",
  "Complete tasks",
  "Review",
  "Check out",
  "Submit",
] as const;

export function workflowStepIndex(shift: {
  status: ShiftStatus;
  actual_start?: string | null;
  actual_end?: string | null;
  tasksPending?: number;
}): number {
  if (shift.status === "submitted" || shift.status === "approved") return 6;
  if (shift.actual_end) return 6;
  if (shift.actual_start) return (shift.tasksPending ?? 0) > 0 ? 3 : 4;
  if (shift.status === "checked_in") return 2;
  return 1;
}
