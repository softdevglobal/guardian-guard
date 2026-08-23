import { describe, expect, it } from "vitest";
import {
  activeModules, applicableQuestions, applicableRequirements, fillTemplate,
  ndisRequirementsApply, reconcileAnswers, registrationGroupsApply, selectionBlockers,
  type BusinessCategory, type QuestionRule, type RequirementRule, type ServiceType,
} from "@/lib/serviceSelection";

const cat = (code: string, id = code): BusinessCategory => ({
  id, code, name: code, active: true, display_order: 0, requires_ndis_registration: false,
});

const type = (code: string, catId: string, over: Partial<ServiceType> = {}): ServiceType => ({
  id: code, business_category_id: catId, code, name: code, active: true, display_order: 0,
  high_risk: false, requires_registration_group: false, requires_clinical_governance: false,
  requires_participant_management: false, requires_worker_screening: false,
  requires_photos: false, supports_geolocation: false, ...over,
});

const rule = (
  catId: string | null, ref: string, requirement_type: RequirementRule["requirement_type"], serviceTypeId: string | null = null,
): RequirementRule => ({
  id: `${catId}-${ref}`, business_category_id: catId, service_type_id: serviceTypeId,
  requirement_type, requirement_reference: ref, required: true, active: true,
});

const categories = [
  cat("household_cleaning"), cat("infection_control_cleaning"), cat("electrical_contractor"),
  cat("transport_provider"), cat("supported_independent_living"), cat("nursing_high_intensity"),
  cat("allied_health"), cat("community_access"),
];

const serviceTypes = [
  type("general_household_cleaning", "household_cleaning", { requires_photos: true, supports_geolocation: true }),
  type("bodily_fluid_cleanup", "infection_control_cleaning", { high_risk: true, requires_photos: true, supports_geolocation: true }),
  type("electrical_installation", "electrical_contractor", { high_risk: true, requires_photos: true, supports_geolocation: true }),
  type("participant_transport", "transport_provider", { requires_participant_management: true, requires_worker_screening: true, supports_geolocation: true }),
  type("sil_support", "supported_independent_living", { requires_participant_management: true }),
  type("medication_support", "nursing_high_intensity", { requires_clinical_governance: true, requires_participant_management: true }),
  type("therapeutic_supports", "allied_health", { requires_clinical_governance: true, requires_participant_management: true }),
  type("community_participation", "community_access", { requires_participant_management: true }),
];

const rules: RequirementRule[] = [
  rule("household_cleaning", "public_liability", "insurance"),
  rule("household_cleaning", "safe_environment", "operational_module"),
  rule("infection_control_cleaning", "waste_register", "operational_module"),
  rule("electrical_contractor", "electrical_contractor_licence", "licence"),
  rule("electrical_contractor", "trade_compliance", "operational_module"),
  rule("transport_provider", "driver_licence", "licence"),
  rule("supported_independent_living", "sil", "registration_group"),
  rule("nursing_high_intensity", "medication", "operational_module", "medication_support"),
];

const sel = (catId: string, typeId: string | null, ndis = false) => ({
  business_category_id: catId, service_type_id: typeId, ndis_funded: ndis,
});

const ctx = (selections: ReturnType<typeof sel>[], over = {}) => ({
  selections, categories, serviceTypes, rules, ...over,
});

describe("no hard-coded pathway", () => {
  it("gives an organisation with no selection only the core modules", () => {
    const mods = activeModules(ctx([]));
    expect(mods).toContain("policies");
    expect(mods).not.toContain("trade_compliance");
    expect(mods).not.toContain("participants");
  });

  it("never defaults a cleaning business to electrical requirements", () => {
    const reqs = applicableRequirements([sel("household_cleaning", "general_household_cleaning")], rules);
    expect(reqs.map((r) => r.requirement_reference)).not.toContain("electrical_contractor_licence");
  });
});

