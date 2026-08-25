/** Pure helpers for the SaaS owner console and tenant onboarding. */
import { isValidAbn, isValidAcn } from "@/lib/abn";

export interface PathwayRequirement {
  id: string;
  step_key: string;
  requirement_key: string;
  label: string;
  help_text?: string | null;
  field_type: string;
  options?: unknown;
  is_mandatory: boolean;
  requires_document: boolean;
  requires_expiry: boolean;
  conditional_on?: Record<string, unknown> | null;
  sensitivity?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface AnswerValue {
  value_text?: string | null;
  value_number?: number | null;
  value_bool?: boolean | null;
  value_date?: string | null;
  value_json?: unknown;
}

export const ONBOARDING_STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "services", label: "Your services" },
  { key: "business", label: "Business & entity" },
  { key: "licences", label: "Licences & insurance" },
  { key: "workforce", label: "Workforce & screening" },
  { key: "operations", label: "Operations" },
  { key: "documents", label: "Documents" },
  { key: "review", label: "Review & submit" },
] as const;


export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]["key"];

/** A requirement only applies when its condition (another answer being truthy/equal) is met. */
export function requirementApplies(
  req: PathwayRequirement,
  answers: Record<string, AnswerValue>,
): boolean {
  const cond = req.conditional_on as { requirement_key?: string; equals?: unknown } | null | undefined;
  if (!cond || !cond.requirement_key) return true;
  const source = answers[cond.requirement_key];
  if (!source) return false;
  const actual =
    source.value_bool ?? source.value_text ?? source.value_number ?? source.value_date ?? null;
  if (cond.equals === undefined) return Boolean(actual);
  if (typeof cond.equals === "boolean") return Boolean(actual) === cond.equals;
  return String(actual ?? "") === String(cond.equals);
}

export function answerIsProvided(value: AnswerValue | undefined): boolean {
  if (!value) return false;
  if (typeof value.value_bool === "boolean") return true;
  if (value.value_number !== null && value.value_number !== undefined) return true;
  if (value.value_date) return true;
  if (value.value_text && value.value_text.trim().length > 0) return true;
  if (value.value_json !== null && value.value_json !== undefined) return true;
  return false;
}

/** Blockers for a single step: what the tenant admin still has to do. */
export function stepBlockers(
  stepKey: string,
  requirements: PathwayRequirement[],
  answers: Record<string, AnswerValue>,
  documentKeys: Set<string>,
): string[] {
  const blockers: string[] = [];
  for (const req of requirements) {
    if (req.step_key !== stepKey || !req.is_active) continue;
    if (!requirementApplies(req, answers)) continue;
    const answer = answers[req.requirement_key];
    if (req.is_mandatory && !answerIsProvided(answer)) {
      blockers.push(`${req.label} is required.`);
      continue;
    }
    if (req.is_mandatory && req.requires_document && !documentKeys.has(req.requirement_key)) {
      blockers.push(`Upload a document for ${req.label}.`);
    }
    if (req.requirement_key === "abn" && answer?.value_text && !isValidAbn(answer.value_text)) {
      blockers.push("ABN checksum is invalid — check the 11 digits.");
    }
    if (req.requirement_key === "acn" && answer?.value_text && !isValidAcn(answer.value_text)) {
      blockers.push("ACN must be 9 digits.");
    }
  }
  return blockers;
}

export function onboardingProgress(
  requirements: PathwayRequirement[],
  answers: Record<string, AnswerValue>,
  documentKeys: Set<string>,
): number {
  const applicable = requirements.filter(
    (r) => r.is_active && r.is_mandatory && requirementApplies(r, answers),
  );
  if (applicable.length === 0) return 0;
  const done = applicable.filter((r) => {
    if (!answerIsProvided(answers[r.requirement_key])) return false;
    if (r.requires_document && !documentKeys.has(r.requirement_key)) return false;
    return true;
  }).length;
  return Math.round((done / applicable.length) * 100);
}

