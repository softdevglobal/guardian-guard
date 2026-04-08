import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { fetchParticipantEvidenceChain, type EvidenceChainData, computeWorkflowCompleteness } from "./evidenceChainExport";

function addSection(doc: jsPDF, title: string, y: number): number {
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y);
  return y + 8;
}

function addMeta(doc: jsPDF, lines: string[], y: number): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  for (const line of lines) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(line, 14, y);
    y += 5;
  }
  return y + 2;
}

function safeTable(doc: jsPDF, head: string[][], body: string[][], startY: number): number {
  if (body.length === 0) {
    doc.setFontSize(9);
    doc.text("No records", 14, startY + 4);
    return startY + 10;
  }
  autoTable(doc, {
    head,
    body,
    startY,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY + 6;
}

export async function generateParticipantAuditPDF(participantId: string): Promise<void> {
  const data = await fetchParticipantEvidenceChain(participantId);
  const p = data.participant;
  if (!p) throw new Error("Participant not found");

  const doc = new jsPDF();
  const now = new Date().toLocaleString();

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Participant Audit Evidence Pack", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${now}`, 14, 27);

  // Section 1 — Overview
  let y = addSection(doc, "1. Participant Overview", 36);
  y = addMeta(doc, [
    `Name: ${p.first_name} ${p.last_name}`,
    `NDIS Number: ${p.ndis_number ?? "N/A"}`,
    `Status: ${p.status}`,
    `Support Type: ${p.support_type ?? "N/A"}`,
    `Consent: ${p.consent_status}`,
  ], y);

  y = addMeta(doc, [
    `Incidents: ${data.incidents.length}  |  Risks: ${data.risks.length}  |  Complaints: ${data.complaints.length}  |  Safeguarding: ${data.safeguarding.length}`,
    `Audit Log Entries: ${data.auditLogs.length}  |  Staff Involved: ${data.staffInvolved.length}`,
  ], y + 2);

  // Section 2 — Timeline
  y = addSection(doc, "2. Unified Timeline", y + 4);
  const timeline = buildTimeline(data);
  y = safeTable(doc, [["Date", "Type", "Title", "Status"]], timeline.map(t => [t.date, t.type, t.title.substring(0, 60), t.status]), y);

  // Section 3 — Incidents
  y = addSection(doc, "3. Incidents", y);
  y = safeTable(doc, [["Number", "Title", "Severity", "Status", "Date", "Reportable"]],
    data.incidents.map(i => [i.incident_number, i.title.substring(0, 40), i.severity, i.status, i.date_of_incident ?? "", i.is_reportable ? "Yes" : "No"]), y);

  // Corrective actions
  if (data.incidentActions.length > 0) {
    y = addSection(doc, "3a. Corrective Actions", y);
    y = safeTable(doc, [["Description", "Type", "Status", "Due Date", "Completed"]],
      data.incidentActions.map(a => [a.description.substring(0, 50), a.action_type, a.status, a.due_date ?? "", a.completed_at ?? "Pending"]), y);
  }

  // Section 4 — Risks
  y = addSection(doc, "4. Risks", y);
  y = safeTable(doc, [["Title", "Category", "Level", "Score", "Status"]],
    data.risks.map(r => [r.title.substring(0, 40), r.category, r.risk_level ?? "", String(r.risk_score ?? ""), r.status]), y);

  // Section 5 — Complaints
  y = addSection(doc, "5. Complaints", y);
  y = safeTable(doc, [["Number", "Subject", "Priority", "Status", "Created"]],
    data.complaints.map(c => [c.complaint_number, c.subject.substring(0, 40), c.priority, c.status, c.created_at.substring(0, 10)]), y);

  // Section 6 — Safeguarding
  y = addSection(doc, "6. Safeguarding Concerns", y);
  y = safeTable(doc, [["Type", "Status", "Date Raised", "Immediate Risk", "Escalation"]],
    data.safeguarding.map(s => [s.concern_type, s.status, s.date_raised, s.immediate_safety_risk ? "Yes" : "No", s.escalation_level ?? ""]), y);

  // Section 7 — Workflow Completeness
  y = addSection(doc, "7. Workflow Completeness", y);
  const wc = computeWorkflowCompleteness(data.incidents, data.complaints, data.incidentWorkflow, data.complaintWorkflow);
  y = safeTable(doc, [["Record", "Type", "Status", "Missing Steps", "Complete"]],
    wc.map(w => [w.recordLabel, w.recordType, w.currentStatus, w.missingSteps.join(", ") || "None", w.isComplete ? "Yes" : "No"]), y);

  // Section 8 — Staff
  y = addSection(doc, "8. Staff Involved", y);
  y = safeTable(doc, [["Name", "Email"]],
    data.staffInvolved.map(s => [s.full_name ?? "", s.email ?? ""]), y);

  // Section 9 — Audit Logs
  y = addSection(doc, "9. Audit Logs", y);
  y = safeTable(doc, [["Action", "Module", "User", "Severity", "Date"]],
    data.auditLogs.slice(0, 100).map(a => [a.action, a.module, a.user_name ?? "System", a.severity, a.created_at.substring(0, 19)]), y);

  doc.save(`audit-evidence-${p.first_name}-${p.last_name}-${new Date().toISOString().split("T")[0]}.pdf`);
}

export async function generateIncidentPDF(incidentId: string): Promise<void> {
  const [incRes, actionsRes, workflowRes, logsRes] = await Promise.all([
    supabase.from("incidents").select("*").eq("id", incidentId).single(),
    supabase.from("incident_actions").select("*").eq("incident_id", incidentId).order("created_at"),
    supabase.from("incident_workflow_history").select("*").eq("incident_id", incidentId).order("created_at"),
    supabase.from("audit_logs").select("*").eq("record_id", incidentId).order("created_at", { ascending: false }).limit(100),
  ]);

  const inc = incRes.data;
  if (!inc) throw new Error("Incident not found");

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`Incident Report: ${inc.incident_number}`, 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);

  let y = addSection(doc, "Details", 36);
  y = addMeta(doc, [
    `Title: ${inc.title}`,
    `Type: ${inc.incident_type}  |  Category: ${inc.incident_category ?? "N/A"}`,
    `Severity: ${inc.severity}  |  Status: ${inc.status}`,
    `Date: ${inc.date_of_incident ?? "N/A"}  |  Location: ${inc.incident_location ?? "N/A"}`,
    `NDIS Reportable: ${inc.is_reportable ? "Yes" : "No"}`,
    `Root Cause: ${inc.root_cause ?? "Not documented"}`,
    `Contributing Factors: ${inc.contributing_factors ?? "Not documented"}`,
    `Corrective Actions: ${inc.corrective_actions ?? "Not documented"}`,
  ], y);

  y = addSection(doc, "Action Items", y + 4);
  y = safeTable(doc, [["Description", "Type", "Status", "Due", "Completed"]],
    (actionsRes.data ?? []).map(a => [a.description.substring(0, 50), a.action_type, a.status, a.due_date ?? "", a.completed_at ?? "Pending"]), y);

  y = addSection(doc, "Workflow History", y);
  y = safeTable(doc, [["From", "To", "Date"]],
    (workflowRes.data ?? []).map(w => [w.from_status ?? "new", w.to_status, w.created_at.substring(0, 19)]), y);

  y = addSection(doc, "Audit Trail", y);
  y = safeTable(doc, [["Action", "Module", "User", "Date"]],
    (logsRes.data ?? []).slice(0, 50).map(a => [a.action, a.module, a.user_name ?? "System", a.created_at.substring(0, 19)]), y);

  doc.save(`incident-${inc.incident_number}-${new Date().toISOString().split("T")[0]}.pdf`);
}

function buildTimeline(data: EvidenceChainData) {
  const items: { date: string; type: string; title: string; status: string }[] = [];
  data.incidents.forEach(i => items.push({ date: i.date_of_incident ?? i.created_at.substring(0, 10), type: "Incident", title: i.title, status: i.status }));
  data.risks.forEach(r => items.push({ date: r.date_identified ?? r.created_at.substring(0, 10), type: "Risk", title: r.title, status: r.status }));
  data.complaints.forEach(c => items.push({ date: c.created_at.substring(0, 10), type: "Complaint", title: c.subject, status: c.status }));
  data.safeguarding.forEach(s => items.push({ date: s.date_raised, type: "Safeguarding", title: s.concern_type, status: s.status }));
  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}
