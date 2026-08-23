import { supabase } from "@/integrations/supabase/client";

/** Turns an edge-function error payload into a single readable sentence. */
export function formatPlatformError(err: unknown): string {
  if (typeof err === "string") return err;
  if (Array.isArray(err)) return err.join(" ");
  if (err && typeof err === "object") {
    const parts = Object.entries(err as Record<string, unknown>).map(([field, messages]) => {
      const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
      return `${field.replace(/_/g, " ")}: ${text}`;
    });
    if (parts.length > 0) return parts.join(" · ");
  }
  return "The request could not be completed.";
}

/** Calls the platform-admin edge function; throws a readable message on failure. */
export async function callPlatformAdmin<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("platform-admin", { body });
  if (error) {
    let message = error.message;
    const ctx = (error as any).context;
    try {
      const parsed = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
      if (parsed?.error) message = formatPlatformError(parsed.error);
      if (parsed?.outstanding) message += ` Outstanding: ${parsed.outstanding.join(", ")}`;
    } catch {
      /* keep the original message */
    }
    throw new Error(message);
  }
  if ((data as any)?.error) throw new Error(formatPlatformError((data as any).error));
  return data as T;
}
