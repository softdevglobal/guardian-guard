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
} from "@/lib/notificationRules";

/**
 * These tests simulate the compliance-automation edge function's decision logic
 * by testing the same rules the function uses. Each test verifies:
 * - correct notification title pattern
 * - correct severity
 * - correct source_table
 * - correct recipient routing
 * - correct exclusion when conditions don't apply
 */

const NOW = new Date("2026-04-07T12:00:00Z");

// ── Helper: simulates the edge function's payload construction ──

interface SimulatedPayload {
  title: string;
  severity: string;
  source_table: string;
  source_record_id: string;
  notification_type: string;
  recipients: string[];
}

function simulateStaleIncidentPayload(incident: {
  id: string;
  incident_number: string;
  assigned_to: string | null;
  reported_by: string;
  createdAt: string;
  status: string;
}): SimulatedPayload | null {
  if (!isStaleIncident({ createdAt: incident.createdAt, status: incident.status }, NOW)) {
    return null;
  }

  const recipients: string[] = [];
  if (incident.assigned_to) recipients.push(incident.assigned_to);
  recipients.push(incident.reported_by);
  // In real function, compliance users from org would be added
  const recipientRoles = getStaleIncidentRecipients();

  return {
    title: `Stale incident: ${incident.incident_number}`,
    severity: staleIncidentSeverity(),
    source_table: "incidents",
    source_record_id: incident.id,
    notification_type: "stale_incident",
    recipients,
  };
}

function simulateComplaintAckPayload(complaint: {
  id: string;
  complaint_number: string;
  assigned_to: string | null;
  submitted_by: string | null;
  createdAt: string;
  acknowledgementDate: string | null;
  status: string;
}): SimulatedPayload | null {
  if (!isComplaintAckOverdue({
    createdAt: complaint.createdAt,
    acknowledgementDate: complaint.acknowledgementDate,
    status: complaint.status,
  }, NOW)) {
    return null;
  }

  const recipients: string[] = [];
  if (complaint.assigned_to) recipients.push(complaint.assigned_to);
  if (complaint.submitted_by) recipients.push(complaint.submitted_by);

  return {
    title: `Complaint ${complaint.complaint_number} needs acknowledgement`,
    severity: complaintAckSeverity(),
    source_table: "complaints",
    source_record_id: complaint.id,
    notification_type: "complaint_ack_overdue",
    recipients,
  };
}

function simulateClearancePayload(staff: {
  id: string;
  user_id: string;
  policeCheckExpiry: string | null;
  wwccExpiry: string | null;
  workerScreeningExpiry: string | null;
}): SimulatedPayload | null {
  const result = classifyClearanceSeverity({
    policeCheckExpiry: staff.policeCheckExpiry,
    wwccExpiry: staff.wwccExpiry,
    workerScreeningExpiry: staff.workerScreeningExpiry,
  }, NOW);

  if (!result) return null;

  const recipients = getClearanceExpiryRecipients(result.isExpired);

  return {
    title: result.isExpired ? "Clearance EXPIRED" : "Clearance Expiry Warning",
    severity: result.severity,
    source_table: "staff_compliance",
    source_record_id: staff.id,
    notification_type: result.isExpired ? "staff_clearance_expired" : "staff_clearance_expiring",
    recipients: [staff.user_id, ...recipients.filter(r => r !== "owner").map(r => `role:${r}`)],
  };
}

function simulateSafeguardingPayload(concern: {
  id: string;
  raised_by: string;
  immediateSafetyRisk: boolean;
  status: string;
  createdAt: string;
}): SimulatedPayload | null {
  if (!isSafeguardingCritical({
    immediateSafetyRisk: concern.immediateSafetyRisk,
    status: concern.status,
    createdAt: concern.createdAt,
  }, NOW)) {
    return null;
  }

  const recipientRoles = getSafeguardingCriticalRecipients();
  return {
    title: "URGENT: Safeguarding concern unactioned 24+ hours",
    severity: safeguardingSeverity(),
    source_table: "safeguarding_concerns",
    source_record_id: concern.id,
    notification_type: "safeguarding_unactioned_critical",
    recipients: [concern.raised_by, ...recipientRoles.filter(r => r !== "reporter").map(r => `role:${r}`)],
  };
}

// ── STALE INCIDENT TESTS ──

