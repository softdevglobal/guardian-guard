import { describe, expect, it } from "vitest";
import {
  canSubmit, canTransition, isEditingLocked, showsStartSetup, submissionBlockers, type SubmissionInput,
} from "@/lib/onboardingState";

function input(over: Partial<SubmissionInput> = {}): SubmissionInput {
  return {
    status: "in_progress",
    progressPct: 100,
    requirementCount: 12,
    confirmedRegistrationGroups: 2,
    missingMandatoryDocuments: [],
    outstandingBlockers: [],
    ...over,
  };
}

describe("onboarding submission gate", () => {
  it("allows submission when everything is complete", () => {
    expect(canSubmit(input())).toBe(true);
  });

  it("blocks submission below 100% mandatory completion", () => {
    const blockers = submissionBlockers(input({ progressPct: 0 }));
    expect(canSubmit(input({ progressPct: 0 }))).toBe(false);
    expect(blockers.join(" ")).toContain("0% complete");
  });

  it("blocks submission without confirmed registration groups", () => {
    expect(canSubmit(input({ confirmedRegistrationGroups: 0 }))).toBe(false);
  });

  it("blocks submission while mandatory documents are missing", () => {
    const blockers = submissionBlockers(input({ missingMandatoryDocuments: ["Public liability insurance"] }));
    expect(blockers.some((b) => b.includes("Public liability insurance"))).toBe(true);
  });

  it("blocks submission when no requirements are loaded", () => {
    expect(canSubmit(input({ requirementCount: 0 }))).toBe(false);
  });

  it("lists every missing requirement at once", () => {
    const blockers = submissionBlockers(
      input({ progressPct: 40, confirmedRegistrationGroups: 0, missingMandatoryDocuments: ["ABN extract"] }),
    );
    expect(blockers).toHaveLength(3);
  });
});

describe("onboarding state machine", () => {
  it("locks editing and hides start setup once submitted", () => {
    expect(isEditingLocked("submitted")).toBe(true);
    expect(showsStartSetup("submitted")).toBe(false);
    expect(submissionBlockers(input({ status: "submitted" }))).toHaveLength(1);
  });

  it("reopens editing when changes are requested", () => {
    expect(isEditingLocked("changes_requested")).toBe(false);
    expect(showsStartSetup("changes_requested")).toBe(true);
  });

  it("only allows valid transitions", () => {
    expect(canTransition("submitted", "changes_requested")).toBe(true);
    expect(canTransition("submitted", "in_progress")).toBe(false);
    expect(canTransition("approved", "in_progress")).toBe(false);
    expect(canTransition("not_started", "submitted")).toBe(false);
  });

  it("treats an invalid submission below 100% as needing changes", () => {
    // Mirrors the database correction: a pack submitted under 100% moves to changes_requested.
    const invalid = input({ status: "submitted", progressPct: 0 });
    expect(canTransition(invalid.status, "changes_requested")).toBe(true);
    expect(isEditingLocked("changes_requested")).toBe(false);
  });
});
