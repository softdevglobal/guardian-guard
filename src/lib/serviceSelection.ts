/**
 * Universal provider service-selection engine.
 *
 * Pure helpers only — every rule comes from configuration rows loaded from the
 * database (business_categories, service_types, compliance_requirement_rules,
 * onboarding_pathway_rules). Nothing in here hard-codes a pathway, and nothing
 * here may default a provider to a trade or to NDIS registration.
 */

export interface BusinessCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  display_order: number;
  requires_ndis_registration: boolean;
}

export interface ServiceType {
  id: string;
  business_category_id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  display_order: number;
  high_risk: boolean;
  requires_registration_group: boolean;
  requires_clinical_governance: boolean;
  requires_participant_management: boolean;
  requires_worker_screening: boolean;
  requires_photos: boolean;
  supports_geolocation: boolean;
}

export interface ServiceSelection {
  business_category_id: string;
  service_type_id: string | null;
  ndis_funded: boolean;
  registered_service?: boolean;
  is_archived?: boolean;
}

export type RequirementType =
  | "licence" | "insurance" | "screening" | "training" | "policy"
  | "evidence" | "risk_template" | "task_template" | "registration_group" | "operational_module";

export interface RequirementRule {
  id: string;
  business_category_id: string | null;
  service_type_id: string | null;
  requirement_type: RequirementType;
  requirement_reference: string;
  label?: string | null;
  required: boolean;
  condition_json?: Record<string, unknown> | null;
  active: boolean;
}

export interface QuestionRule {
  id: string;
  business_category_id: string | null;
  service_type_id: string | null;
  requirement_key: string;
  step_key: string;
  label: string;
  field_type: string;
  requires_document: boolean;
  requires_expiry: boolean;
  required: boolean;
  condition_json?: Record<string, unknown> | null;
  display_order: number;
  active: boolean;
}

export const NDIS_FUNDING_OPTIONS = [
  { value: "registered", label: "Yes — registered NDIS provider" },
  { value: "applying", label: "Yes — registration application in progress" },
  { value: "unregistered", label: "Yes — unregistered provider delivering eligible services" },
  { value: "non_ndis", label: "No — non-NDIS commercial services" },
  { value: "combination", label: "Combination of NDIS and non-NDIS work" },
] as const;

export type NdisFundingStatus = (typeof NDIS_FUNDING_OPTIONS)[number]["value"];

/** NDIS Practice Standards and registration groups only apply when NDIS-funded work is declared. */
export function ndisRequirementsApply(status: NdisFundingStatus | null | undefined): boolean {
  return status === "registered" || status === "applying" || status === "unregistered" || status === "combination";
}

/** Registration groups may only be claimed when the provider says it is registered or applying. */
export function registrationGroupsApply(status: NdisFundingStatus | null | undefined): boolean {
  return status === "registered" || status === "applying" || status === "combination";
}

/** Modules every organisation gets, whatever it sells. */
export const CORE_MODULES = [
  "dashboard", "settings", "staff", "training", "policies", "incidents",
  "complaints", "risks", "governance", "audit", "documents", "onboarding",
] as const;

const TRADE_CATEGORIES = new Set([
  "electrical_contractor", "plumbing_contractor", "building_contractor",
  "home_modifications", "vehicle_modifications",
]);

const SAFE_ENVIRONMENT_CATEGORIES = new Set([
  "household_cleaning", "infection_control_cleaning", "waste_management",
]);

export interface ActivationContext {
  selections: ServiceSelection[];
  categories: BusinessCategory[];
  serviceTypes: ServiceType[];
  rules: RequirementRule[];
  /** Consent/privacy settings gate the two capture modules. */
  photoConsent?: boolean;
  locationConsent?: boolean;
  /** Provider explicitly declares actual or intended restrictive practice use. */
  declaresRestrictivePractices?: boolean;
  /** SIL scope confirmed (registration group / service agreement in place). */
  silScopeConfirmed?: boolean;
}

