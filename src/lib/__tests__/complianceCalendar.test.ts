import { describe, expect, it } from "vitest";
import {
  actionableEvents,
  buildCalendar,
  daysBetween,
  summariseCalendar,
  urgencyFor,
  urgencyLabel,
  urgencyTone,
} from "@/lib/complianceCalendar";

const NOW = new Date("2026-03-01T09:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString().slice(0, 10);

describe("daysBetween", () => {
  it("counts whole days ignoring time of day", () => {
    expect(daysBetween(inDays(10), NOW)).toBe(10);
    expect(daysBetween(inDays(-3), NOW)).toBe(-3);
  });

  it("returns NaN for an unusable date", () => {
    expect(Number.isNaN(daysBetween("not-a-date", NOW))).toBe(true);
  });
});

describe("urgency bands", () => {
  it("bands by the expiry windows", () => {
    expect(urgencyFor(-1)).toBe("expired");
    expect(urgencyFor(0)).toBe("critical");
    expect(urgencyFor(14)).toBe("critical");
    expect(urgencyFor(15)).toBe("due_soon");
    expect(urgencyFor(30)).toBe("due_soon");
    expect(urgencyFor(31)).toBe("upcoming");
  });

  it("maps to tones and labels", () => {
    expect(urgencyTone("expired")).toBe("bad");
    expect(urgencyTone("due_soon")).toBe("warn");
    expect(urgencyLabel("critical")).toBe("Critical");
  });
});

describe("buildCalendar", () => {
  it("merges every dated source and sorts by urgency", () => {
    const events = buildCalendar(
      {
        documents: [
          { id: "d1", title: "Public liability insurance", expiry_date: inDays(20), is_critical: true },
          { id: "d2", title: "Undated policy", expiry_date: null },
        ],
        personnel: [{ id: "p1", full_name: "A. Director", worker_screening_expiry: inDays(-5), police_check_expiry: inDays(200) }],
        policies: [{ id: "po1", title: "Incident management", next_review_date: inDays(5) }],
        correctiveActions: [
          { id: "c1", action: "Retrain staff", due_date: inDays(2), status: "open" },
          { id: "c2", action: "Closed action", due_date: inDays(1), status: "complete" },
        ],
        platformTasks: [{ id: "t1", title: "Upload constitution", due_date: inDays(7), status: "assigned" }],
        registration: { expiry: inDays(400), number: "4-ABC" },
      },
      NOW,
    );

    expect(events[0].title).toContain("worker screening");
    expect(events.map((e) => e.id)).not.toContain("corrective_action:c2");
    expect(events.find((e) => e.id === "document:d2")).toBeUndefined();
    expect(events.find((e) => e.source === "registration")?.urgency).toBe("upcoming");
  });

  it("summarises and filters to the actionable window", () => {
    const events = buildCalendar(
      {
        documents: [
          { id: "a", title: "Expired", expiry_date: inDays(-1) },
          { id: "b", title: "Critical", expiry_date: inDays(3) },
          { id: "c", title: "Due soon", expiry_date: inDays(25) },
          { id: "d", title: "Far away", expiry_date: inDays(300) },
        ],
      },
      NOW,
    );
    expect(summariseCalendar(events)).toEqual({ expired: 1, critical: 1, dueSoon: 1, upcoming: 1, total: 4 });
    expect(actionableEvents(events)).toHaveLength(3);
  });
});
