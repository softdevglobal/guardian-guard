import { supabase } from "@/integrations/supabase/client";

/** Calls the platform-admin edge function; throws a readable message on failure. */
export async function callPlatformAdmin<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("platform-admin", { body });
  if (error) {
    let message = error.message;
    const ctx = (error as any).context;
    try {
      const parsed = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
      if (parsed?.error) {
        message = typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error);
      }
      if (parsed?.outstanding) message += ` Outstanding: ${parsed.outstanding.join(", ")}`;
    } catch {
      /* keep the original message */
    }
    throw new Error(message);
  }
  if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error));
  return data as T;
}
