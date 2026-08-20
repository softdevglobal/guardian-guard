// Practice Standards Evidence Matrix helpers.
// NOTE: This system reports *audit readiness / evidence status* only.
// It never asserts NDIS compliance, certification or registration approval.

export type EvidenceStatus = "missing" | "in_progress" | "ready" | "overdue";

export interface EvidenceRequirementLike {
  id: string;
  outcome_code: string;
  requirement_title: string;
  required_evidence_type: string;
  linked_policy_id: string | null;
  owner_id: string | null;
  review_date: string | null;
  status: EvidenceStatus;
  auditor_notes: string | null;
  include_in_export: boolean;
  linked_count?: number;
}

export const EVIDENCE_STATUS_LABEL: Record<EvidenceStatus, string> = {
  missing: "Evidence missing",
  in_progress: "Evidence in progress",
  ready: "Evidence ready for review",
  overdue: "Review overdue",
};

/** Mandatory checks that must all pass before a requirement may be marked Ready. */
export function readyBlockers(
  req: Pick<EvidenceRequirementLike, "linked_policy_id" | "review_date"> & { linked_count?: number },
  today: Date = new Date()
): string[] {
  const blockers: string[] = [];
  if (!req.linked_policy_id) blockers.push("A linked policy is required.");
  if (!req.linked_count) blockers.push("At least one linked evidence record is required.");
  if (!req.review_date) {
    blockers.push("A review date is required.");
  } else if (new Date(req.review_date) < startOfDay(today)) {
    blockers.push("The review date has passed — set a current review date.");
  }
  return blockers;
}

export function canMarkReady(
  req: Pick<EvidenceRequirementLike, "linked_policy_id" | "review_date"> & { linked_count?: number },
  today: Date = new Date()
): boolean {
  return readyBlockers(req, today).length === 0;
}

/** Derived status shown in the UI — an otherwise-ready item past its review date reads as overdue. */
export function derivedStatus(req: EvidenceRequirementLike, today: Date = new Date()): EvidenceStatus {
  if (req.review_date && new Date(req.review_date) < startOfDay(today)) return "overdue";
  return req.status;
}

export interface MatrixSummary {
  total: number;
  ready: number;
  inProgress: number;
  missing: number;
  overdue: number;
  readinessPct: number;
}

export function summariseMatrix(reqs: EvidenceRequirementLike[], today: Date = new Date()): MatrixSummary {
  const counts = { ready: 0, in_progress: 0, missing: 0, overdue: 0 } as Record<EvidenceStatus, number>;
  reqs.forEach((r) => {
    counts[derivedStatus(r, today)] += 1;
  });
  const total = reqs.length;
  return {
    total,
    ready: counts.ready,
    inProgress: counts.in_progress,
    missing: counts.missing,
    overdue: counts.overdue,
    readinessPct: total === 0 ? 0 : Math.round((counts.ready / total) * 100),
  };
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export interface EvidencePackRow extends EvidenceRequirementLike {
  module_code?: string;
  outcome_name?: string;
  policy_title?: string | null;
  owner_name?: string | null;
}

export function buildEvidencePackCSV(rows: EvidencePackRow[], today: Date = new Date()): string {
  const headers = [
    "Module",
    "Outcome",
    "Outcome name",
    "Requirement",
    "Required evidence type",
    "Linked policy",
    "Linked records",
    "Owner",
    "Review date",
    "Evidence status",
    "Auditor notes",
  ];
  const body = rows
    .filter((r) => r.include_in_export)
    .map((r) =>
      [
        cell(r.module_code),
        cell(r.outcome_code),
        cell(r.outcome_name),
        cell(r.requirement_title),
        cell(r.required_evidence_type),
        cell(r.policy_title ?? "Not linked"),
        cell(r.linked_count ?? 0),
        cell(r.owner_name ?? "Unassigned"),
        cell(r.review_date ?? ""),
        cell(EVIDENCE_STATUS_LABEL[derivedStatus(r, today)]),
        cell(r.auditor_notes ?? ""),
      ].join(",")
    );
  const disclaimer =
    '"Audit readiness evidence pack. This report records evidence status only. It does not state or imply NDIS compliance, certification or registration approval. All entries require human review by the provider."';
  return [disclaimer, "", headers.join(","), ...body].join("\n");
}
