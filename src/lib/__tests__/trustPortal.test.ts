import { describe, expect, it } from "vitest";
import { buildTrustSnapshot, readinessBand, slugify, TRUST_DISCLAIMER, type TrustPortalRecord } from "@/lib/trustPortal";

const settings: TrustPortalRecord = {
  slug: "acme-supports",
  is_enabled: true,
  show_registration_status: true,
  show_insurance: true,
  show_worker_screening: true,
  show_policies_current: true,
  show_audit_readiness: true,
  intro_text: "We support people in western Sydney.",
  contact_email: "hello@example.com",
};

const evidence = {
  organisationName: "Acme Supports",
  registrationStatus: "registered",
  registrationNumber: "4-ABC",
  registrationExpiry: "2028-01-01",
  insuranceCurrent: true,
  screeningCurrent: true,
  policiesCurrent: 12,
  policiesTotal: 12,
};

describe("slugify", () => {
  it("produces a URL-safe slug of at least four characters", () => {
    expect(slugify("Acme Supports Pty Ltd")).toBe("acme-supports-pty-ltd");
    expect(slugify("AB")).toBe("ab-portal");
  });
});

describe("readinessBand", () => {
  it("bands on published evidence only", () => {
    expect(readinessBand(evidence).tone).toBe("ok");
    expect(readinessBand({ ...evidence, insuranceCurrent: false }).tone).toBe("warn");
    expect(readinessBand({ ...evidence, insuranceCurrent: false, screeningCurrent: false, policiesCurrent: 0 }).tone).toBe("neutral");
  });
});

describe("buildTrustSnapshot", () => {
  it("publishes only the toggled statuses and always carries the disclaimer", () => {
    const snap = buildTrustSnapshot(settings, evidence);
    expect(snap.items.map((i) => i.key)).toEqual([
      "registration",
      "registration_expiry",
      "insurance",
      "screening",
      "policies",
      "readiness",
    ]);
    expect(snap.disclaimer).toBe(TRUST_DISCLAIMER);
  });

  it("omits sections the provider has switched off", () => {
    const snap = buildTrustSnapshot(
      { ...settings, show_registration_status: false, show_worker_screening: false, show_audit_readiness: false },
      evidence,
    );
    expect(snap.items.map((i) => i.key)).toEqual(["insurance", "policies"]);
  });

  it("never claims compliance or certification", () => {
    const text = JSON.stringify(buildTrustSnapshot(settings, evidence)).toLowerCase();
    expect(text).not.toContain("ndis compliant");
    expect(text).not.toContain("certified");
  });
});
