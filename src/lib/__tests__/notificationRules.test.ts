import { describe, it, expect } from "vitest";
import {
  classifyClearanceSeverity,
  isStaleIncident,
  staleIncidentSeverity,
  isComplaintAckOverdue,
  complaintAckSeverity,
  isSafeguardingCritical,
  safeguardingSeverity,
  classifyRiskNotificationSeverity,
  getStaleIncidentRecipients,
  getComplaintAckRecipients,
  getClearanceExpiryRecipients,
  getSafeguardingCriticalRecipients,
} from "../notificationRules";

const NOW = new Date("2026-04-07T12:00:00Z");

// ── Stale Incident ──

describe("isStaleIncident", () => {
  it("returns true for reported incident older than 5 days", () => {
    expect(isStaleIncident({ createdAt: "2026-04-01T00:00:00Z", status: "reported" }, NOW)).toBe(true);
  });

  it("returns true for supervisor_review incident older than 5 days", () => {
    expect(isStaleIncident({ createdAt: "2026-03-30T00:00:00Z", status: "supervisor_review" }, NOW)).toBe(true);
  });

  it("returns false for recent incident", () => {
    expect(isStaleIncident({ createdAt: "2026-04-06T00:00:00Z", status: "reported" }, NOW)).toBe(false);
  });

  it("returns false for closed incident even if old", () => {
    expect(isStaleIncident({ createdAt: "2026-01-01T00:00:00Z", status: "closed" }, NOW)).toBe(false);
  });

  it("returns false for actioned incident", () => {
    expect(isStaleIncident({ createdAt: "2026-01-01T00:00:00Z", status: "actioned" }, NOW)).toBe(false);
  });

  it("severity is always urgent", () => {
    expect(staleIncidentSeverity()).toBe("urgent");
  });

  it("routes to owner, reporter, supervisor, and compliance", () => {
    const recipients = getStaleIncidentRecipients();
    expect(recipients).toContain("owner");
    expect(recipients).toContain("compliance");
    expect(recipients).toContain("supervisor");
    expect(recipients).toContain("reporter");
  });
});

// ── Complaint Acknowledgement Overdue ──

describe("isComplaintAckOverdue", () => {
  it("returns true when submitted > 2 days ago with no acknowledgement", () => {
    expect(isComplaintAckOverdue({
      createdAt: "2026-04-04T00:00:00Z",
      acknowledgementDate: null,
      status: "submitted",
    }, NOW)).toBe(true);
  });

  it("returns false when acknowledged", () => {
    expect(isComplaintAckOverdue({
      createdAt: "2026-04-01T00:00:00Z",
      acknowledgementDate: "2026-04-02T00:00:00Z",
      status: "submitted",
    }, NOW)).toBe(false);
  });

  it("returns false for resolved complaint even if old", () => {
    expect(isComplaintAckOverdue({
      createdAt: "2026-01-01T00:00:00Z",
      acknowledgementDate: null,
      status: "resolved",
    }, NOW)).toBe(false);
  });

  it("returns false when created recently", () => {
    expect(isComplaintAckOverdue({
      createdAt: "2026-04-06T00:00:00Z",
      acknowledgementDate: null,
      status: "submitted",
    }, NOW)).toBe(false);
  });

  it("severity is always urgent", () => {
    expect(complaintAckSeverity()).toBe("urgent");
  });

  it("routes to owner and compliance", () => {
    const recipients = getComplaintAckRecipients();
    expect(recipients).toContain("owner");
    expect(recipients).toContain("compliance");
    expect(recipients).not.toContain("hr");
  });
});

// ── Staff Clearance Expiry ──

