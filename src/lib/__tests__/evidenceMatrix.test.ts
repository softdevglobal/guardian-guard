import { describe, expect, it } from "vitest";
import {
  buildEvidencePackCSV,
  canMarkReady,
  derivedStatus,
  readyBlockers,
  summariseMatrix,
  type EvidenceRequirementLike,
} from "@/lib/evidenceMatrix";

const TODAY = new Date("2026-08-20T00:00:00Z");

function req(over: Partial<EvidenceRequirementLike> = {}): EvidenceRequirementLike {
  return {
    id: "1",
    outcome_code: "1.1",
    requirement_title: "1.1 Person-centred supports",
    required_evidence_type: "Policy + records",
    linked_policy_id: "p1",
    owner_id: "u1",
    review_date: "2026-12-01",
    status: "in_progress",
    auditor_notes: null,
    include_in_export: true,
    linked_count: 2,
    ...over,
  };
}

describe("evidence matrix readiness gate", () => {
  it("allows ready when all mandatory checks pass", () => {
    expect(canMarkReady(req(), TODAY)).toBe(true);
    expect(readyBlockers(req(), TODAY)).toEqual([]);
  });

  it("blocks ready without a linked policy", () => {
    expect(canMarkReady(req({ linked_policy_id: null }), TODAY)).toBe(false);
  });

  it("blocks ready without any linked evidence record", () => {
    expect(canMarkReady(req({ linked_count: 0 }), TODAY)).toBe(false);
  });

  it("blocks ready with a missing or past review date", () => {
    expect(canMarkReady(req({ review_date: null }), TODAY)).toBe(false);
    expect(canMarkReady(req({ review_date: "2026-01-01" }), TODAY)).toBe(false);
  });

  it("lists every failing check", () => {
    expect(readyBlockers({ linked_policy_id: null, review_date: null, linked_count: 0 }, TODAY)).toHaveLength(3);
  });
});

describe("derived status", () => {
  it("reports overdue when the review date has passed", () => {
    expect(derivedStatus(req({ status: "ready", review_date: "2026-01-01" }), TODAY)).toBe("overdue");
  });
  it("keeps the stored status otherwise", () => {
    expect(derivedStatus(req({ status: "missing" }), TODAY)).toBe("missing");
  });
});

describe("matrix summary", () => {
  it("counts by derived status and computes readiness percent", () => {
    const s = summariseMatrix(
      [
        req({ status: "ready" }),
        req({ status: "ready" }),
        req({ status: "missing" }),
        req({ status: "ready", review_date: "2020-01-01" }),
      ],
      TODAY
    );
    expect(s.total).toBe(4);
    expect(s.ready).toBe(2);
    expect(s.missing).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.readinessPct).toBe(50);
  });

  it("returns zero readiness for an empty matrix", () => {
    expect(summariseMatrix([], TODAY).readinessPct).toBe(0);
  });
});

describe("evidence pack export", () => {
  it("excludes rows flagged out of the export", () => {
    const csv = buildEvidencePackCSV([req({ include_in_export: false })], TODAY);
    expect(csv).not.toContain("Person-centred");
  });

  it("never claims compliance or certification", () => {
    const csv = buildEvidencePackCSV([req()], TODAY).toLowerCase();
    expect(csv).toContain("audit readiness");
    expect(csv).not.toContain("ndis compliant");
    expect(csv).not.toContain("certified");
    expect(csv).not.toContain("registration approved");
  });

  it("escapes quotes in notes", () => {
    const csv = buildEvidencePackCSV([req({ auditor_notes: 'He said "ok"' })], TODAY);
    expect(csv).toContain('"He said ""ok"""');
  });
});
