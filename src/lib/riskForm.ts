/** Risk scoring and save verification. The database is authoritative for the score. */

export interface RiskFormValues {
  likelihood_score: number;
  impact_score: number;
  review_date?: string;
  review_frequency?: string;
}

export interface StoredRisk {
  likelihood_score?: number | null;
  impact_score?: number | null;
  risk_score?: number | null;
  risk_level?: string | null;
  review_date?: string | null;
  review_frequency?: string | null;
}

export function calculateRiskScore(likelihood: number, impact: number): number {
  return likelihood * impact;
}

export function riskLevelFor(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

/** Differences between what the user submitted and what the database returned. */
export function riskPersistenceWarnings(submitted: RiskFormValues, stored: StoredRisk | null | undefined): string[] {
  if (!stored) return ["The saved record could not be read back — reload the register to confirm what was stored."];
  const warnings: string[] = [];
  if ((stored.likelihood_score ?? null) !== submitted.likelihood_score) {
    warnings.push(`Likelihood stored as ${stored.likelihood_score ?? "empty"} instead of ${submitted.likelihood_score}.`);
  }
  if ((stored.impact_score ?? null) !== submitted.impact_score) {
    warnings.push(`Impact stored as ${stored.impact_score ?? "empty"} instead of ${submitted.impact_score}.`);
  }
  const expected = calculateRiskScore(submitted.likelihood_score, submitted.impact_score);
  if ((stored.risk_score ?? null) !== expected) {
    warnings.push(`Score stored as ${stored.risk_score ?? "empty"} instead of ${expected}.`);
  }
  if ((submitted.review_date || null) !== (stored.review_date ?? null)) {
    warnings.push(`Review date stored as ${stored.review_date ?? "empty"}.`);
  }
  if ((submitted.review_frequency || null) !== (stored.review_frequency ?? null)) {
    warnings.push(`Review frequency stored as ${stored.review_frequency ?? "empty"}.`);
  }
  return warnings;
}
