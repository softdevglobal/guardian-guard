import { describe, expect, it } from "vitest";
import { capaBlockers, capaSummary, closureRate, isOverdue, labelValue } from "@/lib/correctiveActions";

const base = {
  action: "Retrain all staff on incident escalation",
  owner_id: "user-1",
  due_date: "2026-04-01",
  status: "open",
};

describe("capaBlockers", () => {
  it("allows a well formed open action", () => {
    expect(capaBlockers(base)).toEqual([]);
  });

  it("requires action text, owner and due date", () => {
    const blockers = capaBlockers({ action: "hi", status: "open" });
    expect(blockers).toHaveLength(3);
  });

  it("blocks completion without closure notes, evidence and approval", () => {
    const blockers = capaBlockers({ ...base, status: "complete", evidence_required: true });
    expect(blockers.some((b) => b.includes("closure notes"))).toBe(true);
    expect(blockers.some((b) => b.includes("evidence"))).toBe(true);
    expect(blockers.some((b) => b.includes("approver"))).toBe(true);
  });

  it("allows completion once closure, evidence and approval exist", () => {
    expect(
      capaBlockers({
        ...base,
        status: "complete",
        evidence_required: true,
        evidence_notes: "Training register updated",
        closure_notes: "All staff retrained and signed off",
        approved_by: "user-2",
      }),
    ).toEqual([]);
  });
});

describe("register metrics", () => {
  const now = new Date("2026-05-01T00:00:00Z");

  it("flags overdue only for open actions", () => {
    expect(isOverdue({ due_date: "2026-04-01", status: "open" }, now)).toBe(true);
    expect(isOverdue({ due_date: "2026-04-01", status: "complete" }, now)).toBe(false);
    expect(isOverdue({ status: "open" }, now)).toBe(false);
  });

  it("summarises the register", () => {
    const rows = [
      { due_date: "2026-04-01", status: "open" },
      { due_date: "2026-06-01", status: "awaiting_approval" },
      { due_date: "2026-01-01", status: "complete" },
    ];
    expect(capaSummary(rows, now)).toEqual({ total: 3, open: 2, overdue: 1, awaitingApproval: 1, complete: 1 });
    expect(closureRate(rows)).toBe(33);
    expect(closureRate([])).toBe(0);
  });

  it("labels enum values for display", () => {
    expect(labelValue("policy_review")).toBe("Policy review");
    expect(labelValue(null)).toBe("—");
  });
});
