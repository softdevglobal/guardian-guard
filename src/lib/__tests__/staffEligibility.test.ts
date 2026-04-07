import { describe, it, expect } from "vitest";
import { ELIGIBILITY_BADGE_MAP, RECORD_STATUS_BADGE } from "../staffEligibility";

describe("ELIGIBILITY_BADGE_MAP", () => {
  const expectedStatuses = ["compliant", "expiring_soon", "non_compliant", "suspended"];

  it("has entries for all expected statuses", () => {
    expectedStatuses.forEach(status => {
      expect(ELIGIBILITY_BADGE_MAP).toHaveProperty(status);
    });
  });

  it("compliant has default variant", () => {
    expect(ELIGIBILITY_BADGE_MAP.compliant.variant).toBe("default");
    expect(ELIGIBILITY_BADGE_MAP.compliant.label).toBe("Compliant");
  });

  it("expiring_soon has outline variant", () => {
    expect(ELIGIBILITY_BADGE_MAP.expiring_soon.variant).toBe("outline");
  });

  it("non_compliant has destructive variant", () => {
    expect(ELIGIBILITY_BADGE_MAP.non_compliant.variant).toBe("destructive");
  });

  it("suspended has destructive variant", () => {
    expect(ELIGIBILITY_BADGE_MAP.suspended.variant).toBe("destructive");
  });

  it("all entries have a label and variant", () => {
    Object.values(ELIGIBILITY_BADGE_MAP).forEach(entry => {
      expect(entry.label).toBeTruthy();
      expect(entry.variant).toBeTruthy();
    });
  });
});

describe("RECORD_STATUS_BADGE", () => {
  const expectedStatuses = ["missing", "pending_review", "verified", "expiring_soon", "expired", "rejected"];

  it("has entries for all expected record statuses", () => {
    expectedStatuses.forEach(status => {
      expect(RECORD_STATUS_BADGE).toHaveProperty(status);
    });
  });

  it("verified has success className", () => {
    expect(RECORD_STATUS_BADGE.verified.className).toContain("bg-success");
  });

  it("expired has destructive className", () => {
    expect(RECORD_STATUS_BADGE.expired.className).toContain("bg-destructive");
  });

  it("rejected has destructive className", () => {
    expect(RECORD_STATUS_BADGE.rejected.className).toContain("bg-destructive");
  });

  it("missing has muted className", () => {
    expect(RECORD_STATUS_BADGE.missing.className).toContain("bg-muted");
  });

  it("pending_review has warning className", () => {
    expect(RECORD_STATUS_BADGE.pending_review.className).toContain("bg-warning");
  });

  it("all entries have a label and className", () => {
    Object.values(RECORD_STATUS_BADGE).forEach(entry => {
      expect(entry.label).toBeTruthy();
      expect(entry.className).toBeTruthy();
    });
  });
});