describe("compliance-automation: stale incident notifications", () => {
  const baseIncident = {
    id: "inc-001",
    incident_number: "INC-2026-0001",
    assigned_to: "user-supervisor",
    reported_by: "user-reporter",
    createdAt: "2026-03-30T10:00:00Z", // 8 days ago
    status: "reported",
  };

  it("creates notification with correct title pattern", () => {
    const payload = simulateStaleIncidentPayload(baseIncident);
    expect(payload).not.toBeNull();
    expect(payload!.title).toBe("Stale incident: INC-2026-0001");
  });

  it("sets severity to urgent", () => {
    const payload = simulateStaleIncidentPayload(baseIncident);
    expect(payload!.severity).toBe("urgent");
  });

  it("sets source_table to incidents", () => {
    const payload = simulateStaleIncidentPayload(baseIncident);
    expect(payload!.source_table).toBe("incidents");
  });

  it("sets source_record_id to incident id", () => {
    const payload = simulateStaleIncidentPayload(baseIncident);
    expect(payload!.source_record_id).toBe("inc-001");
  });

  it("includes assigned_to and reported_by in recipients", () => {
    const payload = simulateStaleIncidentPayload(baseIncident);
    expect(payload!.recipients).toContain("user-supervisor");
    expect(payload!.recipients).toContain("user-reporter");
  });

  it("returns null for recent incident (2 days old)", () => {
    const payload = simulateStaleIncidentPayload({ ...baseIncident, createdAt: "2026-04-06T00:00:00Z" });
    expect(payload).toBeNull();
  });

  it("returns null for closed incident", () => {
    const payload = simulateStaleIncidentPayload({ ...baseIncident, status: "closed" });
    expect(payload).toBeNull();
  });

  it("returns null for actioned incident", () => {
    const payload = simulateStaleIncidentPayload({ ...baseIncident, status: "actioned" });
    expect(payload).toBeNull();
  });
});

// ── COMPLAINT ACK OVERDUE TESTS ──

describe("compliance-automation: complaint acknowledgement overdue", () => {
  const baseComplaint = {
    id: "comp-001",
    complaint_number: "CMP-2026-0001",
    assigned_to: "user-handler",
    submitted_by: "user-submitter",
    createdAt: "2026-04-03T10:00:00Z", // 4 days ago
    acknowledgementDate: null,
    status: "submitted",
  };

  it("creates notification with correct title", () => {
    const payload = simulateComplaintAckPayload(baseComplaint);
    expect(payload).not.toBeNull();
    expect(payload!.title).toBe("Complaint CMP-2026-0001 needs acknowledgement");
  });

  it("sets severity to urgent", () => {
    const payload = simulateComplaintAckPayload(baseComplaint);
    expect(payload!.severity).toBe("urgent");
  });

  it("sets source_table to complaints", () => {
    const payload = simulateComplaintAckPayload(baseComplaint);
    expect(payload!.source_table).toBe("complaints");
  });

  it("sets source_record_id to complaint id", () => {
    const payload = simulateComplaintAckPayload(baseComplaint);
    expect(payload!.source_record_id).toBe("comp-001");
  });

  it("includes handler and submitter in recipients", () => {
    const payload = simulateComplaintAckPayload(baseComplaint);
    expect(payload!.recipients).toContain("user-handler");
    expect(payload!.recipients).toContain("user-submitter");
  });

  it("returns null when already acknowledged", () => {
    const payload = simulateComplaintAckPayload({ ...baseComplaint, acknowledgementDate: "2026-04-04T00:00:00Z" });
    expect(payload).toBeNull();
  });

  it("returns null for resolved complaint", () => {
    const payload = simulateComplaintAckPayload({ ...baseComplaint, status: "resolved" });
    expect(payload).toBeNull();
  });

  it("returns null when created less than 2 days ago", () => {
    const payload = simulateComplaintAckPayload({ ...baseComplaint, createdAt: "2026-04-06T10:00:00Z" });
    expect(payload).toBeNull();
  });
});

// ── STAFF CLEARANCE EXPIRY TESTS ──

