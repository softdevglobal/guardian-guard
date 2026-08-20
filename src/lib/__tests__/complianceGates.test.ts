import { describe, expect, it } from "vitest";
import {
  agreementCoversDate,
  agreementSignBlockers,
  canFinaliseServiceDelivery,
  canViewParticipantRecord,
  containsProhibitedComplianceClaim,
  displayReportableStatus,
  hasCurrentTraining,
  incidentClosureBlockers,
  mealtimeRosterBlockers,
  medicationAlertLevel,
  medicationProfileActivationBlockers,
  medicationRecordBlockers,
  reportableAssessmentBlockers,
  reportableDueDate,
  restrictivePracticeBlockers,
  serviceDeliveryBlockers,
  silAvailability,
  supportPlanActivationBlockers,
  tenancyIsIndependentOfService,
  workerAssignmentBlockers,
} from "@/lib/complianceGates";

const TODAY = new Date("2026-08-20T09:00:00Z");

describe("service agreement gate", () => {
  const active = { status: "active", record_status: "active", start_date: "2026-01-01", end_date: "2026-12-31" };

  it("accepts a service date inside an active agreement", () => {
    expect(agreementCoversDate(active, "2026-08-20")).toBe(true);
    expect(canFinaliseServiceDelivery({ serviceDate: "2026-08-20", agreements: [active] })).toBe(true);
  });

  it("rejects draft, ended and archived agreements", () => {
    expect(agreementCoversDate({ ...active, status: "draft" }, "2026-08-20")).toBe(false);
    expect(agreementCoversDate({ ...active, status: "ended" }, "2026-08-20")).toBe(false);
    expect(agreementCoversDate({ ...active, record_status: "archived" }, "2026-08-20")).toBe(false);
  });

  it("rejects a date outside the agreement window", () => {
    expect(agreementCoversDate(active, "2025-12-31")).toBe(false);
    expect(agreementCoversDate(active, "2027-01-01")).toBe(false);
  });

  it("blocks finalising service delivery with no covering agreement", () => {
    const b = serviceDeliveryBlockers({ serviceDate: "2026-08-20", agreements: [] });
    expect(b).toHaveLength(2);
    expect(canFinaliseServiceDelivery({ serviceDate: "2026-08-20", agreements: [] })).toBe(false);
  });

  it("allows an authorised exception with a written reason", () => {
    expect(
      canFinaliseServiceDelivery({
        serviceDate: "2026-08-20",
        agreements: [],
        exceptionReason: "Emergency continuity of support; agreement renewal in progress.",
        authoriserRole: "supervisor",
      })
    ).toBe(true);
  });

  it("rejects an exception authorised by a support worker", () => {
    expect(
      canFinaliseServiceDelivery({
        serviceDate: "2026-08-20",
        agreements: [],
        exceptionReason: "Covered verbally",
        authoriserRole: "support_worker",
      })
    ).toBe(false);
  });

  it("requires signature, acknowledgements and complaints path before signing", () => {
    expect(agreementSignBlockers({})).toHaveLength(4);
    expect(
      agreementSignBlockers({
        signature_method: "electronic",
        signed_by_name: "A. Perera",
        signed_at: "2026-08-01",
        privacy_notice_acknowledged: true,
        advocate_rights_acknowledged: true,
        complaints_path: "Internal complaints, then NDIS Commission on 1800 035 544.",
      })
    ).toEqual([]);
  });
});

describe("support plan and worker assignment gates", () => {
  it("blocks activation without goals, communication method or review date", () => {
    expect(supportPlanActivationBlockers({})).toHaveLength(3);
  });

  it("blocks assignment without a plan briefing", () => {
    const b = workerAssignmentBlockers({ plan_briefing_completed: false, briefing_support_plan_id: null, workerEligible: true });
    expect(b[0]).toContain("briefed");
  });

  it("blocks assignment when worker compliance is not current", () => {
    const b = workerAssignmentBlockers({
      plan_briefing_completed: true,
      briefing_support_plan_id: "sp1",
      workerEligible: false,
      workerEligibilityReason: "Training missing: NDIS Worker Orientation",
    });
    expect(b).toHaveLength(1);
    expect(b[0]).toContain("NDIS Worker Orientation");
  });

  it("allows assignment when briefed and eligible", () => {
    expect(
      workerAssignmentBlockers({ plan_briefing_completed: true, briefing_support_plan_id: "sp1", workerEligible: true })
    ).toEqual([]);
  });
});

