/**
 * Canonical React Query keys for records that are read by more than one module.
 *
 * Participants are shown on the Participant register and, through useParticipants(),
 * in Service Operations, Participant Care, Medication and every scheduling selector.
 * Writing to the register must refresh all of those caches, so mutations invalidate
 * this list instead of a single hand-written key.
 */
export const PARTICIPANT_QUERY_KEYS = ["participants", "lookup-participants"] as const;

/** Task templates feed both the Existing templates list and the shift task selector. */
export const TASK_TEMPLATE_QUERY_KEYS = ["task-templates"] as const;

type Invalidator = { invalidateQueries: (filters: { queryKey: readonly unknown[] }) => unknown };

/** Refresh every cache that renders participants (register + shared lookups). */
export function invalidateParticipants(client: Invalidator) {
  PARTICIPANT_QUERY_KEYS.forEach((key) => client.invalidateQueries({ queryKey: [key] }));
}

/** Refresh every cache that renders service task templates. */
export function invalidateTaskTemplates(client: Invalidator) {
  TASK_TEMPLATE_QUERY_KEYS.forEach((key) => client.invalidateQueries({ queryKey: [key] }));
}
