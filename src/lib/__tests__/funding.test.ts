import { describe, expect, it } from "vitest";
import { fundingBlockers, fundingFlag, remainingBudget, utilisationPercent } from "@/lib/funding";

const base = {
  participant_id: "p1",
  support_category: "core_daily_activities",
  allocated_budget: 10000,
  committed_budget: 2000,
  claimed_amount: 1000,
  plan_start_date: "2026-01-01",
  plan_end_date: "2026-12-31",
};

describe("fundingBlockers", () => {
  it("accepts a complete allocation", () => {
    expect(fundingBlockers(base)).toEqual([]);
  });

  it("requires a participant, a category and a positive budget", () => {
    expect(fundingBlockers({})).toContain("Select a participant.");
    expect(fundingBlockers({})).toContain("Allocated budget must be greater than zero.");
  });

  it("blocks commitments beyond the allocation", () => {
    expect(fundingBlockers({ ...base, committed_budget: 9000, claimed_amount: 5000 })).toContain(
      "Committed plus claimed cannot exceed the allocated budget."
    );
  });

  it("blocks an end date on or before the start date", () => {
    expect(fundingBlockers({ ...base, plan_end_date: "2026-01-01" })).toContain("Plan end date must be after the plan start date.");
  });
});

describe("budget maths", () => {
  it("computes the remaining balance", () => {
    expect(remainingBudget(base)).toBe(7000);
  });

  it("caps utilisation at 100 and floors it at 0", () => {
    expect(utilisationPercent(base)).toBe(30);
    expect(utilisationPercent({ allocated_budget: 100, committed_budget: 500, claimed_amount: 0 })).toBe(100);
    expect(utilisationPercent({ allocated_budget: 0 })).toBe(0);
  });
});

describe("fundingFlag", () => {
  it("flags over-commitment first", () => {
    expect(fundingFlag({ ...base, committed_budget: 20000 }, "2026-06-01")).toBe("over_committed");
  });

  it("flags an expired plan", () => {
    expect(fundingFlag(base, "2027-01-05")).toBe("plan_expired");
  });

  it("flags near exhaustion and plans ending soon", () => {
    expect(fundingFlag({ ...base, committed_budget: 8500 }, "2026-06-01")).toBe("nearly_exhausted");
    expect(fundingFlag(base, "2026-12-15")).toBe("plan_ending_soon");
  });

  it("reports on track otherwise", () => {
    expect(fundingFlag(base, "2026-06-01")).toBe("on_track");
  });
});
