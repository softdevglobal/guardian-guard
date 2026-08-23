import { describe, expect, it } from "vitest";
import { formatAbn, isValidAbn, isValidAcn, normaliseAbn } from "@/lib/abn";
import {
  daysUntil,
  emptyNewClientForm,
  expiryTone,
  formatMoney,
  maskSensitive,
  newClientBlockers,
  onboardingProgress,
  requirementApplies,
  stepBlockers,
  submitBlockers,
  type PathwayRequirement,
} from "@/lib/platform";

const req = (over: Partial<PathwayRequirement>): PathwayRequirement => ({
  id: over.requirement_key ?? "r",
  step_key: "business",
  requirement_key: "key",
  label: "Label",
  field_type: "text",
  is_mandatory: true,
  requires_document: false,
  requires_expiry: false,
  conditional_on: null,
  sort_order: 1,
  is_active: true,
  ...over,
});

describe("abn", () => {
  it("accepts a valid ABN and rejects a bad checksum", () => {
    expect(isValidAbn("51 824 753 556")).toBe(true);
    expect(isValidAbn("51 824 753 557")).toBe(false);
    expect(isValidAbn("123")).toBe(false);
    expect(isValidAbn(null)).toBe(false);
  });

  it("normalises and formats", () => {
    expect(normaliseAbn("51-824 753.556")).toBe("51824753556");
    expect(formatAbn("51824753556")).toBe("51 824 753 556");
  });

  it("treats an empty ACN as acceptable and enforces 9 digits otherwise", () => {
    expect(isValidAcn("")).toBe(true);
    expect(isValidAcn("123456789")).toBe(true);
    expect(isValidAcn("1234")).toBe(false);
  });
});

describe("conditional requirements", () => {
  it("skips a requirement whose condition is unmet", () => {
    const r = req({ requirement_key: "workers_comp", conditional_on: { requirement_key: "has_employees", equals: true } });
    expect(requirementApplies(r, {})).toBe(false);
    expect(requirementApplies(r, { has_employees: { value_bool: false } })).toBe(false);
    expect(requirementApplies(r, { has_employees: { value_bool: true } })).toBe(true);
  });
});

describe("step and submit blockers", () => {
  const reqs = [
    req({ requirement_key: "legal_name", label: "Legal name" }),
    req({ requirement_key: "abn", label: "ABN" }),
    req({ requirement_key: "licence", label: "Electrical licence", step_key: "licences", requires_document: true }),
  ];

  it("lists missing answers, invalid ABN and missing uploads", () => {
    const blockers = submitBlockers(reqs, { abn: { value_text: "11111111111" } }, new Set());
    expect(blockers).toContain("Legal name is required.");
    expect(blockers).toContain("ABN checksum is invalid — check the 11 digits.");
    expect(blockers).toContain("Electrical licence is required.");
  });

  it("still blocks when the answer exists but the document does not", () => {
    const blockers = stepBlockers(
      "licences",
      reqs,
      { licence: { value_text: "EC12345" } },
      new Set(),
    );
    expect(blockers).toEqual(["Upload a document for Electrical licence."]);
    expect(stepBlockers("licences", reqs, { licence: { value_text: "EC12345" } }, new Set(["licence"]))).toEqual([]);
  });

  it("reports progress across mandatory applicable requirements", () => {
    expect(onboardingProgress(reqs, {}, new Set())).toBe(0);
    expect(
      onboardingProgress(
        reqs,
        { legal_name: { value_text: "Acme" }, abn: { value_text: "51824753556" }, licence: { value_text: "EC1" } },
        new Set(["licence"]),
      ),
    ).toBe(100);
  });
});

describe("client provisioning form", () => {
  it("blocks an incomplete form and passes a complete one", () => {
    expect(newClientBlockers(emptyNewClientForm()).length).toBeGreaterThan(0);
    const good = {
      ...emptyNewClientForm(),
      legal_name: "Acme Electrical Pty Ltd",
      abn: "51824753556",
      primary_contact_name: "Jo Smith",
      primary_contact_email: "jo@example.com",
      pathway_id: "11111111-1111-1111-1111-111111111111",
      package_id: "22222222-2222-2222-2222-222222222222",
      admin_full_name: "Jo Smith",
      admin_email: "jo@example.com",
    };
    expect(newClientBlockers(good)).toEqual([]);
  });
});

describe("expiry and formatting", () => {
  it("computes days until and tone bands", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(daysUntil("2026-01-31", now)).toBe(30);
    expect(expiryTone(daysUntil("2026-01-31", now))).toBe("bad");
    expect(expiryTone(daysUntil("2026-02-20", now))).toBe("warn");
    expect(expiryTone(daysUntil("2026-06-01", now))).toBe("ok");
    expect(expiryTone(daysUntil("2025-12-01", now))).toBe("bad");
    expect(expiryTone(null)).toBe("neutral");
  });

  it("formats money and masks sensitive values", () => {
    expect(formatMoney(299)).toBe("$299");
    expect(maskSensitive("1990-01-01", "sensitive")).toMatch(/-01$/);
    expect(maskSensitive("public value", "internal")).toBe("public value");
  });
});
