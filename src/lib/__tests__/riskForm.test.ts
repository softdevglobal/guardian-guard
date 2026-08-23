import { describe, expect, it } from "vitest";
import { calculateRiskScore, riskLevelFor, riskPersistenceWarnings } from "@/lib/riskForm";

const submitted = { likelihood_score: 4, impact_score: 5, review_date: "2026-12-01", review_frequency: "quarterly" };

describe("risk scoring", () => {
  it("multiplies likelihood by impact", () => {
    expect(calculateRiskScore(4, 5)).toBe(20);
    expect(riskLevelFor(20)).toBe("critical");
    expect(riskLevelFor(4)).toBe("low");
  });
});

describe("risk save verification", () => {
  it("reports no drift when the stored record matches", () => {
    expect(
      riskPersistenceWarnings(submitted, {
        likelihood_score: 4, impact_score: 5, risk_score: 20, review_date: "2026-12-01", review_frequency: "quarterly",
      }),
    ).toEqual([]);
  });

  it("warns when likelihood, impact or review fields did not persist", () => {
    const warnings = riskPersistenceWarnings(submitted, {
      likelihood_score: 2, impact_score: 2, risk_score: 4, review_date: null, review_frequency: null,
    });
    expect(warnings).toHaveLength(5);
    expect(warnings.join(" ")).toContain("Review date stored as empty");
  });

  it("warns when nothing is returned from the database", () => {
    expect(riskPersistenceWarnings(submitted, null)).toHaveLength(1);
  });
});
