import { describe, expect, it } from "vitest";
import {
  approvalDecisionBlockers,
  assignmentBlockers,
  attendanceExceptionRequired,
  billingSummary,
  canApproveShift,
  canEditShift,
  canViewShift,
  checkInBlockers,
  evaluateGeofence,
  evidenceUpdateBlockers,
  haversineMetres,
  photoRefusalAlternative,
  photographyAllowed,
  shiftCompletionBlockers,
  shiftDurationMinutes,
  shiftTab,
  workflowStepIndex,
  type ShiftLike,
} from "@/lib/serviceShifts";

const shift: ShiftLike = {
  id: "s1",
  organisation_id: "org-a",
  worker_id: "w1",
  participant_id: "p1",
  status: "scheduled",
};

describe("tenant and assignment isolation", () => {
  it("lets the assigned worker in their own organisation view the shift", () => {
    expect(canViewShift({ viewerId: "w1", viewerRole: "support_worker", viewerOrgId: "org-a", shift })).toBe(true);
  });

  it("blocks a worker from another organisation", () => {
    expect(canViewShift({ viewerId: "w1", viewerRole: "support_worker", viewerOrgId: "org-b", shift })).toBe(false);
  });

  it("blocks an unassigned worker in the same organisation", () => {
    expect(canViewShift({ viewerId: "w9", viewerRole: "support_worker", viewerOrgId: "org-a", shift })).toBe(false);
  });

  it("allows supervisors oversight within their organisation only", () => {
    expect(canViewShift({ viewerId: "sup", viewerRole: "supervisor", viewerOrgId: "org-a", shift })).toBe(true);
    expect(canViewShift({ viewerId: "sup", viewerRole: "supervisor", viewerOrgId: "org-b", shift })).toBe(false);
  });

  it("limits participants to their own approved records", () => {
    expect(
      canViewShift({ viewerId: "pu", viewerRole: "participant", viewerOrgId: null, shift, participantUserId: "pu" })
    ).toBe(false);
    expect(
      canViewShift({
        viewerId: "pu",
        viewerRole: "participant",
        viewerOrgId: null,
        shift: { ...shift, status: "approved" },
        participantUserId: "pu",
      })
    ).toBe(true);
  });

  it("stops a worker editing a submitted shift but allows oversight", () => {
    const submitted = { ...shift, status: "submitted" as const };
    expect(canEditShift({ viewerId: "w1", viewerRole: "support_worker", viewerOrgId: "org-a", shift: submitted })).toBe(false);
    expect(canEditShift({ viewerId: "sup", viewerRole: "supervisor", viewerOrgId: "org-a", shift: submitted })).toBe(true);
  });

  it("re-opens editing when a correction is requested", () => {
    expect(
      canEditShift({ viewerId: "w1", viewerRole: "support_worker", viewerOrgId: "org-a", shift: { ...shift, status: "correction_required" } })
    ).toBe(true);
  });
});

describe("assignment eligibility", () => {
  it("blocks check-in when the worker is not eligible", () => {
    const b = checkInBlockers({
      shift: { status: "scheduled" },
      workerEligible: false,
      workerEligibilityReason: "First aid expired",
      hasActiveAgreement: true,
    });
    expect(b.join(" ")).toContain("First aid expired");
  });

  it("allows check-in when eligible and covered by an agreement", () => {
    expect(checkInBlockers({ shift: { status: "scheduled" }, workerEligible: true, hasActiveAgreement: true })).toEqual([]);
  });

  it("blocks assignment without an agreement or participant access", () => {
    const b = assignmentBlockers({ workerEligible: true, hasActiveAgreement: false, participantAccessible: false });
    expect(b).toHaveLength(2);
  });
});

describe("geofence calculations", () => {
  it("computes a known distance", () => {
    const d = haversineMetres({ latitude: -33.8688, longitude: 151.2093 }, { latitude: -33.8700, longitude: 151.2093 });
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(180);
  });

  it("returns unknown when coordinates are missing", () => {
    expect(evaluateGeofence({ captured: null, fence: { latitude: -33.8, longitude: 151.2 } }).result).toBe("unknown");
  });

  it("marks inside, outside and inaccurate correctly", () => {
    const fence = { latitude: -33.8688, longitude: 151.2093, radius_metres: 150 };
    expect(evaluateGeofence({ captured: { latitude: -33.8689, longitude: 151.2094, accuracy_metres: 10 }, fence }).result).toBe("inside");
    expect(evaluateGeofence({ captured: { latitude: -33.88, longitude: 151.22, accuracy_metres: 10 }, fence }).result).toBe("outside");
    expect(evaluateGeofence({ captured: { latitude: -33.8689, longitude: 151.2094, accuracy_metres: 900 }, fence }).result).toBe("inaccurate");
  });

  it("requires a reason for anything other than inside", () => {
    expect(attendanceExceptionRequired("inside")).toBe(false);
    expect(attendanceExceptionRequired("outside")).toBe(true);
    expect(attendanceExceptionRequired("unknown")).toBe(true);
  });
});

