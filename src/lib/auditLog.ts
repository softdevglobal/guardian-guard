import { supabase } from "@/integrations/supabase/client";

interface AuditLogParams {
  action: string;
  module: string;
  record_id?: string;
  details?: Record<string, any>;
  severity?: string;
}

export async function logAudit({ action, module, record_id, details, severity = "normal" }: AuditLogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, organisation_id")
      .eq("id", user.id)
      .single();

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_name: profile?.full_name ?? user.email,
      action,
      module,
      record_id,
      organisation_id: profile?.organisation_id,
      details: details ?? {},
      severity,
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}
