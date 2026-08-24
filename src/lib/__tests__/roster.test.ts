import { describe, expect, it } from "vitest";
import {
  UNASSIGNED,
  clashesForWorker,
  conflictingShiftIds,
  isInWeek,
  overlaps,
  reassignBlockers,
  rosterCoverage,
  rosterRows,
  scheduledHours,
  startOfWeek,
  weekDays,
  type RosterShift,
} from "@/lib/roster";

const shift = (over: Partial<RosterShift> & { id: string }): RosterShift => ({
  scheduled_start: "2026-03-10T09:00:00",
  scheduled_end: "2026-03-10T11:00:00",
  status: "scheduled",
  ...over,
});

describe("week maths", () => {
  it("starts the week on Monday", () => {
    expect(startOfWeek(new Date("2026-03-12T15:00:00")).getDay()).toBe(1);
    expect(weekDays(startOfWeek(new Date("2026-03-12T15:00:00")))).toHaveLength(7);
  });

  it("only includes shifts inside the week", () => {
    const week = startOfWeek(new Date("2026-03-10T09:00:00"));
    expect(isInWeek(shift({ id: "a" }), week)).toBe(true);
    expect(isInWeek(shift({ id: "b", scheduled_start: "2026-03-30T09:00:00" }), week)).toBe(false);
  });
});

describe("roster grid", () => {
  it("groups shifts by worker and day and keeps unfilled work at the top", () => {
    const week = startOfWeek(new Date("2026-03-10T09:00:00"));
    const rows = rosterRows(
      [
        shift({ id: "a", worker_id: "w1" }),
        shift({ id: "b", worker_id: null }),
        shift({ id: "c", worker_id: "w1", scheduled_start: "2026-03-11T09:00:00", scheduled_end: "2026-03-11T12:00:00" }),
      ],
      week
    );
    expect(rows[0].workerId).toBe(UNASSIGNED);
    const w1 = rows.find((r) => r.workerId === "w1")!;
    expect(w1.days[1]).toHaveLength(1); // Tuesday
    expect(w1.hours).toBe(5);
  });

  it("shows an empty row for a worker with no shifts", () => {
    const rows = rosterRows([], startOfWeek(new Date("2026-03-10T09:00:00")), ["w9"]);
    expect(rows[0]).toMatchObject({ workerId: "w9", hours: 0 });
  });

  it("computes scheduled hours", () => {
    expect(scheduledHours(shift({ id: "a" }))).toBe(2);
  });
});

describe("conflicts", () => {
  it("detects overlapping windows", () => {
    expect(overlaps(shift({ id: "a" }), shift({ id: "b", scheduled_start: "2026-03-10T10:00:00", scheduled_end: "2026-03-10T12:00:00" }))).toBe(true);
    expect(overlaps(shift({ id: "a" }), shift({ id: "b", scheduled_start: "2026-03-10T11:00:00", scheduled_end: "2026-03-10T12:00:00" }))).toBe(false);
  });

  it("flags a double-booked worker only", () => {
    const ids = conflictingShiftIds([
      shift({ id: "a", worker_id: "w1" }),
      shift({ id: "b", worker_id: "w1", scheduled_start: "2026-03-10T10:00:00", scheduled_end: "2026-03-10T12:00:00" }),
      shift({ id: "c", worker_id: "w2", scheduled_start: "2026-03-10T10:00:00", scheduled_end: "2026-03-10T12:00:00" }),
    ]);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });

  it("ignores cancelled shifts", () => {
    const ids = conflictingShiftIds([
      shift({ id: "a", worker_id: "w1" }),
      shift({ id: "b", worker_id: "w1", status: "cancelled" }),
    ]);
    expect(ids.size).toBe(0);
  });

  it("lists the clashes a candidate worker already holds", () => {
    const existing = [shift({ id: "a", worker_id: "w1" })];
    expect(clashesForWorker(existing, "w1", shift({ id: "new" }))).toHaveLength(1);
    expect(clashesForWorker(existing, "w2", shift({ id: "new" }))).toHaveLength(0);
  });
});

describe("coverage", () => {
  it("summarises fill rate, hours and kilometres", () => {
    const c = rosterCoverage([
      shift({ id: "a", worker_id: "w1", actual_start: "2026-03-10T09:05:00", actual_end: "2026-03-10T11:05:00", transport_kilometres: 12.5 }),
      shift({ id: "b", worker_id: null }),
      shift({ id: "c", worker_id: "w1", status: "cancelled" }),
    ]);
    expect(c).toEqual({ total: 2, unfilled: 1, conflicts: 0, scheduledHours: 4, deliveredHours: 2, kilometres: 12.5 });
  });
});

describe("reassignment gate", () => {
  it("requires a worker and a reassignable status", () => {
    expect(reassignBlockers({ shift: { status: "submitted" }, workerId: null })).toHaveLength(2);
  });

  it("reports eligibility and clashes", () => {
    const b = reassignBlockers({
      shift: { status: "scheduled" },
      workerId: "w1",
      workerEligible: false,
      workerEligibilityReason: "First aid expired",
      clashes: [shift({ id: "a" })],
    });
    expect(b.join(" ")).toContain("First aid expired");
    expect(b.join(" ")).toContain("overlapping");
  });

  it("clears a clean reassignment", () => {
    expect(reassignBlockers({ shift: { status: "scheduled" }, workerId: "w1", workerEligible: true, clashes: [] })).toEqual([]);
  });
});
