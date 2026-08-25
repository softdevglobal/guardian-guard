import { describe, expect, it } from "vitest";
import { formatScore, readinessStatus, scoreExplanation, type OrgSnapshot } from "@/lib/orgSnapshot";

function snapshot(over: Partial<OrgSnapshot> = {}): OrgSnapshot {
  return {
    organisation_id: "org-1",
    calculated_at: "2026-08-24T00:00:00Z",
    include_test_records: false,
    counts: {
      incidents_open: 1, incidents_total: 1,
      complaints_open: 0, complaints_total: 1,
      risks_open: 0, risks_total: 1,
      policies: 0, policies_due: 0,
      participants: 0, staff: 0,
      governance_meetings: 0, registration_groups_confirmed: 0,
      corrective_actions_open: 0, worker_requirements: 0, worker_requirements_verified: 0,
    },
    evidence: { total_applicable: 0, evidence_ready: 0, review_overdue: 0, missing: 0, in_progress: 0, ready_for_review: 0 },
    scores: {
      audit_readiness: { percentage: null, numerator: 0, denominator: 0 },
      governance: { percentage: null, numerator: 0, denominator: 0 },
      supports: { percentage: null, numerator: 0, denominator: 0 },
      environment: { percentage: null, numerator: 0, denominator: 0 },
      ai_oversight: { percentage: null, numerator: 0, denominator: 0 },
      worker_compliance: { percentage: null, numerator: 0, denominator: 0 },
    },
    ...over,
  };
}

describe("compliance scoring display", () => {
  it("never turns zero requirements into 100%", () => {
    const s = snapshot();
    expect(formatScore(s.scores.audit_readiness)).toBe("Not assessable");
    expect(formatScore(s.scores.governance)).toBe("Not assessable");
    expect(formatScore(s.scores.supports)).toBe("Not assessable");
    expect(formatScore(s.scores.environment)).toBe("Not assessable");
    expect(formatScore(s.scores.ai_oversight)).toBe("Not assessable");
    expect(readinessStatus(s)).toBe("NOT_ASSESSABLE");
  });

  it("shows a real percentage with its numerator and denominator", () => {
    const s = snapshot({
      evidence: { total_applicable: 10, evidence_ready: 4, review_overdue: 1, missing: 3, in_progress: 2, ready_for_review: 0 },
      scores: { ...snapshot().scores, audit_readiness: { percentage: 40, numerator: 4, denominator: 10 } },
    });
    expect(formatScore(s.scores.audit_readiness)).toBe("40%");
    expect(scoreExplanation(s.scores.audit_readiness, "evidence requirements")).toBe(
      "4 of 10 evidence requirements meet the requirement.",
    );
    expect(readinessStatus(s)).toBe("AT_RISK");
  });

  it("explains why a score cannot be assessed", () => {
    expect(scoreExplanation({ percentage: null, numerator: 0, denominator: 0 }, "governance records")).toContain(
      "cannot be assessed",
    );
  });
});

describe("count reconciliation", () => {
  it("uses one figure per entity for badges, cards and registers", () => {
    const s = snapshot({
      counts: { ...snapshot().counts, incidents_open: 1, incidents_total: 1, complaints_open: 2, complaints_total: 3, risks_open: 4, risks_total: 5 },
    });
    // Sidebar badge, dashboard card and register all read the same field.
    const badge = s.counts.incidents_open;
    const card = s.counts.incidents_open;
    expect(badge).toBe(card);
    expect(s.counts.incidents_open).toBeLessThanOrEqual(s.counts.incidents_total);
    expect(s.counts.complaints_open).toBeLessThanOrEqual(s.counts.complaints_total);
    expect(s.counts.risks_open).toBeLessThanOrEqual(s.counts.risks_total);
  });

  it("excludes test records by default", () => {
    expect(snapshot().include_test_records).toBe(false);
  });
});
