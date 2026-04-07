import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const DEMO_USERS = [
  { email: "admin@dgtg.demo", password: "Demo1234!", full_name: "Sarah Chen", role: "super_admin" },
  { email: "compliance@dgtg.demo", password: "Demo1234!", full_name: "James Wilson", role: "compliance_officer" },
  { email: "supervisor@dgtg.demo", password: "Demo1234!", full_name: "Maria Garcia", role: "supervisor" },
  { email: "trainer@dgtg.demo", password: "Demo1234!", full_name: "Alex Thompson", role: "trainer" },
  { email: "worker@dgtg.demo", password: "Demo1234!", full_name: "Emily Davis", role: "support_worker" },
  { email: "hr@dgtg.demo", password: "Demo1234!", full_name: "Michael Brown", role: "hr_admin" },
  { email: "executive@dgtg.demo", password: "Demo1234!", full_name: "Lisa Anderson", role: "executive" },
  { email: "participant@dgtg.demo", password: "Demo1234!", full_name: "David Kim", role: "participant" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Create org first
    const { data: org } = await supabase
      .from("organisations")
      .select("id")
      .eq("name", "DGTG Demo Organisation")
      .maybeSingle();

    let orgId: string;
    if (org) {
      orgId = org.id;
    } else {
      const { data: newOrg, error: orgErr } = await supabase
        .from("organisations")
        .insert({ name: "DGTG Demo Organisation", abn: "12345678901", ndis_registration: "NDIS-DEMO-001", primary_contact_email: "admin@dgtg.demo" })
        .select("id")
        .single();
      if (orgErr) throw orgErr;
      orgId = newOrg.id;
    }

    // Create team
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("name", "Demo Team Alpha")
      .eq("organisation_id", orgId)
      .maybeSingle();

    let teamId: string;
    if (team) {
      teamId = team.id;
    } else {
      const { data: newTeam, error: teamErr } = await supabase
        .from("teams")
        .insert({ name: "Demo Team Alpha", description: "Primary demo team", organisation_id: orgId })
        .select("id")
        .single();
      if (teamErr) throw teamErr;
      teamId = newTeam.id;
    }

    const results = [];

    for (const u of DEMO_USERS) {
      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", u.email)
        .maybeSingle();

      if (existingProfile) {
        results.push({ email: u.email, status: "already_exists" });
        continue;
      }

      // Create auth user (auto-confirmed)
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });

      if (authErr) {
        results.push({ email: u.email, status: "auth_error", error: authErr.message });
        continue;
      }

      const userId = authUser.user.id;

      // Update profile with org and team
      await supabase
        .from("user_profiles")
        .update({ organisation_id: orgId, team_id: teamId })
        .eq("id", userId);

      // Assign role
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: u.role });

      if (roleErr) {
        results.push({ email: u.email, status: "role_error", error: roleErr.message });
        continue;
      }

      results.push({ email: u.email, role: u.role, status: "created" });
    }

    return new Response(JSON.stringify({ success: true, org_id: orgId, team_id: teamId, results }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
