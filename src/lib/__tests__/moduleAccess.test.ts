import { describe, expect, it } from "vitest";
import { isServiceGated, moduleAllowed, moduleForPath } from "@/lib/moduleAccess";

describe("moduleAllowed", () => {
  it("denies whenever the role does not permit the module", () => {
    expect(moduleAllowed("medication", false, ["medication"])).toBe(false);
  });

  it("allows core modules regardless of confirmed services", () => {
    expect(moduleAllowed("policies", true, [])).toBe(true);
    expect(isServiceGated("policies")).toBe(false);
  });

  it("hides service-gated modules the organisation has not activated", () => {
    expect(moduleAllowed("sil", true, ["dashboard", "policies"])).toBe(false);
    expect(moduleAllowed("sil", true, ["sil"])).toBe(true);
  });

  it("keeps compliance modules ungated by service delivery", () => {
    expect(moduleAllowed("corrective_actions", true, [])).toBe(true);
    expect(moduleAllowed("registration", true, [])).toBe(true);
  });

  it("falls back to role access when activation is unknown", () => {
    expect(moduleAllowed("medication", true, null)).toBe(true);
  });
});

describe("moduleForPath", () => {
  it("resolves exact and nested routes", () => {
    expect(moduleForPath("/participants")).toBe("participants");
    expect(moduleForPath("/corrective-actions/abc-123")).toBe("corrective_actions");
  });


  it("returns null for unmapped routes", () => {
    expect(moduleForPath("/unknown")).toBeNull();
  });
});
