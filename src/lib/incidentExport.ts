import { supabase } from "@/integrations/supabase/client";

interface ExportIncident {
  id: string;
  incident_number: string;
  title: string;
  description: string | null;
  incident_type: string;
  incident_category: string | null;
  severity: string;
  status: string;
  is_reportable: boolean;
  reportable_reason: string | null;
  date_of_incident: string | null;
  time_of_incident: string | null;
  date_reported: string | null;
  incident_location: string | null;
  environment: string | null;
  participant_harmed: boolean | null;
  staff_harmed: boolean | null;
  injury_involved: boolean;
  medical_attention_required: boolean | null;
  emergency_service_contacted: boolean | null;
  immediate_action_taken: string | null;
  root_cause: string | null;
  contributing_factors: string | null;
  corrective_actions: string | null;
  preventive_actions: string | null;
  outcome_summary: string | null;
  closure_recommendation: string | null;
  created_at: string;
  closed_at: string | null;
  ndis_notification_deadline: string | null;
}

interface VersionEntry {
  version_number: number;
  changed_by: string;
  changes: any;
  created_at: string;
}

interface WorkflowEntry {
  from_status: string | null;
  to_status: string;
  changed_by: string;
  created_at: string;
  notes: string | null;
}

interface AuditEntry {
  action: string;
  user_name: string | null;
  details: any;
  created_at: string;
  severity: string;
}

export async function fetchIncidentExportData(incidentId: string) {
  const [incidentRes, versionsRes, workflowRes, auditRes, actionsRes] = await Promise.all([
    supabase.from("incidents").select("*").eq("id", incidentId).single(),
    supabase.from("incident_versions").select("*").eq("incident_id", incidentId).order("version_number", { ascending: true }),
    supabase.from("incident_workflow_history").select("*").eq("incident_id", incidentId).order("created_at", { ascending: true }),
    supabase.from("audit_logs").select("*").eq("record_id", incidentId).eq("module", "incidents").order("created_at", { ascending: true }),
    supabase.from("incident_actions").select("*").eq("incident_id", incidentId).order("created_at", { ascending: true }),
  ]);

  return {
    incident: incidentRes.data,
    versions: versionsRes.data ?? [],
    workflow: workflowRes.data ?? [],
    auditLogs: auditRes.data ?? [],
    actions: actionsRes.data ?? [],
  };
}

export function exportIncidentCSV(data: Awaited<ReturnType<typeof fetchIncidentExportData>>) {
  const { incident, versions, workflow, auditLogs, actions } = data;
  if (!incident) return "";

  const lines: string[] = [];

  // Header
  lines.push("Section,Field,Value");

  // Incident details
  const fields = [
    ["Incident", "Number", incident.incident_number],
    ["Incident", "Title", incident.title],
    ["Incident", "Type", incident.incident_type],
    ["Incident", "Category", incident.incident_category ?? ""],
    ["Incident", "Severity", incident.severity],
    ["Incident", "Status", incident.status],
    ["Incident", "NDIS Reportable", incident.is_reportable ? "Yes" : "No"],
    ["Incident", "Reportable Reason", incident.reportable_reason ?? ""],
    ["Incident", "Date of Incident", incident.date_of_incident ?? ""],
    ["Incident", "Time of Incident", incident.time_of_incident ?? ""],
    ["Incident", "Location", incident.incident_location ?? ""],
    ["Incident", "Environment", incident.environment ?? ""],
    ["Incident", "Participant Harmed", incident.participant_harmed ? "Yes" : "No"],
    ["Incident", "Staff Harmed", incident.staff_harmed ? "Yes" : "No"],
    ["Incident", "Injury Involved", incident.injury_involved ? "Yes" : "No"],
    ["Incident", "Medical Attention", incident.medical_attention_required ? "Yes" : "No"],
    ["Incident", "Emergency Services", incident.emergency_service_contacted ? "Yes" : "No"],
    ["Incident", "Description", `"${(incident.description ?? "").replace(/"/g, '""')}"`],
    ["Incident", "Immediate Action", `"${(incident.immediate_action_taken ?? "").replace(/"/g, '""')}"`],
    ["Incident", "Root Cause", `"${(incident.root_cause ?? "").replace(/"/g, '""')}"`],
    ["Incident", "Contributing Factors", `"${(incident.contributing_factors ?? "").replace(/"/g, '""')}"`],
    ["Incident", "Corrective Actions", `"${(incident.corrective_actions ?? "").replace(/"/g, '""')}"`],
    ["Incident", "Preventive Actions", `"${(incident.preventive_actions ?? "").replace(/"/g, '""')}"`],
    ["Incident", "Outcome Summary", `"${(incident.outcome_summary ?? "").replace(/"/g, '""')}"`],
    ["Incident", "Created At", incident.created_at],
    ["Incident", "Closed At", incident.closed_at ?? ""],
    ["Incident", "NDIS Deadline", incident.ndis_notification_deadline ?? ""],
  ];

  fields.forEach(([section, field, value]) => {
    lines.push(`${section},${field},${value}`);
  });

  // Workflow history
  lines.push("");
  lines.push("Workflow History");
  lines.push("From Status,To Status,Changed By,Date,Notes");
  workflow.forEach((w: any) => {
    lines.push(`${w.from_status ?? "new"},${w.to_status},${w.changed_by},${w.created_at},${w.notes ?? ""}`);
  });

  // Versions
  lines.push("");
  lines.push("Version History");
  lines.push("Version,Changed By,Date,Changes");
  versions.forEach((v: any) => {
    lines.push(`v${v.version_number},${v.changed_by},${v.created_at},"${JSON.stringify(v.changes).replace(/"/g, '""')}"`);
  });

  // Audit logs
  lines.push("");
  lines.push("Audit Logs");
  lines.push("Action,User,Date,Severity,Details");
  auditLogs.forEach((a: any) => {
    lines.push(`${a.action},${a.user_name ?? ""},${a.created_at},${a.severity},"${JSON.stringify(a.details ?? {}).replace(/"/g, '""')}"`);
  });

  // Corrective actions
  lines.push("");
  lines.push("Corrective Actions");
  lines.push("Description,Status,Due Date,Completed At");
  actions.forEach((a: any) => {
    lines.push(`"${(a.description ?? "").replace(/"/g, '""')}",${a.status},${a.due_date ?? ""},${a.completed_at ?? ""}`);
  });

  return lines.join("\n");
}

export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportBulkIncidentsCSV(incidents: any[]) {
  const headers = [
    "Incident Number", "Title", "Type", "Category", "Severity", "Status",
    "NDIS Reportable", "Date of Incident", "Location", "Participant Harmed",
    "Staff Harmed", "Injury Involved", "Medical Attention", "Emergency Services",
    "Created At", "Closed At", "NDIS Deadline", "Description"
  ];

  const rows = incidents.map(inc => [
    inc.incident_number,
    `"${(inc.title ?? "").replace(/"/g, '""')}"`,
    inc.incident_type,
    inc.incident_category ?? "",
    inc.severity,
    inc.status,
    inc.is_reportable ? "Yes" : "No",
    inc.date_of_incident ?? "",
    inc.incident_location ?? "",
    inc.participant_harmed ? "Yes" : "No",
    inc.staff_harmed ? "Yes" : "No",
    inc.injury_involved ? "Yes" : "No",
    inc.medical_attention_required ? "Yes" : "No",
    inc.emergency_service_contacted ? "Yes" : "No",
    inc.created_at,
    inc.closed_at ?? "",
    inc.ndis_notification_deadline ?? "",
    `"${(inc.description ?? "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}