describe("training currency and mealtime competency gate", () => {
  const verified = { training_code: "MEALTIME_MGMT", status: "completed", verified_by: "u2", expiry_date: "2027-01-01" };

  it("accepts verified unexpired training", () => {
    expect(hasCurrentTraining([verified], "MEALTIME_MGMT", TODAY)).toBe(true);
  });

  it("rejects unverified or expired training", () => {
    expect(hasCurrentTraining([{ ...verified, verified_by: null }], "MEALTIME_MGMT", TODAY)).toBe(false);
    expect(hasCurrentTraining([{ ...verified, expiry_date: "2026-01-01" }], "MEALTIME_MGMT", TODAY)).toBe(false);
  });

  it("blocks mealtime rostering without competency", () => {
    const b = mealtimeRosterBlockers({ competencyCode: "MEALTIME_MGMT", training: [], planActive: true, today: TODAY });
    expect(b).toHaveLength(1);
  });

  it("allows mealtime rostering with an active plan and current competency", () => {
    expect(
      mealtimeRosterBlockers({ competencyCode: "MEALTIME_MGMT", training: [verified], planActive: true, today: TODAY })
    ).toEqual([]);
  });
});

describe("medication gates and alerts", () => {
  it("blocks activation without the authorised record and consent", () => {
    expect(medicationProfileActivationBlockers({ consent_obtained: false })).toHaveLength(3);
  });

  it("requires a witness when a double check is required", () => {
    const b = medicationRecordBlockers({ result: "administered", doubleCheckRequired: true, profileActive: true });
    expect(b[0]).toContain("second-person");
  });

  it("rejects the administering worker as their own witness", () => {
    const b = medicationRecordBlockers({
      result: "administered", doubleCheckRequired: true, profileActive: true, worker_id: "u1", witness_id: "u1",
    });
    expect(b.some((x) => x.includes("different worker"))).toBe(true);
  });

  it("requires a reason for refused, withheld and missed doses", () => {
    (["refused", "withheld", "missed"] as const).forEach((result) => {
      expect(medicationRecordBlockers({ result, doubleCheckRequired: false, profileActive: true }).length).toBe(1);
    });
  });

  it("escalates refused, withheld and missed results", () => {
    expect(medicationAlertLevel({ result: "missed", due_at: "2026-08-20T08:00:00Z" }, TODAY)).toBe("escalate");
    expect(medicationAlertLevel({ result: "refused", due_at: "2026-08-20T10:00:00Z" }, TODAY)).toBe("escalate");
  });

  it("flags an unrecorded dose past its due time as overdue", () => {
    expect(medicationAlertLevel({ due_at: "2026-08-20T08:00:00Z" }, TODAY)).toBe("overdue");
    expect(medicationAlertLevel({ due_at: "2026-08-20T12:00:00Z" }, TODAY)).toBe("none");
  });
});

describe("reportable incident human-decision gate", () => {
  it("never reports a determination before a human assessment", () => {
    expect(displayReportableStatus("requires_human_confirmation")).toBe("Requires human confirmation");
  });

  it("does not infer reportability from injury alone", () => {
    const closure = incidentClosureBlockers({
      description: "x", root_cause: "x", contributing_factors: "x", corrective_actions: "x",
      immediate_safety_action: "x", affected_person_support: "x", participant_communication: "x",
      participant_followup_completed: true, reportable_status: "requires_human_confirmation",
    });
    expect(closure).toHaveLength(1);
    expect(closure[0]).toContain("Compliance Officer");
  });

  it("calculates a 24 hour due date for immediate categories", () => {
    const due = reportableDueDate({ death: true }, new Date("2026-08-20T09:00:00Z"));
    expect(due.toISOString()).toBe("2026-08-21T09:00:00.000Z");
  });

  it("calculates a 5 day due date for other categories", () => {
    const due = reportableDueDate({ unauthorised_restrictive_practice: true }, new Date("2026-08-20T09:00:00Z"));
    expect(due.toISOString()).toBe("2026-08-25T09:00:00.000Z");
  });

  it("only allows compliance roles to decide, with rationale and evidence", () => {
    expect(reportableAssessmentBlockers({ decision: "reportable", assessorRole: "supervisor" })).toHaveLength(3);
    expect(
      reportableAssessmentBlockers({
        decision: "not_reportable", rationale: "No reportable category met.", evidence: "Incident report and witness statement.",
        assessorRole: "compliance_officer",
      })
    ).toEqual([]);
  });

  it("allows closure once every field and the human decision are present", () => {
    expect(
      incidentClosureBlockers({
        description: "x", root_cause: "x", contributing_factors: "x", corrective_actions: "x",
        immediate_safety_action: "x", affected_person_support: "x", participant_communication: "x",
        participant_followup_completed: true, reportable_status: "not_reportable",
      })
    ).toEqual([]);
  });
});

