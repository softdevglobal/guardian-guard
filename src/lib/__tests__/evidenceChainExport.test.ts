import { describe, it, expect } from "vitest";
import {
  exportEvidenceChainCSV,
  csvSafe,
  computeWorkflowCompleteness,
  type EvidenceChainData,
  type WorkflowCompletenessResult,
} from "../evidenceChainExport";

function makeEmptyData(overrides?: Partial<EvidenceChainData>): EvidenceChainData {
  return {
    participant: { first_name: "Jane", last_name: "Doe", ndis_number: "NDIS-001" },
    incidents: [],
    risks: [],
    complaints: [],
    safeguarding: [],
    incidentActions: [],
    auditLogs: [],
    staffInvolved: [],
    incidentWorkflow: [],
    complaintWorkflow: [],
    ...overrides,
  };
}

describe("csvSafe", () => {
  it("returns empty string for null/undefined", () => {
    expect(csvSafe(null)).toBe("");
    expect(csvSafe(undefined)).toBe("");
  });

  it("returns plain string as-is", () => {
    expect(csvSafe("hello")).toBe("hello");
  });

  it("wraps strings containing commas in quotes", () => {
    expect(csvSafe("hello, world")).toBe('"hello, world"');
  });

  it("escapes double quotes by doubling them", () => {
    expect(csvSafe('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps strings containing newlines", () => {
    expect(csvSafe("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles combo of comma and quote", () => {
    expect(csvSafe('a,"b"')).toBe('"a,""b"""');
  });
});

describe("exportEvidenceChainCSV", () => {
  it("produces correct header with participant info", () => {
    const csv = exportEvidenceChainCSV(makeEmptyData());
    const lines = csv.split("\n");
    expect(lines[0]).toBe("EVIDENCE CHAIN EXPORT");
    expect(lines[1]).toContain("Jane Doe");
    expect(lines[2]).toContain("NDIS-001");
    expect(lines[3]).toContain("Export Date");
  });

  it("includes all section headers even with empty data", () => {
    const csv = exportEvidenceChainCSV(makeEmptyData());
    expect(csv).toContain("--- WORKFLOW COMPLETENESS ---");
    expect(csv).toContain("--- INCIDENTS ---");
    expect(csv).toContain("--- INCIDENT WORKFLOW HISTORY ---");
    expect(csv).toContain("--- RISKS ---");
    expect(csv).toContain("--- COMPLAINTS ---");
    expect(csv).toContain("--- COMPLAINT WORKFLOW HISTORY ---");
    expect(csv).toContain("--- SAFEGUARDING CONCERNS ---");
    expect(csv).toContain("--- STAFF INVOLVED ---");
    expect(csv).toContain("--- CORRECTIVE ACTIONS ---");
    expect(csv).toContain("--- AUDIT LOG (ALL LINKED RECORDS) ---");
  });

  it("renders incident rows correctly", () => {
    const data = makeEmptyData({
      incidents: [{
        incident_number: "INC-001", title: "Fall", incident_type: "injury",
        severity: "high", status: "submitted", date_of_incident: "2026-04-01",
        is_reportable: true, ndis_notification_deadline: "2026-04-02T00:00:00Z",
        created_at: "2026-04-01T10:00:00Z",
      }],
    });
    const csv = exportEvidenceChainCSV(data);
    expect(csv).toContain("INC-001,Fall,injury,high,submitted,2026-04-01,Yes,2026-04-02T00:00:00Z");
  });

  it("renders risks rows correctly", () => {
    const data = makeEmptyData({
      risks: [{
        title: "Medication risk", category: "clinical", risk_level: "High",
        risk_score: 12, status: "open", date_identified: "2026-03-15",
        created_at: "2026-03-15T10:00:00Z",
      }],
    });
    const csv = exportEvidenceChainCSV(data);
    expect(csv).toContain("Medication risk,clinical,High,12,open,2026-03-15");
  });

  it("renders complaint rows", () => {
    const data = makeEmptyData({
      complaints: [{
        complaint_number: "CMP-001", subject: "Rude staff", priority: "high",
        status: "submitted", created_at: "2026-04-01T10:00:00Z",
      }],
    });
    const csv = exportEvidenceChainCSV(data);
    expect(csv).toContain("CMP-001,Rude staff,high,submitted");
  });

  it("renders safeguarding rows", () => {
    const data = makeEmptyData({
      safeguarding: [{
        concern_type: "abuse", status: "open", date_raised: "2026-04-01",
        immediate_safety_risk: true, escalation_level: "level_2",
      }],
    });
    const csv = exportEvidenceChainCSV(data);
    expect(csv).toContain("abuse,open,2026-04-01,Yes,level_2");
  });

  it("renders staff involved", () => {
    const data = makeEmptyData({
      staffInvolved: [{ full_name: "Alice Smith", email: "alice@test.com" }],
    });
    const csv = exportEvidenceChainCSV(data);
    expect(csv).toContain("Alice Smith,alice@test.com");
  });

  it("renders corrective actions", () => {
    const data = makeEmptyData({
      incidentActions: [{
        description: "Review procedure", action_type: "corrective",
        status: "completed", due_date: "2026-04-10", completed_at: "2026-04-09",
      }],
    });
    const csv = exportEvidenceChainCSV(data);
    expect(csv).toContain("Review procedure,corrective,completed,2026-04-10,2026-04-09");
  });

  it("renders audit logs with record_id", () => {
    const data = makeEmptyData({
      auditLogs: [{
        action: "created", module: "incidents", record_id: "abc-123",
        user_name: "Admin", severity: "normal", created_at: "2026-04-01T10:00:00Z",
      }],
    });
    const csv = exportEvidenceChainCSV(data);
    expect(csv).toContain("created,incidents,abc-123,Admin,normal,2026-04-01T10:00:00Z");
  });

  it("renders incident workflow history", () => {
    const data = makeEmptyData({
      incidentWorkflow: [{
        incident_id: "inc-1", from_status: "draft", to_status: "submitted",
        changed_by: "user-1", created_at: "2026-04-01T10:00:00Z", notes: null,
      }],
    });
    const csv = exportEvidenceChainCSV(data);
    expect(csv).toContain("inc-1,draft,submitted,user-1,2026-04-01T10:00:00Z,");
  });

  it("renders complaint workflow history", () => {
    const data = makeEmptyData({
      complaintWorkflow: [{
        complaint_id: "cmp-1", from_status: "submitted", to_status: "acknowledged",
        changed_by: "user-2", created_at: "2026-04-02T10:00:00Z", notes: "Ack'd",
      }],
    });
    const csv = exportEvidenceChainCSV(data);
    expect(csv).toContain("cmp-1,submitted,acknowledged,user-2,2026-04-02T10:00:00Z,Ack'd");
  });

  it("escapes titles with commas in incident rows", () => {
    const data = makeEmptyData({
      incidents: [{
        incident_number: "INC-002", title: "Fall, serious", incident_type: "injury",
        severity: "high", status: "submitted", date_of_incident: null,
        is_reportable: false, ndis_notification_deadline: null,
        created_at: "2026-04-01T10:00:00Z",
      }],
    });
    const csv = exportEvidenceChainCSV(data);
    expect(csv).toContain('"Fall, serious"');
  });
});

describe("computeWorkflowCompleteness", () => {
  it("returns empty array for empty inputs", () => {
    const result = computeWorkflowCompleteness([], [], [], []);
    expect(result).toEqual([]);
  });

  it("detects complete incident workflow", () => {
    const incidents = [{ id: "i1", incident_number: "INC-001", status: "investigating" }];
    const workflow = [
      { incident_id: "i1", to_status: "submitted" },
      { incident_id: "i1", to_status: "supervisor_review" },
      { incident_id: "i1", to_status: "compliance_review" },
      { incident_id: "i1", to_status: "investigating" },
    ];
    const result = computeWorkflowCompleteness(incidents, [], workflow, []);
    expect(result).toHaveLength(1);
    expect(result[0].isComplete).toBe(true);
    expect(result[0].missingSteps).toEqual([]);
  });

  it("detects missing incident workflow steps", () => {
    const incidents = [{ id: "i1", incident_number: "INC-001", status: "investigating" }];
    const workflow = [
      { incident_id: "i1", to_status: "submitted" },
      { incident_id: "i1", to_status: "investigating" },
    ];
    const result = computeWorkflowCompleteness(incidents, [], workflow, []);
    expect(result[0].isComplete).toBe(false);
    expect(result[0].missingSteps).toContain("supervisor_review");
    expect(result[0].missingSteps).toContain("compliance_review");
  });

  it("detects complete complaint workflow", () => {
    const complaints = [{ id: "c1", complaint_number: "CMP-001", status: "resolved" }];
    const workflow = [
      { complaint_id: "c1", to_status: "acknowledged" },
      { complaint_id: "c1", to_status: "under_review" },
      { complaint_id: "c1", to_status: "investigating" },
      { complaint_id: "c1", to_status: "resolved" },
    ];
    const result = computeWorkflowCompleteness([], complaints, [], workflow);
    expect(result[0].isComplete).toBe(true);
  });

  it("handles draft/submitted status with no expected steps", () => {
    const incidents = [{ id: "i1", incident_number: "INC-001", status: "draft" }];
    const result = computeWorkflowCompleteness(incidents, [], [], []);
    expect(result[0].expectedSteps).toEqual([]);
    expect(result[0].isComplete).toBe(false); // no steps = not complete
  });

  it("handles submitted status with one expected step", () => {
    const incidents = [{ id: "i1", incident_number: "INC-001", status: "submitted" }];
    const workflow = [{ incident_id: "i1", to_status: "submitted" }];
    const result = computeWorkflowCompleteness(incidents, [], workflow, []);
    expect(result[0].expectedSteps).toEqual(["submitted"]);
    expect(result[0].isComplete).toBe(true);
  });

  it("handles mixed incidents and complaints", () => {
    const incidents = [{ id: "i1", incident_number: "INC-001", status: "submitted" }];
    const complaints = [{ id: "c1", complaint_number: "CMP-001", status: "submitted" }];
    const result = computeWorkflowCompleteness(incidents, complaints, [{ incident_id: "i1", to_status: "submitted" }], []);
    expect(result).toHaveLength(2);
    expect(result[0].recordType).toBe("incident");
    expect(result[1].recordType).toBe("complaint");
  });
});