export function submitBlockers(
  requirements: PathwayRequirement[],
  answers: Record<string, AnswerValue>,
  documentKeys: Set<string>,
): string[] {
  return ONBOARDING_STEPS.flatMap((s) => stepBlockers(s.key, requirements, answers, documentKeys));
}

/** Days until a date; negative when already past. */
export function daysUntil(date: string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export const EXPIRY_REMINDER_DAYS = [60, 30, 7];

export function expiryTone(days: number | null): "ok" | "warn" | "bad" | "neutral" {
  if (days === null) return "neutral";
  if (days < 0) return "bad";
  if (days <= 30) return "bad";
  if (days <= 60) return "warn";
  return "ok";
}

export function formatMoney(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

export interface NewClientForm {
  legal_name: string;
  trading_name: string;
  abn: string;
  acn: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  address_line1: string;
  suburb: string;
  state: string;
  postcode: string;
  pathway_id: string;
  package_id: string;
  trial_start_date: string;
  trial_days: number;
  admin_full_name: string;
  admin_email: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function newClientBlockers(form: NewClientForm): string[] {
  const b: string[] = [];
  if (form.legal_name.trim().length < 2) b.push("Legal entity name is required.");
  if (!isValidAbn(form.abn)) b.push("Enter a valid 11-digit ABN (checksum is verified).");
  if (!isValidAcn(form.acn)) b.push("ACN must be 9 digits when supplied.");
  if (form.primary_contact_name.trim().length < 2) b.push("Primary contact name is required.");
  if (!EMAIL.test(form.primary_contact_email)) b.push("Primary contact email is not valid.");
  if (!form.pathway_id) b.push("Select a provider pathway.");
  if (!form.package_id) b.push("Select a subscription package.");
  if (!form.trial_start_date) b.push("Select a trial start date.");
  if (form.trial_days < 0 || form.trial_days > 365) b.push("Trial days must be between 0 and 365.");
  if (form.admin_full_name.trim().length < 2) b.push("First tenant admin name is required.");
  if (!EMAIL.test(form.admin_email)) b.push("First tenant admin email is not valid.");
  return b;
}

export function emptyNewClientForm(): NewClientForm {
  return {
    legal_name: "",
    trading_name: "",
    abn: "",
    acn: "",
    primary_contact_name: "",
    primary_contact_email: "",
    primary_contact_phone: "",
    address_line1: "",
    suburb: "",
    state: "",
    postcode: "",
    pathway_id: "",
    package_id: "",
    trial_start_date: new Date().toISOString().slice(0, 10),
    trial_days: 14,
    admin_full_name: "",
    admin_email: "",
  };
}

/** Masks sensitive onboarding values (DOB, screening and police check numbers) by default. */
export function maskSensitive(value: string | null | undefined, sensitivity?: string | null): string {
  if (!value) return "—";
  const sensitive = sensitivity === "sensitive" || sensitivity === "highly_sensitive";
  if (!sensitive) return value;
  const tail = value.slice(-3);
  return `${"•".repeat(Math.max(3, value.length - 3))}${tail}`;
}

export const GETTING_STARTED_STEPS = [
  { key: "profile", label: "Complete organisation profile", to: "/onboarding" },
  { key: "registration_groups", label: "Confirm registration groups", to: "/registration" },
  { key: "registration_info", label: "Complete registration information", to: "/registration" },
  { key: "documents", label: "Upload required business evidence", to: "/onboarding" },
  { key: "key_personnel", label: "Add key personnel", to: "/registration" },
  { key: "worker_compliance", label: "Add worker compliance records", to: "/staff" },
  { key: "policies", label: "Review assigned policies", to: "/policies" },
  { key: "governance", label: "Complete governance requirements", to: "/governance" },
  { key: "corrective_actions", label: "Resolve corrective actions", to: "/corrective-actions" },
  { key: "evidence_pack", label: "Prepare auditor evidence pack", to: "/evidence-room" },
] as const;