describe("compliance-automation: staff clearance expiry", () => {
  const baseStaff = {
    id: "staff-001",
    user_id: "user-staff",
    policeCheckExpiry: "2026-03-15", // expired
    wwccExpiry: null,
    workerScreeningExpiry: null,
  };

  it("creates critical notification for expired police check", () => {
    const payload = simulateClearancePayload(baseStaff);
    expect(payload).not.toBeNull();
    expect(payload!.severity).toBe("critical");
    expect(payload!.title).toBe("Clearance EXPIRED");
  });

  it("sets source_table to staff_compliance", () => {
    const payload = simulateClearancePayload(baseStaff);
    expect(payload!.source_table).toBe("staff_compliance");
  });

  it("sets notification_type to staff_clearance_expired", () => {
    const payload = simulateClearancePayload(baseStaff);
    expect(payload!.notification_type).toBe("staff_clearance_expired");
  });

  it("routes to owner + hr + supervisor when expired", () => {
    const payload = simulateClearancePayload(baseStaff);
    expect(payload!.recipients).toContain("user-staff");
    expect(payload!.recipients).toContain("role:hr");
    expect(payload!.recipients).toContain("role:supervisor");
  });

  it("creates warning for expiring-soon WWCC", () => {
    const payload = simulateClearancePayload({
      ...baseStaff,
      policeCheckExpiry: null,
      wwccExpiry: "2026-05-20",
    });
    expect(payload).not.toBeNull();
    expect(payload!.severity).toBe("warning");
    expect(payload!.title).toBe("Clearance Expiry Warning");
    expect(payload!.notification_type).toBe("staff_clearance_expiring");
  });

  it("routes only to owner when not yet expired", () => {
    const payload = simulateClearancePayload({
      ...baseStaff,
      policeCheckExpiry: null,
      wwccExpiry: "2026-05-20",
    });
    expect(payload!.recipients).toContain("user-staff");
    expect(payload!.recipients).not.toContain("role:hr");
  });

  it("returns null when no clearances are near expiry", () => {
    const payload = simulateClearancePayload({
      ...baseStaff,
      policeCheckExpiry: "2027-01-01",
    });
    expect(payload).toBeNull();
  });
});

// ── SAFEGUARDING CRITICAL TESTS ──

describe("compliance-automation: safeguarding critical notifications", () => {
  const baseConcern = {
    id: "sg-001",
    raised_by: "user-raiser",
    immediateSafetyRisk: true,
    status: "raised",
    createdAt: "2026-04-05T10:00:00Z", // > 24 hours ago
  };

  it("creates critical notification for unactioned safeguarding concern", () => {
    const payload = simulateSafeguardingPayload(baseConcern);
    expect(payload).not.toBeNull();
    expect(payload!.severity).toBe("critical");
  });

  it("sets correct title", () => {
    const payload = simulateSafeguardingPayload(baseConcern);
    expect(payload!.title).toBe("URGENT: Safeguarding concern unactioned 24+ hours");
  });

  it("sets source_table to safeguarding_concerns", () => {
    const payload = simulateSafeguardingPayload(baseConcern);
    expect(payload!.source_table).toBe("safeguarding_concerns");
  });

  it("sets source_record_id to concern id", () => {
    const payload = simulateSafeguardingPayload(baseConcern);
    expect(payload!.source_record_id).toBe("sg-001");
  });

  it("includes raiser and compliance role in recipients", () => {
    const payload = simulateSafeguardingPayload(baseConcern);
    expect(payload!.recipients).toContain("user-raiser");
    expect(payload!.recipients).toContain("role:compliance");
  });

  it("returns null when not immediate safety risk", () => {
    const payload = simulateSafeguardingPayload({ ...baseConcern, immediateSafetyRisk: false });
    expect(payload).toBeNull();
  });

  it("returns null when already screened", () => {
    const payload = simulateSafeguardingPayload({ ...baseConcern, status: "screened" });
    expect(payload).toBeNull();
  });

  it("returns null when raised less than 24 hours ago", () => {
    const payload = simulateSafeguardingPayload({ ...baseConcern, createdAt: "2026-04-07T10:00:00Z" });
    expect(payload).toBeNull();
  });
});

// ── DEDUPLICATION FINGERPRINT TESTS ──

describe("notification fingerprint deduplication", () => {
  function makeFingerprint(
    notificationType: string,
    sourceTable: string,
    sourceRecordId: string,
    userId: string,
    dateBucket: string
  ): string {
    return `${notificationType}:${sourceTable}:${sourceRecordId}:${userId}:${dateBucket}`;
  }

  it("produces deterministic fingerprint for same inputs", () => {
    const fp1 = makeFingerprint("stale_incident", "incidents", "inc-001", "user-1", "2026-04-07");
    const fp2 = makeFingerprint("stale_incident", "incidents", "inc-001", "user-1", "2026-04-07");
    expect(fp1).toBe(fp2);
  });

  it("produces different fingerprint for different users", () => {
    const fp1 = makeFingerprint("stale_incident", "incidents", "inc-001", "user-1", "2026-04-07");
    const fp2 = makeFingerprint("stale_incident", "incidents", "inc-001", "user-2", "2026-04-07");
    expect(fp1).not.toBe(fp2);
  });

  it("produces different fingerprint for different date buckets", () => {
    const fp1 = makeFingerprint("stale_incident", "incidents", "inc-001", "user-1", "2026-04-07");
    const fp2 = makeFingerprint("stale_incident", "incidents", "inc-001", "user-1", "2026-04-08");
    expect(fp1).not.toBe(fp2);
  });

  it("produces different fingerprint for different notification types", () => {
    const fp1 = makeFingerprint("stale_incident", "incidents", "inc-001", "user-1", "2026-04-07");
    const fp2 = makeFingerprint("complaint_ack_overdue", "incidents", "inc-001", "user-1", "2026-04-07");
    expect(fp1).not.toBe(fp2);
  });

  it("produces different fingerprint for different source records", () => {
    const fp1 = makeFingerprint("stale_incident", "incidents", "inc-001", "user-1", "2026-04-07");
    const fp2 = makeFingerprint("stale_incident", "incidents", "inc-002", "user-1", "2026-04-07");
    expect(fp1).not.toBe(fp2);
  });
});