/** Which application modules a provider's confirmed services switch on. */
export function activeModules(ctx: ActivationContext): string[] {
  const live = ctx.selections.filter((s) => !s.is_archived);
  const mods = new Set<string>(CORE_MODULES);
  if (live.length === 0) return [...mods].sort();

  const catById = new Map(ctx.categories.map((c) => [c.id, c]));
  const typeById = new Map(ctx.serviceTypes.map((t) => [t.id, t]));
  const selectedCatCodes = new Set<string>();
  const selectedTypes: ServiceType[] = [];

  for (const sel of live) {
    const cat = catById.get(sel.business_category_id);
    if (cat) selectedCatCodes.add(cat.code);
    const type = sel.service_type_id ? typeById.get(sel.service_type_id) : undefined;
    if (type) selectedTypes.push(type);
  }

  // Rule-driven modules from configuration.
  for (const rule of ctx.rules) {
    if (!rule.active || rule.requirement_type !== "operational_module") continue;
    const matches = live.some(
      (s) =>
        s.business_category_id === rule.business_category_id &&
        (!rule.service_type_id || rule.service_type_id === s.service_type_id),
    );
    if (matches) mods.add(rule.requirement_reference);
  }

  // Flag-driven modules from the service definitions.
  if (selectedTypes.some((t) => t.requires_participant_management)) {
    mods.add("participants");
    mods.add("participant_care");
  }
  if (selectedTypes.some((t) => t.supports_geolocation)) mods.add("service_operations");
  if (selectedTypes.some((t) => t.requires_photos) && ctx.photoConsent) mods.add("photo_evidence");
  if (selectedTypes.some((t) => t.supports_geolocation) && ctx.locationConsent) mods.add("geolocation");
  if (selectedTypes.some((t) => t.requires_clinical_governance)) {
    mods.add("participant_care");
    mods.add("competency");
  }
  for (const code of selectedCatCodes) {
    if (TRADE_CATEGORIES.has(code)) mods.add("trade_compliance");
    if (SAFE_ENVIRONMENT_CATEGORIES.has(code)) mods.add("safe_environment");
  }
  if (selectedCatCodes.has("waste_management") || selectedCatCodes.has("infection_control_cleaning")) {
    mods.add("waste_register");
  }
  if (selectedCatCodes.has("supported_independent_living") && ctx.silScopeConfirmed) mods.add("sil");
  else mods.delete("sil");
  if (ctx.declaresRestrictivePractices) mods.add("restrictive_practices");

  return [...mods].sort();
}

/** Requirements that apply to the current selection, de-duplicated by type + reference. */
export function applicableRequirements(
  selections: ServiceSelection[],
  rules: RequirementRule[],
  ndisStatus?: NdisFundingStatus | null,
): RequirementRule[] {
  const live = selections.filter((s) => !s.is_archived);
  const seen = new Set<string>();
  const out: RequirementRule[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    if (rule.requirement_type === "registration_group" && !registrationGroupsApply(ndisStatus)) continue;
    const matches = live.some(
      (s) =>
        s.business_category_id === rule.business_category_id &&
        (!rule.service_type_id || rule.service_type_id === s.service_type_id),
    );
    if (!matches) continue;
    const key = `${rule.requirement_type}:${rule.requirement_reference}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rule);
  }
  return out;
}

/** Onboarding questions that apply: universal ones plus the ones the selection brings in. */
export function applicableQuestions(
  selections: ServiceSelection[],
  questions: QuestionRule[],
): QuestionRule[] {
  const live = selections.filter((s) => !s.is_archived);
  const seen = new Set<string>();
  return questions
    .filter((q) => q.active)
    .filter((q) => {
      if (!q.business_category_id) return true;
      return live.some(
        (s) =>
          s.business_category_id === q.business_category_id &&
          (!q.service_type_id || q.service_type_id === s.service_type_id),
      );
    })
    .filter((q) => {
      if (seen.has(q.requirement_key)) return false;
      seen.add(q.requirement_key);
      return true;
    })
    .sort((a, b) => a.display_order - b.display_order || a.label.localeCompare(b.label));
}

/**
 * When selections change, previously answered keys that no longer apply are archived
 * (never deleted) and newly applicable keys are reported as outstanding.
 */
export function reconcileAnswers(
  answeredKeys: string[],
  applicable: QuestionRule[],
): { keep: string[]; archive: string[]; outstanding: string[] } {
  const applicableKeys = new Set(applicable.map((q) => q.requirement_key));
  const answered = new Set(answeredKeys);
  return {
    keep: answeredKeys.filter((k) => applicableKeys.has(k)),
    archive: answeredKeys.filter((k) => !applicableKeys.has(k)),
    outstanding: applicable.filter((q) => q.required && !answered.has(q.requirement_key)).map((q) => q.requirement_key),
  };
}

export interface PlaceholderValues {
  legal_business_name?: string | null;
  trading_name?: string | null;
  abn?: string | null;
  address?: string | null;
  contact_person?: string | null;
  service_types?: string | null;
  emergency_contact?: string | null;
}

/** Fills approved placeholders only. Unknown placeholders are left untouched for human review. */
export function fillTemplate(body: string, values: PlaceholderValues): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{{${key}}}`).join(value ?? ""),
    body,
  );
}

export function selectionBlockers(selections: ServiceSelection[], ndisStatus: NdisFundingStatus | null): string[] {
  const blockers: string[] = [];
  const live = selections.filter((s) => !s.is_archived);
  if (live.length === 0) blockers.push("Select at least one service your organisation provides.");
  if (!ndisStatus) blockers.push("Tell us whether these services are funded through the NDIS.");
  const categoriesWithoutService = live.filter((s) => !s.service_type_id).length;
  if (live.length > 0 && categoriesWithoutService === live.length) {
    blockers.push("Select at least one specific service under the categories you chose.");
  }
  return blockers;
}