describe("module activation matrix", () => {
  it("cleaning activates safe environment and service operations", () => {
    const mods = activeModules(ctx([sel("household_cleaning", "general_household_cleaning")]));
    expect(mods).toEqual(expect.arrayContaining(["safe_environment", "service_operations"]));
    expect(mods).not.toContain("medication");
  });

  it("infection control activates the waste register", () => {
    expect(activeModules(ctx([sel("infection_control_cleaning", "bodily_fluid_cleanup")]))).toContain("waste_register");
  });

  it("electrical activates trade compliance but not participants", () => {
    const mods = activeModules(ctx([sel("electrical_contractor", "electrical_installation")]));
    expect(mods).toContain("trade_compliance");
    expect(mods).not.toContain("participants");
  });

  it("participant-facing services activate participants", () => {
    expect(activeModules(ctx([sel("transport_provider", "participant_transport")]))).toContain("participants");
  });

  it("photo evidence needs consent as well as a photo service", () => {
    expect(activeModules(ctx([sel("household_cleaning", "general_household_cleaning")]))).not.toContain("photo_evidence");
    expect(activeModules(ctx([sel("household_cleaning", "general_household_cleaning")], { photoConsent: true }))).toContain("photo_evidence");
  });

  it("geolocation needs consent as well as a field service", () => {
    expect(activeModules(ctx([sel("transport_provider", "participant_transport")]))).not.toContain("geolocation");
    expect(activeModules(ctx([sel("transport_provider", "participant_transport")], { locationConsent: true }))).toContain("geolocation");
  });

  it("SIL only activates once scope is confirmed", () => {
    expect(activeModules(ctx([sel("supported_independent_living", "sil_support")]))).not.toContain("sil");
    expect(activeModules(ctx([sel("supported_independent_living", "sil_support")], { silScopeConfirmed: true }))).toContain("sil");
  });

  it("medication activates only for the medication service", () => {
    expect(activeModules(ctx([sel("nursing_high_intensity", "medication_support")]))).toContain("medication");
    expect(activeModules(ctx([sel("allied_health", "therapeutic_supports")]))).not.toContain("medication");
  });

  it("restrictive practices only activate when declared", () => {
    expect(activeModules(ctx([sel("supported_independent_living", "sil_support")]))).not.toContain("restrictive_practices");
    expect(activeModules(ctx([sel("supported_independent_living", "sil_support")], { declaresRestrictivePractices: true }))).toContain("restrictive_practices");
  });

  it("clinical services activate participant care and competency", () => {
    const mods = activeModules(ctx([sel("allied_health", "therapeutic_supports")]));
    expect(mods).toEqual(expect.arrayContaining(["participant_care", "competency"]));
  });

  it("supports multiple categories at once", () => {
    const mods = activeModules(ctx([
      sel("household_cleaning", "general_household_cleaning"),
      sel("electrical_contractor", "electrical_installation"),
      sel("transport_provider", "participant_transport"),
    ]));
    expect(mods).toEqual(expect.arrayContaining(["safe_environment", "trade_compliance", "participants"]));
  });
});

describe("NDIS applicability", () => {
  it("non-NDIS business receives no registration group requirements", () => {
    const reqs = applicableRequirements([sel("supported_independent_living", "sil_support")], rules, "non_ndis");
    expect(reqs.some((r) => r.requirement_type === "registration_group")).toBe(false);
    expect(ndisRequirementsApply("non_ndis")).toBe(false);
  });

  it("registered NDIS provider receives registration group requirements", () => {
    const reqs = applicableRequirements([sel("supported_independent_living", "sil_support", true)], rules, "registered");
    expect(reqs.some((r) => r.requirement_type === "registration_group")).toBe(true);
    expect(registrationGroupsApply("registered")).toBe(true);
  });

  it("unregistered NDIS providers get standards but not registration groups", () => {
    expect(ndisRequirementsApply("unregistered")).toBe(true);
    expect(registrationGroupsApply("unregistered")).toBe(false);
  });
});

describe("questions and answer reconciliation", () => {
  const questions: QuestionRule[] = [
    { id: "q1", business_category_id: null, service_type_id: null, requirement_key: "abn", step_key: "business", label: "ABN", field_type: "text", requires_document: false, requires_expiry: false, required: true, display_order: 10, active: true },
    { id: "q2", business_category_id: "electrical_contractor", service_type_id: null, requirement_key: "electrical_contractor_licence", step_key: "licences", label: "Electrical licence", field_type: "text", requires_document: true, requires_expiry: true, required: true, display_order: 20, active: true },
    { id: "q3", business_category_id: "household_cleaning", service_type_id: null, requirement_key: "public_liability", step_key: "licences", label: "Public liability", field_type: "text", requires_document: true, requires_expiry: true, required: true, display_order: 30, active: true },
  ];

  it("asks universal questions to everyone", () => {
    expect(applicableQuestions([], questions).map((q) => q.requirement_key)).toEqual(["abn"]);
  });

  it("adds only the selected category's questions", () => {
    const keys = applicableQuestions([sel("household_cleaning", "general_household_cleaning")], questions).map((q) => q.requirement_key);
    expect(keys).toContain("public_liability");
    expect(keys).not.toContain("electrical_contractor_licence");
  });

  it("keeps still-relevant answers and archives the rest when selections change", () => {
    const applicable = applicableQuestions([sel("household_cleaning", "general_household_cleaning")], questions);
    const result = reconcileAnswers(["abn", "electrical_contractor_licence"], applicable);
    expect(result.keep).toEqual(["abn"]);
    expect(result.archive).toEqual(["electrical_contractor_licence"]);
    expect(result.outstanding).toContain("public_liability");
  });
});

describe("selection gate and templates", () => {
  it("blocks confirmation without a service or NDIS answer", () => {
    expect(selectionBlockers([], null)).toHaveLength(2);
    expect(selectionBlockers([sel("household_cleaning", "general_household_cleaning")], "non_ndis")).toHaveLength(0);
  });

  it("fills approved placeholders only", () => {
    const out = fillTemplate("{{legal_business_name}} ABN {{abn}} {{unknown}}", { legal_business_name: "Acme", abn: "123" });
    expect(out).toBe("Acme ABN 123 {{unknown}}");
  });
});
