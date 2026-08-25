/**
 * The single authoritative compliance-scoring service.
 *
 * Every score and headline count rendered on the Dashboard and on Compliance
 * Pulse comes from here, which in turn reads only `org_compliance_snapshot`.
 * A score is `null` ("Not assessable") whenever its denominator is zero — an
 * organisation with no requirements, no worker records or no AI activity can
 * never be shown as 0% or 100%.
 */
import type { OrgSnapshot, ScoreBlock } from "@/lib/orgSnapshot";

export type ScoreKey = keyof OrgSnapshot["scores"];

export interface ScoreCard {
  key: ScoreKey;
  label: string;
  /** Plain-English noun used in the "x of y ..." explanation. */
  subject: string;
}

export const COMPLIANCE_SCORE_CARDS: ScoreCard[] = [
  { key: "audit_readiness", label: "Audit readiness", subject: "applicable evidence requirements" },
  { key: "governance", label: "Governance and documents", subject: "governance records" },
  { key: "supports", label: "Provision of supports", subject: "incident and complaint records" },
  { key: "environment", label: "Support environment", subject: "risk records" },
  { key: "worker_compliance", label: "Worker compliance", subject: "worker requirements" },
  { key: "ai_oversight", label: "AI oversight", subject: "AI activities" },
];

export function isAssessable(block: ScoreBlock | null | undefined): boolean {
  return !!block && block.denominator > 0 && block.percentage !== null && block.percentage !== undefined;
}

export function scoreBlock(
  snapshot: OrgSnapshot | null | undefined,
  key: ScoreKey,
): ScoreBlock | null {
  const block = snapshot?.scores?.[key];
  if (!block) return null;
  // Defensive: never let a zero-denominator block surface a percentage.
  if (block.denominator === 0) return { ...block, percentage: null };
  return block;
}

/** Mean of the assessable category scores; null when nothing can be assessed. */
export function overallScore(snapshot: OrgSnapshot | null | undefined): ScoreBlock | null {
  const blocks = COMPLIANCE_SCORE_CARDS
    .map((c) => scoreBlock(snapshot, c.key))
    .filter(isAssessable) as ScoreBlock[];
  if (blocks.length === 0) return null;
  const pct = Math.round(blocks.reduce((sum, b) => sum + (b.percentage ?? 0), 0) / blocks.length);
  return {
    percentage: pct,
    numerator: blocks.reduce((s, b) => s + b.numerator, 0),
    denominator: blocks.reduce((s, b) => s + b.denominator, 0),
  };
}

export interface HeadlineCount {
  key: string;
  label: string;
  value: number;
}

/** Shared counts so the Dashboard and Compliance Pulse can never disagree. */
export function headlineCounts(snapshot: OrgSnapshot | null | undefined): HeadlineCount[] {
  const c = snapshot?.counts;
  return [
    { key: "incidents_open", label: "Open incidents", value: c?.incidents_open ?? 0 },
    { key: "complaints_open", label: "Open complaints", value: c?.complaints_open ?? 0 },
    { key: "risks_open", label: "Open risks", value: c?.risks_open ?? 0 },
    { key: "corrective_actions_open", label: "Open corrective actions", value: c?.corrective_actions_open ?? 0 },
    { key: "policies_due", label: "Policy reviews due", value: c?.policies_due ?? 0 },
    { key: "evidence_ready", label: "Evidence ready", value: snapshot?.evidence.evidence_ready ?? 0 },
  ];
}

export function scoreTone(block: ScoreBlock | null | undefined): "neutral" | "good" | "warn" | "bad" {
  if (!isAssessable(block)) return "neutral";
  const pct = block!.percentage as number;
  if (pct >= 80) return "good";
  if (pct >= 60) return "warn";
  return "bad";
}
