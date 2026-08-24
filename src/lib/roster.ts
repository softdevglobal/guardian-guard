/**
 * Pure rostering helpers (Phase 2 — service delivery).
 *
 * The database remains the source of truth for who may be assigned to a shift;
 * these helpers build the weekly grid, surface double bookings and unfilled
 * shifts, and explain why a reassignment is blocked before it is attempted.
 */

export interface RosterShift {
  id: string;
  worker_id?: string | null;
  participant_id?: string | null;
  site_id?: string | null;
  status?: string | null;
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  transport_kilometres?: number | null;
}

export const UNASSIGNED = "unassigned";

/* ---------------- Week maths ---------------- */

/** Monday-based start of the week containing `date`, at local midnight. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isInWeek(shift: RosterShift, weekStart: Date): boolean {
  const start = new Date(shift.scheduled_start).getTime();
  return start >= weekStart.getTime() && start < addDays(weekStart, 7).getTime();
}

export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(weekStart)} – ${fmt(end)} ${end.getFullYear()}`;
}

export function formatTimeRange(shift: RosterShift): string {
  const t = (v: string) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${t(shift.scheduled_start)}–${t(shift.scheduled_end)}`;
}

/* ---------------- Grid ---------------- */

export function scheduledHours(shift: RosterShift): number {
  const ms = new Date(shift.scheduled_end).getTime() - new Date(shift.scheduled_start).getTime();
  return ms > 0 ? ms / 3_600_000 : 0;
}

export interface RosterRow {
  workerId: string;
  days: RosterShift[][];
  hours: number;
}

/** One row per worker (plus an "unassigned" row when unfilled shifts exist). */
export function rosterRows(shifts: RosterShift[], weekStart: Date, workerIds: string[] = []): RosterRow[] {
  const week = shifts.filter((s) => isInWeek(s, weekStart));
  const ids = new Set<string>(workerIds);
  week.forEach((s) => ids.add(s.worker_id || UNASSIGNED));

  const days = weekDays(weekStart);
  const rows = [...ids].map((workerId) => {
    const mine = week.filter((s) => (s.worker_id || UNASSIGNED) === workerId);
    return {
      workerId,
      days: days.map((d) => mine.filter((s) => sameDay(new Date(s.scheduled_start), d)).sort(byStart)),
      hours: mine.reduce((sum, s) => sum + scheduledHours(s), 0),
    };
  });

  // Unfilled work stays at the top so it cannot be missed.
  return rows.sort((a, b) => (a.workerId === UNASSIGNED ? -1 : b.workerId === UNASSIGNED ? 1 : 0));
}

function byStart(a: RosterShift, b: RosterShift): number {
  return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
}

/* ---------------- Conflicts ---------------- */

export function overlaps(a: RosterShift, b: RosterShift): boolean {
  const aStart = new Date(a.scheduled_start).getTime();
  const aEnd = new Date(a.scheduled_end).getTime();
  const bStart = new Date(b.scheduled_start).getTime();
  const bEnd = new Date(b.scheduled_end).getTime();
  return aStart < bEnd && bStart < aEnd;
}

const LIVE_STATUSES = ["scheduled", "checked_in", "in_progress", "correction_required", "submitted", "approved"];

function isLive(shift: RosterShift): boolean {
  return !shift.status || LIVE_STATUSES.includes(shift.status);
}

/** Ids of shifts that double-book the same worker. */
export function conflictingShiftIds(shifts: RosterShift[]): Set<string> {
  const conflicts = new Set<string>();
  const live = shifts.filter((s) => isLive(s) && s.worker_id);
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      if (live[i].worker_id === live[j].worker_id && overlaps(live[i], live[j])) {
        conflicts.add(live[i].id);
        conflicts.add(live[j].id);
      }
    }
  }
  return conflicts;
}

/** Shifts already held by `workerId` that clash with the candidate window. */
export function clashesForWorker(shifts: RosterShift[], workerId: string, candidate: RosterShift): RosterShift[] {
  return shifts.filter(
    (s) => s.id !== candidate.id && isLive(s) && s.worker_id === workerId && overlaps(s, candidate)
  );
}

/* ---------------- Coverage ---------------- */

export interface RosterCoverage {
  total: number;
  unfilled: number;
  conflicts: number;
  scheduledHours: number;
  deliveredHours: number;
  kilometres: number;
}

export function rosterCoverage(shifts: RosterShift[]): RosterCoverage {
  const live = shifts.filter(isLive);
  const delivered = live.reduce((sum, s) => {
    if (!s.actual_start || !s.actual_end) return sum;
    const ms = new Date(s.actual_end).getTime() - new Date(s.actual_start).getTime();
    return sum + (ms > 0 ? ms / 3_600_000 : 0);
  }, 0);
  return {
    total: live.length,
    unfilled: live.filter((s) => !s.worker_id).length,
    conflicts: conflictingShiftIds(live).size,
    scheduledHours: round2(live.reduce((sum, s) => sum + scheduledHours(s), 0)),
    deliveredHours: round2(delivered),
    kilometres: round2(live.reduce((sum, s) => sum + (Number(s.transport_kilometres) || 0), 0)),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ---------------- Reassignment gate ---------------- */

export function reassignBlockers(args: {
  shift: { status?: string | null };
  workerId?: string | null;
  workerEligible?: boolean;
  workerEligibilityReason?: string;
  clashes?: RosterShift[];
}): string[] {
  const blockers: string[] = [];
  if (!args.workerId) blockers.push("Select a worker to assign.");
  const status = args.shift.status ?? "scheduled";
  if (!["scheduled", "correction_required"].includes(status)) {
    blockers.push("Only a scheduled shift can be reassigned. Cancel or correct the shift first.");
  }
  if (args.workerEligible === false) {
    blockers.push(args.workerEligibilityReason || "Worker is not eligible for assignment.");
  }
  if (args.clashes && args.clashes.length > 0) {
    blockers.push(`Worker already has ${args.clashes.length} overlapping shift(s) at that time.`);
  }
  return blockers;
}
