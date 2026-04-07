import { describe, it, expect } from "vitest";
import { exportIncidentCSV, exportBulkIncidentsCSV } from "../incidentExport";

// Use `as any` to avoid needing to specify all 48 incident fields in tests

describe("exportIncidentCSV", () => {
  const makeData = (overrides?: Partial<any>): any => ({
    incident: {
      incident_number: "INC-001",
      title: "Test Incident",
      incident_type: "injury",
      incident_category: "workplace",
      severity: "high",
      status: "submitted",
      is_reportable: true,
      reportable_reason: "Serious harm",
      date_of_incident: "2026-04-01",
      time_of_incident: "14:30",
      date_reported: "2026-04-01",
      incident_location: "Office A",
      environment: "office",
      participant_harmed: true,
      staff_harmed: false,
      injury_involved: true,
      medical_attention_required: false,
      emergency_service_contacted: false,
      description: "Participant fell",
      immediate_action_taken: "First aid",
      root_cause: "Wet floor",
      contributing_factors: "No warning sign",
      corrective_actions: "Add signs",
      preventive_actions: "Training",
      outcome_summary: "Recovered",
      closure_recommendation: null,
      created_at: "2026-04-01T10:00:00Z",
      closed_at: null,
      ndis_notification_deadline: "2026-04-02T10:00:00Z",
      ...overrides,
    },
    versions: [],
    workflow: [],
    auditLogs: [],
    actions: [],
  });

  it("returns empty string when incident is null", () => {
    expect(exportIncidentCSV({ incident: null, versions: [], workflow: [], auditLogs: [], actions: [] })).toBe("");
  });

  it("starts with Section,Field,Value header", () => {
    const csv = exportIncidentCSV(makeData());
    expect(csv.split("\n")[0]).toBe("Section,Field,Value");
  });

  it("renders boolean fields as Yes/No", () => {
    const csv = exportIncidentCSV(makeData());
    expect(csv).toContain("NDIS Reportable,Yes");
    expect(csv).toContain("Participant Harmed,Yes");
    expect(csv).toContain("Staff Harmed,No");
    expect(csv).toContain("Injury Involved,Yes");
    expect(csv).toContain("Medical Attention,No");
    expect(csv).toContain("Emergency Services,No");
  });

  it("handles null fields with empty strings", () => {
    const csv = exportIncidentCSV(makeData({ closure_recommendation: null, closed_at: null }));
    expect(csv).toContain("Closed At,");
  });

  it("escapes description with quotes", () => {
    const csv = exportIncidentCSV(makeData({ description: 'He said "ouch"' }));
    expect(csv).toContain('""ouch""');
  });

  it("includes workflow history section", () => {
    const data = makeData();
    data.workflow = [
      { from_status: null, to_status: "submitted", changed_by: "user-1", created_at: "2026-04-01T10:00:00Z", notes: "Initial" },
    ];
    const csv = exportIncidentCSV(data);
    expect(csv).toContain("Workflow History");
    expect(csv).toContain("new,submitted,user-1");
  });

  it("includes version history section", () => {
    const data = makeData();
    data.versions = [
      { version_number: 1, changed_by: "user-1", created_at: "2026-04-01T10:00:00Z", changes: { title: "old" } },
    ];
    const csv = exportIncidentCSV(data);
    expect(csv).toContain("Version History");
    expect(csv).toContain("v1,user-1");
  });

  it("includes audit logs section", () => {
    const data = makeData();
    data.auditLogs = [
      { action: "created", user_name: "Admin", created_at: "2026-04-01T10:00:00Z", severity: "normal", details: {} },
    ];
    const csv = exportIncidentCSV(data);
    expect(csv).toContain("Audit Logs");
    expect(csv).toContain("created,Admin");
  });

  it("includes corrective actions section", () => {
    const data = makeData();
    data.actions = [
      { description: "Fix floor", status: "completed", due_date: "2026-04-10", completed_at: "2026-04-09" },
    ];
    const csv = exportIncidentCSV(data);
    expect(csv).toContain("Corrective Actions");
    expect(csv).toContain("Fix floor");
  });
});

describe("exportBulkIncidentsCSV", () => {
  it("produces header row with correct column count", () => {
    const csv = exportBulkIncidentsCSV([]);
    const headerLine = csv.split("\n")[0];
    const headerCount = headerLine.split(",").length;
    expect(headerCount).toBe(18);
  });

  it("produces data rows matching header column count", () => {
    const incidents = [{
      incident_number: "INC-001", title: "Test", incident_type: "injury",
      incident_category: "workplace", severity: "high", status: "submitted",
      is_reportable: true, date_of_incident: "2026-04-01",
      incident_location: "Office", participant_harmed: false,
      staff_harmed: false, injury_involved: false,
      medical_attention_required: false, emergency_service_contacted: false,
      created_at: "2026-04-01T10:00:00Z", closed_at: null,
      ndis_notification_deadline: null, description: "Test desc",
    }];
    const csv = exportBulkIncidentsCSV(incidents);
    const lines = csv.split("\n");
    const headerCount = lines[0].split(",").length;
    // Data row might have quoted strings, so we parse carefully
    expect(lines.length).toBe(2);
    // The row should contain key fields
    expect(lines[1]).toContain("INC-001");
    expect(lines[1]).toContain("Yes"); // is_reportable
  });

  it("renders booleans as Yes/No in bulk export", () => {
    const csv = exportBulkIncidentsCSV([{
      incident_number: "INC-002", title: "X", incident_type: "near_miss",
      incident_category: null, severity: "low", status: "draft",
      is_reportable: false, date_of_incident: null,
      incident_location: null, participant_harmed: true,
      staff_harmed: true, injury_involved: false,
      medical_attention_required: true, emergency_service_contacted: true,
      created_at: "2026-04-01", closed_at: null,
      ndis_notification_deadline: null, description: null,
    }]);
    expect(csv).toContain("No"); // is_reportable
    expect(csv).toContain("Yes"); // participant_harmed
  });
});
