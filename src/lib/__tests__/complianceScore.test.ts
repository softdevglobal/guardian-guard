import { describe, expect, it } from "vitest";
import {
  COMPLIANCE_SCORE_CARDS, headlineCounts, isAssessable, overallScore, scoreBlock, scoreTone,
} from "@/lib/complianceScore";
import type { OrgSnapshot } from "@/lib/orgSnapshot";

const empty: OrgSnapshot = {
  organisation_id: "org-1",
  calculated_at: new Date().toISOString(),
  include_test_records: false,
  counts: {
    incidents_open: 0, incidents_total: 0, complaints_open: 0, complaints_total: 0,
    risks_open: 0, risks_total: 0, policies: 0, policies_due: 0, participants: 0, staff: 0,
    governance_meetings: 0, registration_groups_confirmed: 0, corrective_actions_open: 0,
    worker_requirements: 0, worker_requirements_verified: 0,
  },
  evidence: {
    total_applicable: 0, evidence_ready: 0, review_overdue: 0, missing: 0, in_progress: 0, ready_for_review: 0,
  },
  scores: {
    audit_readiness: { percentage: null, numerator: 0, denominator: 0 },
    governance: { percentage: null, numerator: 0, denominator: 0 },
    supports: { percentage: null, numerator: 0, denominator: 0 },
    environment: { percentage: null, numerator: 0, denominator: 0 },
    ai_oversight: { percentage: null, numerator: 0, denominator: 0 },
    worker_compliance: { percentage: null, numerator: 0, denominator: 0 },
  },
};

describe("compliance scoring service", () => {
  it("treats zero-denominator scores as not assessable", () => {
    for (const card of COMPLIANCE_SCORE_CARDS) {
      expect(isAssessable(scoreBlock(empty, card.key))).toBe(false);
    }
    expect(overallScore(empty)).toBeNull();
  });

  it("never returns 100% for AI oversight with no AI records", () => {
    expect(scoreBlock(empty, "ai_oversight")?.percentage).toBeNull();
  });

  it("never returns 100% for worker compliance with no worker requirements", () => {
    expect(scoreBlock(empty, "worker_compliance")?.percentage).toBeNull();
  });

  it("strips a percentage that arrives with a zero denominator", () => {
    const bad = { ...empty, scores: { ...empty.scores, governance: { percentage: 100, numerator: 0, denominator: 0 } } };
    expect(scoreBlock(bad, "governance")?.percentage).toBeNull();
  });

  it("averages only the assessable categories", () => {
    const snap: OrgSnapshot = {
      ...empty,
      scores: {
        ...empty.scores,
        audit_readiness: { percentage: 80, numerator: 8, denominator: 10 },
        governance: { percentage: 60, numerator: 3, denominator: 5 },
      },
    };
    expect(overallScore(snap)?.percentage).toBe(70);
  });

  it("exposes the same counts both pages render", () => {
    const snap: OrgSnapshot = { ...empty, counts: { ...empty.counts, incidents_open: 3, risks_open: 2 } };
    const counts = headlineCounts(snap);
    expect(counts.find((c) => c.key === "incidents_open")?.value).toBe(3);
    expect(counts.find((c) => c.key === "risks_open")?.value).toBe(2);
  });

  it("maps tone bands", () => {
    expect(scoreTone(null)).toBe("neutral");
    expect(scoreTone({ percentage: 90, numerator: 9, denominator: 10 })).toBe("good");
    expect(scoreTone({ percentage: 65, numerator: 6, denominator: 10 })).toBe("warn");
    expect(scoreTone({ percentage: 10, numerator: 1, denominator: 10 })).toBe("bad");
  });
});
