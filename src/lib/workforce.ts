/**
 * Phase 1 — operational foundation: sites and worker profiles.
 *
 * Validation lives here (not in the page) so the same rules can be unit tested and
 * reused by rostering in Phase 2. Nothing in this file asserts compliance; it only
 * describes whether the operational record is complete enough to be scheduled.
 */

export const SITE_TYPES = [
  { value: "office", label: "Office" },
  { value: "centre", label: "Centre" },
  { value: "sil_house", label: "SIL house" },
  { value: "community", label: "Community location" },
  { value: "depot", label: "Depot / workshop" },
  { value: "other", label: "Other" },
] as const;

export const EMPLOYMENT_TYPES = [
  { value: "casual", label: "Casual" },
  { value: "part_time", label: "Part time" },
  { value: "full_time", label: "Full time" },
  { value: "contractor", label: "Contractor" },
] as const;

export const EMPLOYMENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On leave" },
  { value: "suspended", label: "Suspended" },
  { value: "ended", label: "Employment ended" },
] as const;

export const SCREENING_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "expired", label: "Expired" },
  { value: "rejected", label: "Rejected" },
] as const;

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** `{ mon: true, ... }` — a coarse weekly pattern used for availability matching. */
export type Availability = Partial<Record<Weekday, boolean>>;

export interface SiteForm {
  name?: string | null;
  site_type?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  geofence_radius_metres?: number | string | null;
}

export function siteBlockers(form: SiteForm): string[] {
  const blockers: string[] = [];
  if (!form.name?.trim()) blockers.push("Site name is required.");
  if (!form.site_type) blockers.push("Select a site type.");
  const radius = Number(form.geofence_radius_metres ?? 0);
  if (!Number.isFinite(radius) || radius < 25 || radius > 5000) {
    blockers.push("Geofence radius must be between 25 and 5000 metres.");
  }
  if (form.postcode && !/^\d{4}$/.test(String(form.postcode).trim())) {
    blockers.push("Postcode must be four digits.");
  }
  return blockers;
}

export interface WorkerForm {
  user_id?: string | null;
  employment_type?: string | null;
  employment_status?: string | null;
  screening_status?: string | null;
  position?: string | null;
  pay_rate?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  availability?: Availability | null;
}

export function workerBlockers(form: WorkerForm): string[] {
  const blockers: string[] = [];
  if (!form.user_id) blockers.push("Select the staff account this worker record belongs to.");
  if (!form.employment_type) blockers.push("Select an employment type.");
  if (!form.position?.trim()) blockers.push("Position is required.");
  if (form.pay_rate !== null && form.pay_rate !== undefined && form.pay_rate !== "") {
    const rate = Number(form.pay_rate);
    if (!Number.isFinite(rate) || rate <= 0) blockers.push("Pay rate must be a positive amount.");
  }
  if (form.start_date && form.end_date && form.end_date < form.start_date) {
    blockers.push("End date cannot be before the start date.");
  }
  return blockers;
}

/** Turns a form into an insert payload with the array/JSON columns normalised. */
export function workerPayload(form: WorkerForm & { skills?: string; qualifications?: string; [k: string]: any }) {
  const list = (value?: string | null) =>
    (value ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  return {
    user_id: form.user_id ?? null,
    employment_type: form.employment_type ?? "casual",
    employment_status: form.employment_status ?? "active",
    screening_status: form.screening_status ?? "pending",
    position: form.position?.trim() ?? null,
    award_classification: form.award_classification?.trim() || null,
    pay_rate: form.pay_rate === "" || form.pay_rate === undefined || form.pay_rate === null ? null : Number(form.pay_rate),
    primary_site_id: form.primary_site_id || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    notes: form.notes?.trim() || null,
    skills: list(form.skills),
    qualifications: list(form.qualifications),
    availability: form.availability ?? {},
  };
}

export interface SchedulableWorker {
  employment_status?: string | null;
  screening_status?: string | null;
  availability?: Availability | null;
  end_date?: string | null;
}

/**
 * Operational readiness only — the authoritative assignment gate remains the
 * database eligibility evaluation in `staffEligibility`.
 */
export function workerSchedulingBlockers(worker: SchedulableWorker, onDate?: string): string[] {
  const blockers: string[] = [];
  if (worker.employment_status && worker.employment_status !== "active") {
    blockers.push("Worker is not currently active.");
  }
  if (worker.screening_status !== "verified") {
    blockers.push("Worker screening is not verified.");
  }
  if (onDate && worker.end_date && worker.end_date < onDate) {
    blockers.push("Worker employment ended before this date.");
  }
  return blockers;
}

export function availableOnWeekday(worker: SchedulableWorker, day: Weekday): boolean {
  const availability = worker.availability ?? {};
  // An empty pattern means "not recorded" — treated as available so scheduling is
  // never silently blocked by missing data; the roster surfaces it as a warning.
  if (Object.keys(availability).length === 0) return true;
  return availability[day] === true;
}

export function summariseAvailability(availability?: Availability | null): string {
  const days = WEEKDAYS.filter((d) => availability?.[d]);
  if (days.length === 0) return "Not recorded";
  if (days.length === 7) return "Every day";
  return days.map((d) => d[0].toUpperCase() + d.slice(1)).join(", ");
}