describe("completion blockers", () => {
  const base = {
    shift: { actual_start: "2026-01-01T09:00:00Z", actual_end: "2026-01-01T11:00:00Z" },
    preferences: { photography_consent_status: "granted" as const },
    confirmationRecorded: true,
  };

  it("blocks when a task is still pending", () => {
    const b = shiftCompletionBlockers({ ...base, tasks: [{ id: "t1", status: "pending" }], evidence: [] });
    expect(b.join(" ")).toContain("pending");
  });

  it("blocks when required photo evidence is missing", () => {
    const b = shiftCompletionBlockers({
      ...base,
      tasks: [{ id: "t1", status: "completed", requires_before_photo: true, requires_after_photo: true }],
      evidence: [{ shift_task_id: "t1", evidence_type: "before" }],
    });
    expect(b.join(" ")).toContain("missing required photo evidence");
  });

  it("passes when an authorised exception with a reason exists", () => {
    const b = shiftCompletionBlockers({
      ...base,
      shift: { ...base.shift, evidence_exception: true, evidence_exception_reason: "Participant asked us not to photograph the bathroom." },
      tasks: [{ id: "t1", status: "completed", requires_after_photo: true }],
      evidence: [],
    });
    expect(b).toEqual([]);
  });

  it("blocks when check in or check out is missing", () => {
    const b = shiftCompletionBlockers({ ...base, shift: { actual_start: null, actual_end: null }, tasks: [], evidence: [] });
    expect(b).toHaveLength(2);
  });

  it("requires participant confirmation when the template demands it", () => {
    const b = shiftCompletionBlockers({
      ...base,
      confirmationRecorded: false,
      tasks: [{ id: "t1", status: "completed", participant_confirmation_required: true }],
      evidence: [],
    });
    expect(b.join(" ")).toContain("Participant confirmation");
  });
});

describe("photo refusal never blocks service delivery", () => {
  it("permits a documented written alternative", () => {
    const r = photoRefusalAlternative({ photography_consent_status: "withdrawn" });
    expect(r.blocksService).toBe(false);
    expect(r.requiresWrittenAlternative).toBe(true);
  });

  it("does not raise a missing-evidence blocker when photography is refused", () => {
    const b = shiftCompletionBlockers({
      shift: { actual_start: "2026-01-01T09:00:00Z", actual_end: "2026-01-01T10:00:00Z" },
      tasks: [{ id: "t1", status: "completed", requires_before_photo: true }],
      evidence: [],
      preferences: { photography_consent_status: "withdrawn" },
      confirmationRecorded: true,
    });
    expect(b).toEqual([]);
  });

  it("respects allowed evidence types", () => {
    const prefs = { photography_consent_status: "granted" as const, allowed_evidence_types: ["issue" as const] };
    expect(photographyAllowed(prefs, "issue")).toBe(true);
    expect(photographyAllowed(prefs, "before")).toBe(false);
    expect(photographyAllowed(null, "before")).toBe(false);
  });
});

describe("immutable evidence", () => {
  it("rejects changes to the stored file or hash", () => {
    const b = evidenceUpdateBlockers({ changedFields: ["storage_path", "sha256_hash"] });
    expect(b[0]).toContain("immutable");
  });

  it("requires a reason to supersede", () => {
    expect(evidenceUpdateBlockers({ changedFields: ["record_status"] })).toHaveLength(1);
    expect(evidenceUpdateBlockers({ changedFields: ["record_status"], supersedeReason: "Wrong room" })).toEqual([]);
  });

  it("allows a caption correction", () => {
    expect(evidenceUpdateBlockers({ changedFields: ["caption"] })).toEqual([]);
  });
});

describe("approval permissions", () => {
  it("only allows oversight roles to approve submitted shifts", () => {
    expect(canApproveShift("supervisor", { status: "submitted" })).toBe(true);
    expect(canApproveShift("support_worker", { status: "submitted" })).toBe(false);
    expect(canApproveShift("supervisor", { status: "scheduled" })).toBe(false);
  });

  it("requires a reason for a correction request", () => {
    expect(approvalDecisionBlockers({ role: "supervisor", decision: "request_correction" })).toHaveLength(1);
    expect(approvalDecisionBlockers({ role: "supervisor", decision: "request_correction", reason: "Missing notes" })).toEqual([]);
    expect(approvalDecisionBlockers({ role: "trainer", decision: "approve" })).toHaveLength(1);
  });
});

describe("presentation and billing summary", () => {
  it("buckets shifts into tabs", () => {
    const now = new Date("2026-03-10T08:00:00Z");
    expect(shiftTab({ scheduled_start: "2026-03-10T09:00:00Z", status: "scheduled" }, now)).toBe("today");
    expect(shiftTab({ scheduled_start: "2026-03-12T09:00:00Z", status: "scheduled" }, now)).toBe("upcoming");
    expect(shiftTab({ scheduled_start: "2026-03-10T09:00:00Z", status: "approved" }, now)).toBe("completed");
  });

  it("computes duration and kilometres for later billing", () => {
    const shifts = [
      { actual_start: "2026-01-01T09:00:00Z", actual_end: "2026-01-01T11:30:00Z", transport_kilometres: 12.5 },
      { actual_start: "2026-01-02T09:00:00Z", actual_end: "2026-01-02T10:00:00Z", transport_kilometres: 3 },
    ];
    expect(shiftDurationMinutes(shifts[0])).toBe(150);
    expect(billingSummary(shifts)).toEqual({ minutes: 210, kilometres: 15.5 });
  });

  it("advances the workflow step", () => {
    expect(workflowStepIndex({ status: "scheduled" })).toBe(1);
    expect(workflowStepIndex({ status: "checked_in", actual_start: "x", tasksPending: 2 })).toBe(3);
    expect(workflowStepIndex({ status: "in_progress", actual_start: "x", tasksPending: 0 })).toBe(4);
    expect(workflowStepIndex({ status: "submitted" })).toBe(6);
  });
});
