/**
 * Evidence Completeness Score — computes audit-readiness scores for records.
 */

export interface ScoreCheck {
  label: string;
  passed: boolean;
  weight: number;
}

export interface EvidenceScore {
  score: number;
  status: "complete" | "warning" | "non-compliant";
  checks: ScoreCheck[];
}

export const SCORE_COLORS = {
  complete: "text-success",
  warning: "text-warning",
  "non-compliant": "text-destructive",
} as const;

export const SCORE_BG = {
  complete: "bg-success/10 border-success/30",
  warning: "bg-warning/10 border-warning/30",
  "non-compliant": "bg-destructive/10 border-destructive/30",
} as const;

function getStatus(score: number): EvidenceScore["status"] {
  if (score >= 80) return "complete";
  if (score >= 50) return "warning";
  return "non-compliant";
}

function compute(checks: ScoreCheck[]): EvidenceScore {
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.filter(c => c.passed).reduce((s, c) => s + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;
  return { score, status: getStatus(score), checks };
}

export function computeIncidentEvidenceScore(
  incident: any,
  actions: any[],
  approvals: any[],
  trainingLinks: any[],
): EvidenceScore {
  const completedActions = actions.filter(a => a.status === "completed");
  const checks: ScoreCheck[] = [
    { label: "Participant linked", passed: !!incident.participant_id, weight: 10 },
    { label: "Staff assigned", passed: !!incident.assigned_to || !!incident.linked_staff_id, weight: 10 },
    { label: "Description provided", passed: !!incident.description, weight: 5 },
    { label: "Root cause documented", passed: !!incident.root_cause, weight: 15 },
    { label: "Contributing factors documented", passed: !!incident.contributing_factors, weight: 10 },
    { label: "Corrective actions documented", passed: !!incident.corrective_actions, weight: 15 },
    { label: "Corrective action items present", passed: actions.length > 0, weight: 10 },
    { label: "All action items completed", passed: actions.length > 0 && completedActions.length === actions.length, weight: 10 },
    { label: "Approvals present", passed: approvals.length > 0, weight: 10 },
    { label: "Training assigned (if applicable)", passed: trainingLinks.length > 0 || incident.status === "closed", weight: 5 },
  ];
  return compute(checks);
}

export function computeComplaintEvidenceScore(
  complaint: any,
  approvals: any[],
): EvidenceScore {
  const checks: ScoreCheck[] = [
    { label: "Participant linked", passed: !!complaint.participant_id, weight: 10 },
    { label: "Handler assigned", passed: !!complaint.assigned_handler || !!complaint.assigned_to, weight: 15 },
    { label: "Description provided", passed: !!complaint.description, weight: 10 },
    { label: "Acknowledged", passed: !!complaint.acknowledgement_date, weight: 15 },
    { label: "Investigation documented", passed: !!complaint.investigation_summary, weight: 15 },
    { label: "Resolution actions documented", passed: !!complaint.resolution_actions, weight: 15 },
    { label: "Outcome communicated", passed: !!complaint.outcome_communicated_date, weight: 10 },
    { label: "Approvals present", passed: approvals.length > 0, weight: 10 },
  ];
  return compute(checks);
}

export function computeAggregateScore(scores: EvidenceScore[]): EvidenceScore {
  if (scores.length === 0) return { score: 100, status: "complete", checks: [] };
  const avg = Math.round(scores.reduce((s, sc) => s + sc.score, 0) / scores.length);
  return { score: avg, status: getStatus(avg), checks: [] };
}
