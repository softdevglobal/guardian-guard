/**
 * Pure, testable functions for notification severity classification and routing.
 * These encode the compliance rules that the edge function and UI both rely on.
 */

export type NotificationSeverity = "info" | "warning" | "urgent" | "critical";

export interface ClearanceStatus {
  policeCheckExpiry: string | null;
  wwccExpiry: string | null;
  workerScreeningExpiry: string | null;
}

export interface StaleIncidentInput {
  createdAt: string; // ISO timestamp
  status: string;
}

export interface ComplaintAckInput {
  createdAt: string;
  acknowledgementDate: string | null;
  status: string;
}

export interface SafeguardingInput {
  immediateSafetyRisk: boolean;
  status: string;
  createdAt: string;
}

export interface RiskInput {
  riskLevel: string | null;
}

// ── Clearance expiry ──

export function classifyClearanceSeverity(
  clearance: ClearanceStatus,
  now: Date
): { severity: NotificationSeverity; expiringItems: string[]; isExpired: boolean } | null {
  const todayStr = toDateStr(now);
  const sixtyDaysStr = toDateStr(addDays(now, 60));

  const items: string[] = [];
  if (clearance.policeCheckExpiry && clearance.policeCheckExpiry <= sixtyDaysStr) items.push("Police Check");
  if (clearance.wwccExpiry && clearance.wwccExpiry <= sixtyDaysStr) items.push("WWCC");
  if (clearance.workerScreeningExpiry && clearance.workerScreeningExpiry <= sixtyDaysStr) items.push("Worker Screening");

  if (items.length === 0) return null;

  const isExpired = [
    { name: "Police Check", date: clearance.policeCheckExpiry },
    { name: "WWCC", date: clearance.wwccExpiry },
    { name: "Worker Screening", date: clearance.workerScreeningExpiry },
  ].some(i => items.includes(i.name) && i.date && i.date < todayStr);

  return {
    severity: isExpired ? "critical" : "warning",
    expiringItems: items,
    isExpired,
  };
}

// ── Stale incident ──

export function isStaleIncident(input: StaleIncidentInput, now: Date): boolean {
  const openStatuses = ["reported", "review", "investigating", "submitted", "supervisor_review", "compliance_review"];
  if (!openStatuses.includes(input.status)) return false;
  const fiveDaysAgo = addDays(now, -5);
  return new Date(input.createdAt) < fiveDaysAgo;
}

export function staleIncidentSeverity(): NotificationSeverity {
  return "urgent";
}

// ── Complaint acknowledgement overdue ──

export function isComplaintAckOverdue(input: ComplaintAckInput, now: Date): boolean {
  if (input.acknowledgementDate !== null) return false;
  const pendingStatuses = ["submitted", "under_review"];
  if (!pendingStatuses.includes(input.status)) return false;
  const twoDaysAgo = addDays(now, -2);
  return new Date(input.createdAt) < twoDaysAgo;
}

export function complaintAckSeverity(): NotificationSeverity {
  return "urgent";
}

// ── Safeguarding critical ──

export function isSafeguardingCritical(input: SafeguardingInput, now: Date): boolean {
  if (!input.immediateSafetyRisk) return false;
  if (input.status !== "raised") return false;
  const oneDayAgo = addDays(now, -1);
  return new Date(input.createdAt) < oneDayAgo;
}

export function safeguardingSeverity(): NotificationSeverity {
  return "critical";
}

// ── Risk severity ──

export function classifyRiskNotificationSeverity(input: RiskInput): NotificationSeverity | null {
  if (input.riskLevel === "Critical") return "critical";
  if (input.riskLevel === "High") return "urgent";
  return null;
}

// ── Notification routing ──

export type RecipientRole = "owner" | "supervisor" | "compliance" | "hr" | "reporter";

export function getStaleIncidentRecipients(): RecipientRole[] {
  return ["owner", "reporter", "supervisor", "compliance"];
}

export function getComplaintAckRecipients(): RecipientRole[] {
  return ["owner", "compliance"];
}

export function getClearanceExpiryRecipients(isExpired: boolean): RecipientRole[] {
  if (isExpired) return ["owner", "hr", "supervisor"];
  return ["owner"];
}

export function getSafeguardingCriticalRecipients(): RecipientRole[] {
  return ["reporter", "compliance"];
}

// ── Helpers ──

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
