/**
 * One organisation-scoped figures service. Every count and score in the app
 * (dashboard cards, sidebar badges, registers, evidence room, exports) reads
 * this snapshot so the numbers can never disagree with each other.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScoreBlock {
  /** null means "not assessable" — never render this as 0% or 100%. */
  percentage: number | null;
  numerator: number;
  denominator: number;
}

export interface OrgSnapshot {
  organisation_id: string | null;
  calculated_at: string;
  include_test_records: boolean;
  counts: {
    incidents_open: number;
    incidents_total: number;
    complaints_open: number;
    complaints_total: number;
    risks_open: number;
    risks_total: number;
    policies: number;
    policies_due: number;
    participants: number;
    staff: number;
    governance_meetings: number;
    registration_groups_confirmed: number;
    corrective_actions_open: number;
    worker_requirements: number;
    worker_requirements_verified: number;
  };
  evidence: {
    total_applicable: number;
    evidence_ready: number;
    review_overdue: number;
    missing: number;
    in_progress: number;
    ready_for_review: number;
  };
  scores: {
    audit_readiness: ScoreBlock;
    governance: ScoreBlock;
    supports: ScoreBlock;
    environment: ScoreBlock;
    ai_oversight: ScoreBlock;
    worker_compliance: ScoreBlock;
  };
}

export const NOT_ASSESSABLE_LABEL = "Not assessable";

/** Formats a score for display. Zero requirements must never become 100%. */
export function formatScore(block: ScoreBlock | undefined | null): string {
  if (!block || block.percentage === null || block.percentage === undefined) return NOT_ASSESSABLE_LABEL;
  return `${Math.round(block.percentage)}%`;
}

export function scoreExplanation(block: ScoreBlock | undefined | null, subject: string): string {
  if (!block || block.denominator === 0) {
    return `No ${subject} in scope yet, so this cannot be assessed.`;
  }
  return `${block.numerator} of ${block.denominator} ${subject} meet the requirement.`;
}

/** Audit readiness status derived only from applicable evidence requirements. */
export function readinessStatus(snapshot: OrgSnapshot | null | undefined):
  | "NOT_ASSESSABLE"
  | "AT_RISK"
  | "IN_PROGRESS"
  | "READY" {
  const total = snapshot?.evidence.total_applicable ?? 0;
  if (total === 0) return "NOT_ASSESSABLE";
  const pct = snapshot?.scores.audit_readiness.percentage ?? 0;
  if (pct >= 80) return "READY";
  if (pct >= 50) return "IN_PROGRESS";
  return "AT_RISK";
}

export const ORG_SNAPSHOT_KEY = ["org-compliance-snapshot"] as const;

export function useOrgSnapshot(includeTestRecords = false) {
  return useQuery({
    queryKey: [...ORG_SNAPSHOT_KEY, includeTestRecords],
    queryFn: async (): Promise<OrgSnapshot> => {
      const { data, error } = await supabase.rpc("org_compliance_snapshot" as any, {
        _include_test: includeTestRecords,
      });
      if (error) throw error;
      return data as unknown as OrgSnapshot;
    },
    staleTime: 30_000,
  });
}
