/**
 * Compliance calendar and expiry engine.
 *
 * Pure helpers only: they turn dated compliance records (documents, personnel
 * screening, policies, corrective actions, registration) into a single list of
 * calendar events with a consistent urgency band. Nothing here asserts
 * compliance — an authorised person must review every item.
 */

export type CalendarSource =
  | "document"
  | "personnel_screening"
  | "personnel_police_check"
  | "policy_review"
  | "corrective_action"
  | "registration"
  | "platform_task";

export type Urgency = "expired" | "critical" | "due_soon" | "upcoming";

export interface CalendarEvent {
  id: string;
  title: string;
  source: CalendarSource;
  dueDate: string;
  daysUntil: number;
  urgency: Urgency;
  detail?: string;
  link?: string;
}

/** Windows, in days, used across the expiry engine. */
export const EXPIRY_WINDOWS = { critical: 14, dueSoon: 30, upcoming: 90 } as const;

export function daysBetween(dueDate: string, now = new Date()): number {
  const target = new Date(`${dueDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return Number.NaN;
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function urgencyFor(days: number): Urgency {
  if (days < 0) return "expired";
  if (days <= EXPIRY_WINDOWS.critical) return "critical";
  if (days <= EXPIRY_WINDOWS.dueSoon) return "due_soon";
  return "upcoming";
}

export function urgencyTone(urgency: Urgency): "bad" | "warn" | "ok" | "neutral" {
  if (urgency === "expired" || urgency === "critical") return "bad";
  if (urgency === "due_soon") return "warn";
  if (urgency === "upcoming") return "neutral";
  return "ok";
}

export function urgencyLabel(urgency: Urgency): string {
  return {
    expired: "Expired",
    critical: "Critical",
    due_soon: "Due soon",
    upcoming: "Upcoming",
  }[urgency];
}

export function makeEvent(
  input: { id: string; title: string; source: CalendarSource; dueDate?: string | null; detail?: string; link?: string },
  now = new Date(),
): CalendarEvent | null {
  if (!input.dueDate) return null;
  const days = daysBetween(input.dueDate, now);
  if (Number.isNaN(days)) return null;
  return {
    id: `${input.source}:${input.id}`,
    title: input.title,
    source: input.source,
    dueDate: input.dueDate.slice(0, 10),
    daysUntil: days,
    urgency: urgencyFor(days),
    detail: input.detail,
    link: input.link,
  };
}

export interface CalendarInputs {
  documents?: { id: string; title: string; expiry_date?: string | null; is_critical?: boolean | null }[];
  personnel?: {
    id: string;
    full_name: string;
    worker_screening_expiry?: string | null;
    police_check_expiry?: string | null;
  }[];
  policies?: { id: string; title: string; next_review_date?: string | null }[];
  correctiveActions?: { id: string; action: string; due_date?: string | null; status: string }[];
  platformTasks?: { id: string; title: string; due_date?: string | null; status: string }[];
  registration?: { expiry?: string | null; number?: string | null } | null;
}

/** Builds the full calendar, newest deadline first. */
export function buildCalendar(inputs: CalendarInputs, now = new Date()): CalendarEvent[] {
  const events: (CalendarEvent | null)[] = [];

  for (const d of inputs.documents ?? []) {
    events.push(
      makeEvent(
        {
          id: d.id,
          title: d.title,
          source: "document",
          dueDate: d.expiry_date,
          detail: d.is_critical ? "Critical document" : "Supporting document",
          link: "/evidence-room",
        },
        now,
      ),
    );
  }

  for (const p of inputs.personnel ?? []) {
    events.push(
      makeEvent(
        { id: p.id, title: `${p.full_name} — worker screening`, source: "personnel_screening", dueDate: p.worker_screening_expiry, link: "/registration" },
        now,
      ),
    );
    events.push(
      makeEvent(
        { id: p.id, title: `${p.full_name} — police check`, source: "personnel_police_check", dueDate: p.police_check_expiry, link: "/registration" },
        now,
      ),
    );
  }

  for (const p of inputs.policies ?? []) {
    events.push(
      makeEvent({ id: p.id, title: `${p.title} — policy review`, source: "policy_review", dueDate: p.next_review_date, link: "/policies" }, now),
    );
  }

  for (const a of inputs.correctiveActions ?? []) {
    if (a.status === "complete") continue;
    events.push(
      makeEvent({ id: a.id, title: a.action, source: "corrective_action", dueDate: a.due_date, detail: "Corrective action", link: "/corrective-actions" }, now),
    );
  }

  for (const t of inputs.platformTasks ?? []) {
    if (t.status === "approved") continue;
    events.push(
      makeEvent({ id: t.id, title: t.title, source: "platform_task", dueDate: t.due_date, detail: "Assigned by Guardian Guard", link: "/registration" }, now),
    );
  }

  if (inputs.registration?.expiry) {
    events.push(
      makeEvent(
        { id: "org", title: "NDIS registration expiry", source: "registration", dueDate: inputs.registration.expiry, detail: inputs.registration.number ?? undefined, link: "/registration" },
        now,
      ),
    );
  }

  return (events.filter(Boolean) as CalendarEvent[]).sort((a, b) => a.daysUntil - b.daysUntil);
}

export function summariseCalendar(events: CalendarEvent[]) {
  return {
    expired: events.filter((e) => e.urgency === "expired").length,
    critical: events.filter((e) => e.urgency === "critical").length,
    dueSoon: events.filter((e) => e.urgency === "due_soon").length,
    upcoming: events.filter((e) => e.urgency === "upcoming").length,
    total: events.length,
  };
}

/** Events worth surfacing on a dashboard: anything within the upcoming window. */
export function actionableEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => e.daysUntil <= EXPIRY_WINDOWS.upcoming);
}
