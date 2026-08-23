import { describe, expect, it, vi } from "vitest";
import {
  PARTICIPANT_QUERY_KEYS,
  TASK_TEMPLATE_QUERY_KEYS,
  invalidateParticipants,
  invalidateTaskTemplates,
} from "@/lib/queryKeys";

function fakeClient() {
  const invalidateQueries = vi.fn();
  return { client: { invalidateQueries }, invalidateQueries };
}

describe("participant cache invalidation after create", () => {
  it("refreshes the register list and the shared scheduling lookup", () => {
    const { client, invalidateQueries } = fakeClient();

    invalidateParticipants(client);

    const keys = invalidateQueries.mock.calls.map((c) => c[0].queryKey[0]);
    // A participant created on the register must appear in Service Operations without reload.
    expect(keys).toContain("participants");
    expect(keys).toContain("lookup-participants");
    expect(keys).toHaveLength(PARTICIPANT_QUERY_KEYS.length);
  });

  it("does not silently drop a key from the canonical list", () => {
    expect([...PARTICIPANT_QUERY_KEYS]).toEqual(["participants", "lookup-participants"]);
  });
});

describe("task template cache invalidation after save", () => {
  it("refreshes every cache that renders templates", () => {
    const { client, invalidateQueries } = fakeClient();

    invalidateTaskTemplates(client);

    const keys = invalidateQueries.mock.calls.map((c) => c[0].queryKey[0]);
    expect(keys).toEqual([...TASK_TEMPLATE_QUERY_KEYS]);
  });
});
