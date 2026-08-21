import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const ROLES = [
  "super_admin",
  "compliance_officer",
  "supervisor",
  "trainer",
  "support_worker",
  "hr_admin",
  "executive",
  "participant",
] as const;

const BodySchema = z.object({
  mode: z.enum(["create", "assign"]).default("create"),
  user_id: z.string().uuid().optional(),
  email: z.string().email().max(255).optional(),
  full_name: z.string().min(1).max(255).optional(),
  password: z.string().min(8).max(72).optional(),
  role: z.enum(ROLES),
  team_id: z.string().uuid().nullable().optional(),
  organisation_id: z.string().uuid().nullable().optional(),
  seed_compliance: z.boolean().default(true),
});

const ADMIN_ROLES = ["super_admin", "compliance_officer", "hr_admin"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, serviceKey);

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = (callerRoles ?? []).some((r) => ADMIN_ROLES.includes(r.role));
    if (!isAdmin) return json({ error: "Forbidden: staff enrollment requires an admin role" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;

    // Caller profile provides default org/team
    const { data: callerProfile } = await admin
      .from("user_profiles")
      .select("organisation_id, team_id")
      .eq("id", user.id)
      .maybeSingle();

    const organisationId = body.organisation_id ?? callerProfile?.organisation_id ?? null;
    const teamId = body.team_id ?? null;

    let staffId = body.user_id ?? null;
    let created = false;
    let tempPassword: string | null = null;

    if (body.mode === "create") {
      if (!body.email || !body.full_name) {
        return json({ error: "email and full_name are required to create a staff member" }, 400);
      }

      const { data: existing } = await admin
        .from("user_profiles")
        .select("id")
        .eq("email", body.email)
        .maybeSingle();

      if (existing) {
        staffId = existing.id;
      } else {
        tempPassword = body.password ?? `Gg${crypto.randomUUID().slice(0, 10)}!A`;
        const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
          email: body.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: body.full_name },
        });
        if (createErr || !authUser?.user) {
          return json({ error: createErr?.message ?? "Failed to create user" }, 400);
        }
        staffId = authUser.user.id;
        created = true;
      }
    }

    if (!staffId) return json({ error: "user_id is required when assigning an existing user" }, 400);

    // Profile: org / team / name
    const profileUpdate: Record<string, unknown> = {
      organisation_id: organisationId,
      team_id: teamId,
    };
    if (body.full_name) profileUpdate.full_name = body.full_name;
    await admin.from("user_profiles").update(profileUpdate).eq("id", staffId);

    // Role: single active role per user in this app
    await admin.from("user_roles").delete().eq("user_id", staffId);
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: staffId, role: body.role });
    if (roleErr) return json({ error: roleErr.message }, 400);

    // Seed compliance checklist for the role
    let seeded = 0;
    if (body.seed_compliance && organisationId) {
      const { data: reqs } = await admin
        .from("staff_compliance_requirements")
        .select("requirement_code, requirement_name, applies_to_roles, role_name")
        .eq("organisation_id", organisationId);

      const applicable = (reqs ?? []).filter((r) => {
        const roles = Array.isArray(r.applies_to_roles) ? r.applies_to_roles as string[] : null;
        if (roles && roles.length > 0) return roles.includes(body.role);
        return r.role_name === "all" || r.role_name === body.role;
      });

      const { data: existingRecords } = await admin
        .from("staff_compliance_records")
        .select("requirement_code")
        .eq("staff_id", staffId);
      const have = new Set((existingRecords ?? []).map((r) => r.requirement_code));

      const rows = applicable
        .filter((r) => !have.has(r.requirement_code))
        .map((r) => ({
          organisation_id: organisationId,
          staff_id: staffId,
          requirement_code: r.requirement_code,
          requirement_name: r.requirement_name,
          status: "missing",
        }));

      if (rows.length > 0) {
        const { error: recErr } = await admin.from("staff_compliance_records").insert(rows);
        if (!recErr) seeded = rows.length;
      }
    }

    // Re-evaluate eligibility (never assume compliant)
    await admin.rpc("evaluate_staff_eligibility", { _staff_id: staffId });

    // Audit trail
    await admin.from("audit_logs").insert({
      user_id: user.id,
      organisation_id: organisationId,
      action: created ? "staff_enrolled" : "staff_role_assigned",
      table_name: "user_profiles",
      record_id: staffId,
      new_values: {
        role: body.role,
        team_id: teamId,
        organisation_id: organisationId,
        seeded_requirements: seeded,
      },
    });

    return json({
      success: true,
      staff_id: staffId,
      created,
      seeded_requirements: seeded,
      temp_password: created ? tempPassword : null,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
