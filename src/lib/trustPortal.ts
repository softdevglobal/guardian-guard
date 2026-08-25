/**
 * Trust portal: a de-identified, provider-controlled compliance summary.
 *
 * Only statuses are ever published — never participants, workers, incidents or
 * documents. The copy is deliberately evidence-based: it says what the provider
 * holds and when it was published, never that the provider is "NDIS compliant",
 * "certified" or "approved".
 */
import { labelValue } from "@/lib/correctiveActions";

export interface TrustPortalRecord {
  id?: string;
  slug: string;
  is_enabled: boolean;
  show_registration_status: boolean;
  show_insurance: boolean;
  show_worker_screening: boolean;
  show_policies_current: boolean;
  show_audit_readiness: boolean;
  contact_email?: string | null;
  intro_text?: string | null;
  published_at?: string | null;
  published_snapshot?: TrustSnapshot | null;
}

export interface TrustEvidence {
  organisationName: string;
  registrationStatus?: string | null;
  registrationNumber?: string | null;
  registrationExpiry?: string | null;
  insuranceCurrent: boolean;
  screeningCurrent: boolean;
  policiesCurrent: number;
  policiesTotal: number;
}

export interface TrustSnapshotItem {
  key: string;
  label: string;
  value: string;
  tone: "ok" | "warn" | "bad" | "neutral";
}

export interface TrustSnapshot {
  organisationName: string;
  generatedAt: string;
  intro?: string | null;
  contactEmail?: string | null;
  items: TrustSnapshotItem[];
  disclaimer: string;
}

export const TRUST_DISCLAIMER =
  "This summary reports evidence the provider records in Guardian Guard. It is not a determination of compliance with the NDIS Practice Standards and does not represent registration, certification or approval by the NDIS Quality and Safeguards Commission.";

export const TRUST_TOGGLES = [
  { key: "show_registration_status", label: "Registration stage", description: "The stage recorded by the provider, plus registration number and expiry when supplied." },
  { key: "show_insurance", label: "Insurance currency", description: "Whether a current critical insurance document is on file. No policy details are shown." },
  { key: "show_worker_screening", label: "Worker screening currency", description: "Whether recorded key personnel screening is current. No names or numbers are shown." },
  { key: "show_policies_current", label: "Policy library", description: "How many policies are approved out of the total held. No policy content is shown." },
  { key: "show_audit_readiness", label: "Audit readiness", description: "A plain-language readiness indicator with the required human-review caveat." },
] as const;

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base.length >= 4 ? base : `${base || "provider"}-portal`;
}

/** Simple readiness band derived from the published statuses only. */
export function readinessBand(evidence: TrustEvidence): { label: string; tone: TrustSnapshotItem["tone"] } {
  const signals = [
    evidence.insuranceCurrent,
    evidence.screeningCurrent,
    evidence.policiesTotal > 0 && evidence.policiesCurrent === evidence.policiesTotal,
  ];
  const met = signals.filter(Boolean).length;
  if (met === 3) return { label: "Evidence recorded across all published areas", tone: "ok" };
  if (met >= 1) return { label: "Evidence partially recorded — requires human review", tone: "warn" };
  return { label: "No published evidence recorded yet", tone: "neutral" };
}

export function buildTrustSnapshot(settings: TrustPortalRecord, evidence: TrustEvidence, now = new Date()): TrustSnapshot {
  const items: TrustSnapshotItem[] = [];

  if (settings.show_registration_status) {
    items.push({
      key: "registration",
      label: "Registration stage recorded by the provider",
      value: [labelValue(evidence.registrationStatus), evidence.registrationNumber ? `(${evidence.registrationNumber})` : null]
        .filter(Boolean)
        .join(" "),
      tone: evidence.registrationStatus === "registered" ? "ok" : "neutral",
    });
    if (evidence.registrationExpiry) {
      items.push({ key: "registration_expiry", label: "Registration expiry recorded", value: evidence.registrationExpiry, tone: "neutral" });
    }
  }

  if (settings.show_insurance) {
    items.push({
      key: "insurance",
      label: "Current insurance document on file",
      value: evidence.insuranceCurrent ? "Yes" : "Not recorded",
      tone: evidence.insuranceCurrent ? "ok" : "warn",
    });
  }

  if (settings.show_worker_screening) {
    items.push({
      key: "screening",
      label: "Key personnel screening current",
      value: evidence.screeningCurrent ? "Yes" : "Not recorded",
      tone: evidence.screeningCurrent ? "ok" : "warn",
    });
  }

  if (settings.show_policies_current) {
    items.push({
      key: "policies",
      label: "Approved policies held",
      value: `${evidence.policiesCurrent} of ${evidence.policiesTotal}`,
      tone: evidence.policiesTotal > 0 && evidence.policiesCurrent === evidence.policiesTotal ? "ok" : "neutral",
    });
  }

  if (settings.show_audit_readiness) {
    const band = readinessBand(evidence);
    items.push({ key: "readiness", label: "Audit readiness", value: band.label, tone: band.tone });
  }

  return {
    organisationName: evidence.organisationName,
    generatedAt: now.toISOString(),
    intro: settings.intro_text ?? null,
    contactEmail: settings.contact_email ?? null,
    items,
    disclaimer: TRUST_DISCLAIMER,
  };
}