// ── CONCURRENCY / CONFLICT HANDLING TESTS ──

describe("atomic deduplication conflict handling", () => {
  /**
   * These tests simulate the behavior of the `insert_notification_deduped` DB function
   * and the edge function's error handling wrapper. We can't call the actual DB function
   * in unit tests, but we verify the contract that the edge function relies on.
   */

  // Simulates the createNotificationDeduped wrapper behavior
  type InsertResult = { created: boolean; fingerprint: string };

  function simulateAtomicInsert(
    existingFingerprints: Set<string>,
    fingerprint: string
  ): InsertResult {
    // Simulates INSERT ... ON CONFLICT DO NOTHING
    if (existingFingerprints.has(fingerprint)) {
      // DB returns ROW_COUNT = 0, function returns false
      return { created: false, fingerprint };
    }
    existingFingerprints.add(fingerprint);
    return { created: true, fingerprint };
  }

  function simulateWithErrorHandling(
    existingFingerprints: Set<string>,
    fingerprint: string,
    shouldThrow: boolean = false
  ): InsertResult {
    try {
      if (shouldThrow) {
        throw new Error("Simulated unexpected DB error");
      }
      return simulateAtomicInsert(existingFingerprints, fingerprint);
    } catch {
      // Edge function catches and returns non-fatal result
      return { created: false, fingerprint };
    }
  }

  const fp = "stale_incident:incidents:inc-001:user-1:2026-04-07";

  it("first invocation creates the notification", () => {
    const db = new Set<string>();
    const result = simulateAtomicInsert(db, fp);
    expect(result.created).toBe(true);
    expect(db.has(fp)).toBe(true);
  });

  it("second invocation with same fingerprint is silently ignored", () => {
    const db = new Set<string>();
    simulateAtomicInsert(db, fp); // first
    const result = simulateAtomicInsert(db, fp); // second
    expect(result.created).toBe(false);
    expect(db.size).toBe(1); // no duplicate row
  });

  it("two concurrent invocations result in exactly one notification", () => {
    const db = new Set<string>();
    // Simulate two "concurrent" calls — both execute atomically
    const r1 = simulateAtomicInsert(db, fp);
    const r2 = simulateAtomicInsert(db, fp);
    // Exactly one should succeed
    expect([r1.created, r2.created].filter(Boolean).length).toBe(1);
    expect(db.size).toBe(1);
  });

  it("different fingerprints both succeed", () => {
    const db = new Set<string>();
    const fp2 = "complaint_ack_overdue:complaints:comp-001:user-1:2026-04-07";
    const r1 = simulateAtomicInsert(db, fp);
    const r2 = simulateAtomicInsert(db, fp2);
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(true);
    expect(db.size).toBe(2);
  });

  it("unexpected error is caught and does not crash automation", () => {
    const db = new Set<string>();
    const result = simulateWithErrorHandling(db, fp, true);
    expect(result.created).toBe(false);
    // Automation continues — no throw
  });

  it("automation continues processing after a conflict", () => {
    const db = new Set<string>();
    const results: InsertResult[] = [];

    // First batch — all new
    results.push(simulateAtomicInsert(db, fp));
    results.push(simulateAtomicInsert(db, "type2:table2:rec-2:user-2:2026-04-07"));

    // Second batch — one duplicate, one new
    results.push(simulateAtomicInsert(db, fp)); // duplicate
    results.push(simulateAtomicInsert(db, "type3:table3:rec-3:user-3:2026-04-07")); // new

    expect(results[0].created).toBe(true);
    expect(results[1].created).toBe(true);
    expect(results[2].created).toBe(false); // deduped
    expect(results[3].created).toBe(true);  // continues after conflict
    expect(db.size).toBe(3); // no duplicates
  });

  it("same event on next day creates a new notification", () => {
    const db = new Set<string>();
    const fpDay1 = "stale_incident:incidents:inc-001:user-1:2026-04-07";
    const fpDay2 = "stale_incident:incidents:inc-001:user-1:2026-04-08";
    const r1 = simulateAtomicInsert(db, fpDay1);
    const r2 = simulateAtomicInsert(db, fpDay2);
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(true);
    expect(db.size).toBe(2);
  });
});
