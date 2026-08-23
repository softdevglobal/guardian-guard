import { describe, expect, it } from "vitest";
import { orgSettingsErrors, persistedMatches, trimOrgSettings } from "@/lib/orgSettings";

const VALID_ABN = "51824753556";

const base = {
  name: "  Example Provider  ",
  abn: ` ${VALID_ABN} `,
  ndis_registration: " 4050001234 ",
  primary_contact_email: " Admin@Example.COM ",
};

describe("organisation settings validation", () => {
  it("trims and normalises values before saving", () => {
    expect(trimOrgSettings(base)).toEqual({
      name: "Example Provider",
      abn: VALID_ABN,
      ndis_registration: "4050001234",
      primary_contact_email: "admin@example.com",
    });
  });

  it("accepts a valid organisation", () => {
    expect(orgSettingsErrors(base)).toEqual([]);
  });

  it("rejects an ABN that fails the checksum", () => {
    expect(orgSettingsErrors({ ...base, abn: "12345678901" }).join(" ")).toContain("checksum");
  });

  it("rejects an invalid email", () => {
    expect(orgSettingsErrors({ ...base, primary_contact_email: "not-an-email" })).toHaveLength(1);
  });

  it("rejects placeholder registration numbers", () => {
    expect(orgSettingsErrors({ ...base, ndis_registration: "TEST" }).join(" ")).toContain("placeholder");
  });

  it("requires an organisation name", () => {
    expect(orgSettingsErrors({ ...base, name: " " }).join(" ")).toContain("name is required");
  });
});

describe("settings persistence check", () => {
  it("confirms values survive a reload when the database echoes them back", () => {
    const saved = trimOrgSettings(base);
    expect(persistedMatches(saved, base)).toBe(true);
  });

  it("detects a silent failure where nothing was written", () => {
    expect(persistedMatches(null, base)).toBe(false);
    expect(persistedMatches({ ...trimOrgSettings(base), name: "Old name" }, base)).toBe(false);
  });
});
