import { describe, it, expect } from "vitest";
import { formatPlatformError } from "@/lib/platformApi";

describe("formatPlatformError", () => {
  it("returns plain strings unchanged", () => {
    expect(formatPlatformError("Invitation already accepted")).toBe("Invitation already accepted");
  });

  it("flattens field errors into a readable sentence", () => {
    expect(
      formatPlatformError({ abn: ["This ABN is already registered to an existing client (Acme)."] }),
    ).toBe("abn: This ABN is already registered to an existing client (Acme).");
  });

  it("joins multiple fields", () => {
    const msg = formatPlatformError({ legal_name: ["Required"], admin_email: ["Invalid email"] });
    expect(msg).toContain("legal name: Required");
    expect(msg).toContain("admin email: Invalid email");
  });

  it("falls back to a generic message for unknown shapes", () => {
    expect(formatPlatformError(undefined)).toBe("The request could not be completed.");
  });
});
