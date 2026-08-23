import { describe, expect, it } from "vitest";
import { toSafeError } from "@/lib/userFacingError";

describe("safe error messages", () => {
  it("never leaks raw row-level security text", () => {
    const safe = toSafeError(
      { message: 'new row violates row-level security policy for table "policies"', code: "42501" },
      "create this policy",
    );
    expect(safe.title).toBe("You do not have permission");
    expect(JSON.stringify(safe).toLowerCase()).not.toContain("row-level security policy for table");
    expect(JSON.stringify(safe).toLowerCase()).not.toContain("supabase");
    expect(safe.canRetry).toBe(false);
  });

  it("explains duplicates without SQL detail", () => {
    const safe = toSafeError({ message: 'duplicate key value violates unique constraint "organisations_abn_key"', code: "23505" });
    expect(safe.title).toBe("Already recorded");
    expect(safe.description).not.toContain("unique constraint");
  });

  it("asks for required fields on a not-null violation", () => {
    expect(toSafeError({ message: 'null value in column "title"', code: "23502" }).title).toContain("Missing required");
  });

  it("offers a retry for connection problems", () => {
    expect(toSafeError({ message: "Failed to fetch" }).canRetry).toBe(true);
  });

  it("falls back to a safe generic message", () => {
    const safe = toSafeError(new Error("PGRST301 jwt expired for role anon"), "save this record");
    expect(safe.description).not.toContain("PGRST301");
    expect(safe.canRetry).toBe(true);
  });
});
