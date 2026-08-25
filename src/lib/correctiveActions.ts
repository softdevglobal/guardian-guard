/**
 * Corrective action (CAPA) register rules.
 *
 * The register is the single place where findings from audits, incidents,
 * complaints, risks, policy and management reviews become tracked work. The
 * rules below mirror the database constraints so the UI never offers a save the
 * database will reject.
 */

export const CAPA_SOURCES = [
  "audit",
  "incident",
  "complaint",
  "risk",
  "policy_review",
  "management_review",
  "platform_review",
  "internal",
] as const;

export const CAPA_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const CAPA_STATUSES = ["open", "in_progress", "awaiting_evidence", "awaiting_approval", "complete"] as const;

export type CapaStatus = (typeof CAPA_STATUSES)[number];
export type CapaPriority = (typeof CAPA_PRIORITIES)[number];

export interface CorrectiveActionRecord {
  id?: string;
  action?: string | null;
  source_type?: string | null;
  owner_id?: string | null;
  due_date?: string | null;
  priority?: string | null;
  status?: string | null;
  evidence_required?: boolean | null;
  evidence_document_id?: string | null;
  evidence_notes?: string | null;
  closure_notes?: string | null;
  approved_by?: string | null;
}

/** Human-readable reasons a corrective action cannot be saved in its current shape. */
export function capaBlockers(values: CorrectiveActionRecord): string[] {
  const blockers: string[] = [];
  if (!values.action || values.action.trim().length < 5) blockers.push("Describe the corrective action (at least 5 characters).");
  if (!values.owner_id) blockers.push("Assign an owner who is accountable for the action.");
  if (!values.due_date) blockers.push("Set a due date so the action appears on the compliance calendar.");
  if (values.status === "complete") {
    if (!values.closure_notes || values.closure_notes.trim().length < 5) {
      blockers.push("Record closure notes explaining what changed before completing the action.");
    }
    if (values.evidence_required && !values.evidence_document_id && !values.evidence_notes) {
      blockers.push("Attach the evidence document or record evidence notes before completing the action.");
    }
    if (!values.approved_by) blockers.push("An approver must sign off before an action is marked complete.");
  }
  return blockers;
}

export function isOverdue(record: CorrectiveActionRecord, now = new Date()): boolean {
  if (!record.due_date || record.status === "complete") return false;
  return record.due_date.slice(0, 10) < now.toISOString().slice(0, 10);
}

export function capaSummary(records: CorrectiveActionRecord[], now = new Date()) {
  return {
    total: records.length,
    open: records.filter((r) => r.status !== "complete").length,
    overdue: records.filter((r) => isOverdue(r, now)).length,
    awaitingApproval: records.filter((r) => r.status === "awaiting_approval").length,
    complete: records.filter((r) => r.status === "complete").length,
  };
}

/** Percentage of actions closed — an operational metric, not a compliance determination. */
export function closureRate(records: CorrectiveActionRecord[]): number {
  if (records.length === 0) return 0;
  return Math.round((records.filter((r) => r.status === "complete").length / records.length) * 100);
}

export function labelValue(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
