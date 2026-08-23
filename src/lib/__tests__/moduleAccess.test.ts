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

  it("maps approval and worker surfaces onto service operations", () => {
    expect(moduleAllowed("service_approvals", true, ["service_operations"])).toBe(true);
    expect(moduleAllowed("service_delivery", true, [])).toBe(false);
  });

  it("falls back to role access when activation is unknown", () => {
    expect(moduleAllowed("medication", true, null)).toBe(true);
  });
});

describe("moduleForPath", () => {
  it("resolves exact and nested routes", () => {
    expect(moduleForPath("/participants")).toBe("participants");
    expect(moduleForPath("/my-shifts/abc-123")).toBe("service_delivery");
  });

  it("returns null for unmapped routes", () => {
    expect(moduleForPath("/unknown")).toBeNull();
  });
});