describe("restrictive practice authorisation", () => {
  it("blocks activation without authorisation, plan, review and human authoriser", () => {
    expect(restrictivePracticeBlockers({ is_authorised: false })).toHaveLength(5);
  });

  it("never allows a non-compliance role to authorise", () => {
    const b = restrictivePracticeBlockers({
      is_authorised: true, authorisation_reference: "AUTH-1", behaviour_support_plan_url: "url",
      least_restrictive_review: "reviewed", review_date: "2026-12-01", authoriserRole: "supervisor",
    });
    expect(b).toHaveLength(1);
    expect(b[0]).toContain("automated approval is never permitted");
  });

  it("allows a fully evidenced authorised practice", () => {
    expect(
      restrictivePracticeBlockers({
        is_authorised: true, authorisation_reference: "AUTH-1", behaviour_support_plan_url: "url",
        least_restrictive_review: "reviewed", review_date: "2026-12-01", authoriserRole: "compliance_officer",
      })
    ).toEqual([]);
  });
});

describe("SIL availability and tenancy separation", () => {
  it("is unavailable until 0138 is confirmed", () => {
    const r = silAvailability({});
    expect(r.available).toBe(false);
    expect(r.message).toContain("0138");
  });

  it("still requires an administrator to enable it after confirmation", () => {
    expect(silAvailability({ registration_group_0138_confirmed: true }).available).toBe(false);
  });

  it("is available once confirmed and enabled", () => {
    expect(silAvailability({ registration_group_0138_confirmed: true, is_enabled: true }).available).toBe(true);
  });

  it("keeps tenancy independent of the service agreement", () => {
    expect(tenancyIsIndependentOfService()).toBe(true);
  });
});

describe("participant data isolation", () => {
  const participant = { id: "p1", organisation_id: "org1", user_id: "pu1", assigned_trainer_id: "t1" };

  it("lets a participant see only their own record", () => {
    expect(canViewParticipantRecord({ viewerId: "pu1", viewerRole: "participant", viewerOrgId: "org1", participant })).toBe(true);
    expect(canViewParticipantRecord({ viewerId: "other", viewerRole: "participant", viewerOrgId: "org1", participant })).toBe(false);
  });

  it("blocks cross-organisation access for every staff role", () => {
    (["super_admin", "compliance_officer", "supervisor", "support_worker"] as const).forEach((role) => {
      expect(canViewParticipantRecord({ viewerId: "u", viewerRole: role, viewerOrgId: "org2", participant })).toBe(false);
    });
  });

  it("restricts support workers to actively assigned participants", () => {
    expect(canViewParticipantRecord({ viewerId: "w1", viewerRole: "support_worker", viewerOrgId: "org1", participant })).toBe(false);
    expect(
      canViewParticipantRecord({
        viewerId: "w1", viewerRole: "support_worker", viewerOrgId: "org1", participant,
        activeAssignments: [{ participant_id: "p1", worker_id: "w1", status: "active" }],
      })
    ).toBe(true);
    expect(
      canViewParticipantRecord({
        viewerId: "w1", viewerRole: "support_worker", viewerOrgId: "org1", participant,
        activeAssignments: [{ participant_id: "p1", worker_id: "w1", status: "ended" }],
      })
    ).toBe(false);
  });

  it("allows the assigned trainer and org compliance roles", () => {
    expect(canViewParticipantRecord({ viewerId: "t1", viewerRole: "trainer", viewerOrgId: "org1", participant })).toBe(true);
    expect(canViewParticipantRecord({ viewerId: "c1", viewerRole: "compliance_officer", viewerOrgId: "org1", participant })).toBe(true);
  });
});

describe("truthfulness guard", () => {
  it("detects prohibited compliance claims", () => {
    expect(containsProhibitedComplianceClaim("This provider is NDIS compliant")).toBe(true);
    expect(containsProhibitedComplianceClaim("Registration approved")).toBe(true);
    expect(containsProhibitedComplianceClaim("Certified provider")).toBe(true);
  });

  it("accepts audit readiness language", () => {
    expect(containsProhibitedComplianceClaim("Audit readiness: evidence ready, requires human review")).toBe(false);
  });
});
