import { supabase } from "@/integrations/supabase/client";

export interface EvidenceChainData {
  participant: any;
  incidents: any[];
  risks: any[];
  complaints: any[];
  safeguarding: any[];
  incidentActions: any[];
  auditLogs: any[];
  staffInvolved: any[];
}

export async function fetchParticipantEvidenceChain(participantId: string): Promise<EvidenceChainData> {
  const [participant, incidents, risks, complaints, safeguarding, auditLogs] = await Promise.all([
    supabase.from("participants").select("*").eq("id", participantId).single(),
    supabase.from("incidents").select("*").eq("participant_id", participantId).eq("record_status", "active").order("created_at", { ascending: false }),
    supabase.from("risks").select("*").eq("linked_participant_id", participantId).eq("record_status", "active").order("created_at", { ascending: false }),
    supabase.from("complaints").select("*").eq("participant_id", participantId).eq("record_status", "active").order("created_at", { ascending: false }),
    supabase.from("safeguarding_concerns").select("*").eq("participant_id", participantId).eq("record_status", "active").order("date_raised", { ascending: false }),
    supabase.from("audit_logs").select("*").eq("record_id", participantId).order("created_at", { ascending: false }).limit(100),
  ]);

  const incidentIds = (incidents.data ?? []).map(i => i.id);
  const incidentActions = incidentIds.length > 0
    ? (await supabase.from("incident_actions").select("*").in("incident_id", incidentIds).order("created_at")).data ?? []
    : [];

  // Collect unique staff IDs
  const staffIds = new Set<string>();
  (incidents.data ?? []).forEach(i => {
    if (i.reported_by) staffIds.add(i.reported_by);
    if (i.assigned_to) staffIds.add(i.assigned_to);
    if (i.linked_staff_id) staffIds.add(i.linked_staff_id);
  });
  (complaints.data ?? []).forEach(c => {
    if (c.submitted_by) staffIds.add(c.submitted_by);
    if (c.assigned_handler) staffIds.add(c.assigned_handler);
  });
  (safeguarding.data ?? []).forEach(s => {
    if (s.raised_by) staffIds.add(s.raised_by);
  });

  const staffInvolved = staffIds.size > 0
    ? (await supabase.from("user_profiles").select("id, full_name, email").in("id", Array.from(staffIds))).data ?? []
    : [];

  return {
    participant: participant.data,
    incidents: incidents.data ?? [],
    risks: risks.data ?? [],
    complaints: complaints.data ?? [],
    safeguarding: safeguarding.data ?? [],
    incidentActions,
    auditLogs: auditLogs.data ?? [],
    staffInvolved,
  };
}

export function exportEvidenceChainCSV(data: EvidenceChainData): string {
  const lines: string[] = [];
  const p = data.participant;

  // Header
  lines.push("EVIDENCE CHAIN EXPORT");
  lines.push(`Participant,${p?.first_name} ${p?.last_name}`);
  lines.push(`NDIS Number,${p?.ndis_number ?? "N/A"}`);
  lines.push(`Export Date,${new Date().toISOString()}`);
  lines.push("");

  // Incidents
  lines.push("--- INCIDENTS ---");
  lines.push("Number,Title,Type,Severity,Status,Date,Reportable,NDIS Deadline");
  data.incidents.forEach(i => {
    lines.push([
      i.incident_number, csvSafe(i.title), i.incident_type, i.severity, i.status,
      i.date_of_incident ?? i.created_at, i.is_reportable ? "Yes" : "No",
      i.ndis_notification_deadline ?? "N/A",
    ].join(","));
  });
  lines.push("");

  // Risks
  lines.push("--- RISKS ---");
  lines.push("Title,Category,Risk Level,Score,Status,Date Identified");
  data.risks.forEach(r => {
    lines.push([
      csvSafe(r.title), r.category, r.risk_level ?? "N/A", r.risk_score ?? "N/A",
      r.status, r.date_identified ?? r.created_at,
    ].join(","));
  });
  lines.push("");

  // Complaints
  lines.push("--- COMPLAINTS ---");
  lines.push("Number,Subject,Priority,Status,Created");
  data.complaints.forEach(c => {
    lines.push([
      c.complaint_number, csvSafe(c.subject), c.priority, c.status, c.created_at,
    ].join(","));
  });
  lines.push("");

  // Safeguarding
  lines.push("--- SAFEGUARDING CONCERNS ---");
  lines.push("Type,Status,Date Raised,Immediate Risk,Escalation Level");
  data.safeguarding.forEach(s => {
    lines.push([
      s.concern_type, s.status, s.date_raised,
      s.immediate_safety_risk ? "Yes" : "No", s.escalation_level ?? "N/A",
    ].join(","));
  });
  lines.push("");

  // Staff
  lines.push("--- STAFF INVOLVED ---");
  lines.push("Name,Email");
  data.staffInvolved.forEach(s => {
    lines.push([csvSafe(s.full_name), s.email].join(","));
  });
  lines.push("");

  // Corrective Actions
  lines.push("--- CORRECTIVE ACTIONS ---");
  lines.push("Description,Type,Status,Due Date,Completed At");
  data.incidentActions.forEach(a => {
    lines.push([
      csvSafe(a.description), a.action_type, a.status,
      a.due_date ?? "N/A", a.completed_at ?? "Pending",
    ].join(","));
  });
  lines.push("");

  // Audit Logs
  lines.push("--- AUDIT LOG ---");
  lines.push("Action,Module,User,Severity,Timestamp");
  data.auditLogs.forEach(a => {
    lines.push([
      a.action, a.module, csvSafe(a.user_name ?? "System"), a.severity, a.created_at,
    ].join(","));
  });

  return lines.join("\n");
}

function csvSafe(val: string | null | undefined): string {
  if (!val) return "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
