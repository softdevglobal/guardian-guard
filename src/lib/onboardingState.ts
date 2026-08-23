/** Onboarding state machine and submission gate — pure so it can be tested without a database. */

export const ONBOARDING_STATUSES = [
  "not_started",
  "in_progress",
  "ready_for_review",
  "submitted",
  "changes_requested",
  "approved",
  "waived",
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

const TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  not_started: ["in_progress", "waived"],
  in_progress: ["ready_for_review", "waived"],
  ready_for_review: ["submitted", "in_progress", "waived"],
  submitted: ["changes_requested", "approved", "waived"],
  changes_requested: ["in_progress", "ready_for_review", "waived"],
  approved: [],
  waived: [],
};

export function canTransition(from: OnboardingStatus, to: OnboardingStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** Editing is locked once the pack is with the reviewer or finalised. */
export function isEditingLocked(status: OnboardingStatus): boolean {
  return status === "submitted" || status === "approved" || status === "waived";
}

/** "Start setup" only makes sense before anything has been sent for review. */
export function showsStartSetup(status: OnboardingStatus): boolean {
  return status === "not_started" || status === "in_progress" || status === "changes_requested";
}

export interface SubmissionInput {
  status: OnboardingStatus;
  progressPct: number;
  requirementCount: number;
  confirmedRegistrationGroups: number;
  missingMandatoryDocuments: string[];
  outstandingBlockers: string[];
}

/** Every reason the pack cannot be submitted. Empty array means submission is allowed. */
export function submissionBlockers(input: SubmissionInput): string[] {
  const blockers: string[] = [];
  if (isEditingLocked(input.status)) {
    blockers.push("This pack has already been submitted and is locked while it is reviewed.");
    return blockers;
  }
  if (input.requirementCount === 0) {
    blockers.push("No setup requirements are loaded for your pathway yet — contact your administrator before submitting.");
  }
  if (input.progressPct < 100) {
    blockers.push(`Mandatory setup is ${Math.max(0, Math.round(input.progressPct))}% complete — every mandatory item must be finished before you can submit.`);
  }
  if (input.confirmedRegistrationGroups === 0) {
    blockers.push("Confirm at least one registration group before submitting.");
  }
  for (const doc of input.missingMandatoryDocuments) {
    blockers.push(`Upload the mandatory document: ${doc}.`);
  }
  blockers.push(...input.outstandingBlockers);
  return blockers;
}

export function canSubmit(input: SubmissionInput): boolean {
  return submissionBlockers(input).length === 0;
}

export function statusLabel(status: OnboardingStatus): string {
  return status.replace(/_/g, " ");
}
