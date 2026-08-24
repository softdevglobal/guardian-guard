/**
 * Phase 1 — participant funding records.
 *
 * These figures are a provider-side operational view of a participant's plan.
 * They are not an NDIS claim or an authoritative plan balance; Phase 3 finance
 * reconciles claimed amounts against payment outcomes.
 */

export const SUPPORT_CATEGORIES = [
  { value: "core_daily_activities", label: "Core — Assistance with daily life" },
  { value: "core_social_community", label: "Core — Social and community participation" },
  { value: "core_consumables", label: "Core — Consumables" },
  { value: "core_transport", label: "Core — Transport" },
  { value: "capacity_building", label: "Capacity building" },
  { value: "capital_supports", label: "Capital supports" },
  { value: "sil", label: "Supported independent living" },
] as const;

export interface FundingForm {
  participant_id?: string | null;
  support_category?: string | null;
  allocated_budget?: number | string | null;
  committed_budget?: number | string | null;
  claimed_amount?: number | string | null;
  service_rate?: number | string | null;
  plan_start_date?: string | null;
  plan_end_date?: string | null;
}

const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : NaN;
};

export function fundingBlockers(form: FundingForm): string[] {
  const blockers: string[] = [];
  if (!form.participant_id) blockers.push("Select a participant.");
  if (!form.support_category) blockers.push("Select a support category.");

  const allocated = num(form.allocated_budget);
  if (!Number.isFinite(allocated) || allocated <= 0) blockers.push("Allocated budget must be greater than zero.");

  const committed = num(form.committed_budget);
  const claimed = num(form.claimed_amount);
  if (!Number.isFinite(committed) || committed < 0) blockers.push("Committed budget cannot be negative.");
  if (!Number.isFinite(claimed) || claimed < 0) blockers.push("Claimed amount cannot be negative.");
  if (Number.isFinite(allocated) && Number.isFinite(committed) && Number.isFinite(claimed) && committed + claimed > allocated) {
    blockers.push("Committed plus claimed cannot exceed the allocated budget.");
  }

  if (!form.plan_start_date) blockers.push("Plan start date is required.");
  if (!form.plan_end_date) blockers.push("Plan end date is required.");
  if (form.plan_start_date && form.plan_end_date && form.plan_end_date <= form.plan_start_date) {
    blockers.push("Plan end date must be after the plan start date.");
  }
  return blockers;
}

export function remainingBudget(row: { allocated_budget?: number | null; committed_budget?: number | null; claimed_amount?: number | null }): number {
  return Number(row.allocated_budget ?? 0) - Number(row.committed_budget ?? 0) - Number(row.claimed_amount ?? 0);
}

/** 0–100, capped, so a progress bar never overflows on over-commitment. */
export function utilisationPercent(row: { allocated_budget?: number | null; committed_budget?: number | null; claimed_amount?: number | null }): number {
  const allocated = Number(row.allocated_budget ?? 0);
  if (allocated <= 0) return 0;
  const used = Number(row.committed_budget ?? 0) + Number(row.claimed_amount ?? 0);
  return Math.max(0, Math.min(100, Math.round((used / allocated) * 100)));
}

export type FundingFlag = "over_committed" | "nearly_exhausted" | "plan_expired" | "plan_ending_soon" | "on_track";

export function fundingFlag(
  row: { allocated_budget?: number | null; committed_budget?: number | null; claimed_amount?: number | null; plan_end_date?: string | null },
  today = new Date().toISOString().slice(0, 10)
): FundingFlag {
  if (remainingBudget(row) < 0) return "over_committed";
  if (row.plan_end_date && row.plan_end_date < today) return "plan_expired";
  if (utilisationPercent(row) >= 90) return "nearly_exhausted";
  if (row.plan_end_date) {
    const daysLeft = Math.round((Date.parse(row.plan_end_date) - Date.parse(today)) / 86_400_000);
    if (daysLeft <= 30) return "plan_ending_soon";
  }
  return "on_track";
}

export const FUNDING_FLAG_COPY: Record<FundingFlag, string> = {
  over_committed: "Over committed — review bookings",
  nearly_exhausted: "90% or more of budget used",
  plan_expired: "Plan end date has passed",
  plan_ending_soon: "Plan ends within 30 days",
  on_track: "On track",
};

export function formatCurrency(value?: number | null): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(Number(value ?? 0));
}
