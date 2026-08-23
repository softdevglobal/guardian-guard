/**
 * Converts raw database / PostgREST failures into safe, actionable messages.
 * Raw RLS, constraint and SQL text is never shown to a user — it is logged instead.
 */
export interface SafeError {
  title: string;
  description: string;
  canRetry: boolean;
  /** Short reference the user can quote to support; the technical detail stays in the logs. */
  supportReference: string;
}

const RLS = /row-level security|violates row-level security|permission denied|insufficient_privilege/i;
const DUPLICATE = /duplicate key|already exists|23505/i;
const NOT_NULL = /null value in column|23502/i;
const FOREIGN_KEY = /violates foreign key|23503/i;
const NETWORK = /failed to fetch|networkerror|timeout|econnreset/i;

/** Deterministic-length, non-identifying reference so support can find the logged entry. */
export function supportReference(seed = Date.now()): string {
  return `GG-${Math.abs(Math.floor(seed)).toString(36).slice(-6).toUpperCase()}`;
}

export function toSafeError(error: unknown, context = "save this record"): SafeError {
  const raw = typeof error === "string" ? error : ((error as any)?.message ?? "");
  const code = (error as any)?.code ?? "";
  const text = `${code} ${raw}`;
  const ref = supportReference();


  if (RLS.test(text)) {
    return {
      title: "You do not have permission",
      description: `Your role cannot ${context} for this organisation. Ask an administrator in your organisation to grant the permission, then try again.`,
      canRetry: false,
    };
  }
  if (DUPLICATE.test(text)) {
    return { title: "Already recorded", description: "A record with these details already exists. Open the existing record instead of creating a duplicate.", canRetry: false };
  }
  if (NOT_NULL.test(text)) {
    return { title: "Missing required information", description: "Some required fields are empty. Complete every field marked as required and try again.", canRetry: true };
  }
  if (FOREIGN_KEY.test(text)) {
    return { title: "Linked record not found", description: "A record this entry depends on is missing or was archived. Refresh the page and reselect the linked record.", canRetry: true };
  }
  if (NETWORK.test(text)) {
    return { title: "Connection problem", description: "We could not reach the server. Check your connection and retry.", canRetry: true };
  }
  return {
    title: "Could not complete that action",
    description: `We could not ${context}. Nothing has been changed. Please retry — if it keeps happening, contact your administrator.`,
    canRetry: true,
  };
}

/** Logs the technical detail internally without surfacing it to the user. */
export function reportError(scope: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[guardian-guard:${scope}]`, error);
}