describe("classifyClearanceSeverity", () => {
  it("returns critical for expired police check", () => {
    const result = classifyClearanceSeverity({
      policeCheckExpiry: "2026-04-01",
      wwccExpiry: null,
      workerScreeningExpiry: null,
    }, NOW);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("critical");
    expect(result!.isExpired).toBe(true);
    expect(result!.expiringItems).toContain("Police Check");
  });

  it("returns warning for expiring-soon WWCC (within 60 days)", () => {
    const result = classifyClearanceSeverity({
      policeCheckExpiry: null,
      wwccExpiry: "2026-05-15",
      workerScreeningExpiry: null,
    }, NOW);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("warning");
    expect(result!.isExpired).toBe(false);
    expect(result!.expiringItems).toContain("WWCC");
  });

  it("returns null for clearances not expiring within 60 days", () => {
    const result = classifyClearanceSeverity({
      policeCheckExpiry: "2027-01-01",
      wwccExpiry: "2027-06-01",
      workerScreeningExpiry: "2027-12-01",
    }, NOW);
    expect(result).toBeNull();
  });

  it("returns null when all clearances are null", () => {
    const result = classifyClearanceSeverity({
      policeCheckExpiry: null,
      wwccExpiry: null,
      workerScreeningExpiry: null,
    }, NOW);
    expect(result).toBeNull();
  });

  it("flags multiple items when both expired and expiring", () => {
    const result = classifyClearanceSeverity({
      policeCheckExpiry: "2026-03-01", // expired
      wwccExpiry: "2026-05-01",        // expiring soon
      workerScreeningExpiry: null,
    }, NOW);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("critical"); // at least one expired
    expect(result!.expiringItems).toHaveLength(2);
  });

  it("routes to owner only for warning, adds hr/supervisor for expired", () => {
    expect(getClearanceExpiryRecipients(false)).toEqual(["owner"]);
    const expired = getClearanceExpiryRecipients(true);
    expect(expired).toContain("owner");
    expect(expired).toContain("hr");
    expect(expired).toContain("supervisor");
  });
});

// ── Safeguarding Critical ──

describe("isSafeguardingCritical", () => {
  it("returns true for immediate safety risk raised > 24 hours ago", () => {
    expect(isSafeguardingCritical({
      immediateSafetyRisk: true,
      status: "raised",
      createdAt: "2026-04-05T00:00:00Z",
    }, NOW)).toBe(true);
  });

  it("returns false if not immediate safety risk", () => {
    expect(isSafeguardingCritical({
      immediateSafetyRisk: false,
      status: "raised",
      createdAt: "2026-04-01T00:00:00Z",
    }, NOW)).toBe(false);
  });

  it("returns false if status is not raised", () => {
    expect(isSafeguardingCritical({
      immediateSafetyRisk: true,
      status: "screened",
      createdAt: "2026-04-01T00:00:00Z",
    }, NOW)).toBe(false);
  });

  it("returns false if raised less than 24 hours ago", () => {
    expect(isSafeguardingCritical({
      immediateSafetyRisk: true,
      status: "raised",
      createdAt: "2026-04-07T06:00:00Z",
    }, NOW)).toBe(false);
  });

  it("severity is always critical", () => {
    expect(safeguardingSeverity()).toBe("critical");
  });

  it("routes to reporter and compliance", () => {
    const recipients = getSafeguardingCriticalRecipients();
    expect(recipients).toContain("reporter");
    expect(recipients).toContain("compliance");
    expect(recipients).not.toContain("hr");
  });
});

// ── Risk Severity Classification ──

describe("classifyRiskNotificationSeverity", () => {
  it("returns critical for Critical risk", () => {
    expect(classifyRiskNotificationSeverity({ riskLevel: "Critical" })).toBe("critical");
  });

  it("returns urgent for High risk", () => {
    expect(classifyRiskNotificationSeverity({ riskLevel: "High" })).toBe("urgent");
  });

  it("returns null for Medium risk", () => {
    expect(classifyRiskNotificationSeverity({ riskLevel: "Medium" })).toBeNull();
  });

  it("returns null for Low risk", () => {
    expect(classifyRiskNotificationSeverity({ riskLevel: "Low" })).toBeNull();
  });

  it("returns null for null risk level", () => {
    expect(classifyRiskNotificationSeverity({ riskLevel: null })).toBeNull();
  });
});
