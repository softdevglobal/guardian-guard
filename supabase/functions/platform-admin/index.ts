import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function abnIsValid(raw: string) {
  const digits = (raw || "").replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const nums = digits.split("").map(Number);
  nums[0] -= 1;
  const sum = nums.reduce((acc, n, i) => acc + n * weights[i], 0);
  return sum % 89 === 0;
}

const ProvisionSchema = z.object({
  action: z.literal("provision_client"),
  legal_name: z.string().min(2).max(200),
  trading_name: z.string().max(200).optional().nullable(),
  abn: z.string().min(11).max(14),
  acn: z.string().max(20).optional().nullable(),
  primary_contact_name: z.string().min(2).max(150),
  primary_contact_email: z.string().email().max(255),
  primary_contact_phone: z.string().max(40).optional().nullable(),
  address_line1: z.string().max(255).optional().nullable(),
  suburb: z.string().max(120).optional().nullable(),
  state: z.string().max(20).optional().nullable(),
  postcode: z.string().max(10).optional().nullable(),
  pathway_id: z.string().uuid(),
  package_id: z.string().uuid(),
  trial_start_date: z.string().min(8),
  trial_days: z.number().int().min(0).max(365),
  admin_full_name: z.string().min(2).max(150),
  admin_email: z.string().email().max(255),
});

const SimpleSchema = z.object({
  action: z.enum([
    "resend_invite",
    "change_package",
    "extend_trial",
    "suspend",
    "reactivate",
    "approve_onboarding",
    "return_onboarding",
    "start_support_session",
  ]),
  organisation_id: z.string().uuid().optional(),
  invitation_id: z.string().uuid().optional(),
  package_id: z.string().uuid().optional(),
  extra_days: z.number().int().min(1).max(365).optional(),
  reason: z.string().max(1000).optional(),
});

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

    const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isPlatform = (callerRoles ?? []).some((r) => r.role === "platform_super_admin");
    if (!isPlatform) return json({ error: "Forbidden: platform owner access required" }, 403);

    const raw = await req.json();

    const logEvent = async (organisation_id: string | null, event_type: string, summary: string, metadata: Record<string, unknown> = {}) => {
      await admin.from("platform_activity_events").insert({
        organisation_id,
        actor_user_id: user.id,
        actor_label: user.email,
        event_type,
        summary,
        metadata,
      });
    };

    // ---------------- provision a new client ----------------
    if (raw?.action === "provision_client") {
      const parsed = ProvisionSchema.safeParse(raw);
      if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
      const b = parsed.data;

      if (!abnIsValid(b.abn)) return json({ error: { abn: ["ABN checksum is invalid"] } }, 400);

      const normalisedAbn = b.abn.replace(/\s/g, "");
      const { data: dupAbn } = await admin
        .from("organisations")
        .select("id, name")
        .eq("abn", normalisedAbn)
        .maybeSingle();
      if (dupAbn) {
        return json(
          { error: { abn: [`This ABN is already registered to an existing client (${dupAbn.name}).`] } },
          409,
        );
      }

      const { data: pkg, error: pkgErr } = await admin
        .from("subscription_packages")
        .select("*")
        .eq("id", b.package_id)
        .maybeSingle();
      if (pkgErr || !pkg) return json({ error: "Package not found" }, 400);

      const { data: org, error: orgErr } = await admin
        .from("organisations")
        .insert({
          name: b.trading_name || b.legal_name,
          legal_name: b.legal_name,
          trading_name: b.trading_name,
          abn: normalisedAbn,
          acn: b.acn,
          primary_contact_name: b.primary_contact_name,
          primary_contact_email: b.primary_contact_email,
          primary_contact_phone: b.primary_contact_phone,
          address_line1: b.address_line1,
          suburb: b.suburb,
          state: b.state,
          postcode: b.postcode,
          pathway_id: b.pathway_id,
          account_status: "onboarding",
          is_demo: false,
          created_by: user.id,
          last_activity_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (orgErr || !org) return json({ error: orgErr?.message ?? "Failed to create organisation" }, 400);

      const rollback = async () => {
        await admin.from("organisations").delete().eq("id", org.id);
      };

      const trialStart = new Date(b.trial_start_date);
      const trialEnd = new Date(trialStart.getTime() + b.trial_days * 86400000);

      const { data: sub, error: subErr } = await admin
        .from("tenant_subscriptions")
        .insert({
          organisation_id: org.id,
          package_id: pkg.id,
          status: b.trial_days > 0 ? "trial" : "active",
          trial_start_date: trialStart.toISOString().slice(0, 10),
          trial_end_date: trialEnd.toISOString().slice(0, 10),
          current_period_start: trialStart.toISOString().slice(0, 10),
          current_period_end: trialEnd.toISOString().slice(0, 10),
          renewal_date: trialEnd.toISOString().slice(0, 10),
          monthly_price: pkg.monthly_price,
          seats_included: pkg.included_users,
          unlimited_users: pkg.unlimited_users,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (subErr) {
        await rollback();
        return json({ error: subErr.message }, 400);
      }

      const { data: onboarding, error: onbErr } = await admin
        .from("organisation_onboarding")
        .insert({
          organisation_id: org.id,
          pathway_id: b.pathway_id,
          status: "not_started",
          current_step: "welcome",
        })
        .select("id")
        .single();
      if (onbErr) {
        await rollback();
        return json({ error: onbErr.message }, 400);
      }

      const modules: string[] = pkg.module_entitlements ?? [];
      if (modules.length > 0) {
        const { error: entErr } = await admin.from("organisation_module_entitlements").insert(
          modules.map((m) => ({
            organisation_id: org.id,
            module_key: m,
            is_enabled: false,
            source: "package",
          })),
        );
        if (entErr) {
          await rollback();
          return json({ error: entErr.message }, 400);
        }
      }

      // Invitation record first so a failed send stays recoverable.
      const { data: invite, error: invErr } = await admin
        .from("organisation_invitations")
        .insert({
          organisation_id: org.id,
          email: b.admin_email,
          full_name: b.admin_full_name,
          role: "tenant_admin",
          status: "pending",
          invited_by: user.id,
        })
        .select("id")
        .single();
      if (invErr) {
        await rollback();
        return json({ error: invErr.message }, 400);
      }

      let inviteStatus = "sent";
      let tempPassword: string | null = null;
      let inviteError: string | null = null;

      try {
        const { data: existingProfile } = await admin
          .from("user_profiles")
          .select("id")
          .eq("email", b.admin_email)
          .maybeSingle();

        let adminUserId = existingProfile?.id ?? null;
        if (!adminUserId) {
          tempPassword = `Gg${crypto.randomUUID().slice(0, 10)}!A`;
          const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
            email: b.admin_email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: b.admin_full_name },
          });
          if (createErr || !authUser?.user) throw new Error(createErr?.message ?? "Failed to create admin user");
          adminUserId = authUser.user.id;
        }

        await admin
          .from("user_profiles")
          .update({ organisation_id: org.id, full_name: b.admin_full_name })
          .eq("id", adminUserId);
        // Never clear a platform owner's role; replace only tenant-scoped roles.
        const { data: existingRoles } = await admin.from("user_roles").select("role").eq("user_id", adminUserId);
        if ((existingRoles ?? []).some((r) => r.role === "platform_super_admin")) {
          throw new Error("This email belongs to a platform owner account and cannot be used as a tenant admin.");
        }
        await admin.from("user_roles").delete().eq("user_id", adminUserId).neq("role", "platform_super_admin");
        await admin.from("user_roles").upsert(
          { user_id: adminUserId, role: "tenant_admin" },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        );

        await admin
          .from("organisation_invitations")
          .update({ status: "sent", accepted_user_id: adminUserId, last_sent_at: new Date().toISOString() })
          .eq("id", invite.id);
      } catch (e) {
        inviteStatus = "pending";
        inviteError = e instanceof Error ? e.message : "Invitation failed";
        await admin
          .from("organisation_invitations")
          .update({ status: "failed", failure_reason: inviteError })
          .eq("id", invite.id);
      }

      await logEvent(org.id, "client_provisioned", `Client ${b.legal_name} provisioned on ${pkg.name}`, {
        package: pkg.code,
        trial_days: b.trial_days,
        invite_status: inviteStatus,
      });
      await admin.from("audit_logs").insert({
        user_id: user.id,
        organisation_id: org.id,
        action: "client_provisioned",
        module: "platform",
        record_id: org.id,
        severity: "info",
        details: { package: pkg.code, invite_status: inviteStatus },
      });

      return json({
        success: true,
        organisation_id: org.id,
        subscription_id: sub?.id,
        onboarding_id: onboarding?.id,
        invitation_id: invite.id,
        invite_status: inviteStatus,
        invite_error: inviteError,
        temp_password: tempPassword,
      });
    }

    // ---------------- lifecycle actions ----------------
    const parsed = SimpleSchema.safeParse(raw);
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const b = parsed.data;

    if (b.action === "resend_invite") {
      if (!b.invitation_id) return json({ error: "invitation_id required" }, 400);
      const { data: inv } = await admin
        .from("organisation_invitations")
        .select("*")
        .eq("id", b.invitation_id)
        .maybeSingle();
      if (!inv) return json({ error: "Invitation not found" }, 404);
      if (inv.status === "accepted") return json({ error: "Invitation already accepted" }, 400);

      // Rate limit: max 1 resend per 60s, max 10 attempts total.
      const since = Date.now() - new Date(inv.last_sent_at).getTime();
      if (since < 60_000) return json({ error: "Please wait a minute before resending this invitation." }, 429);
      if (inv.send_attempts >= 10) return json({ error: "Resend limit reached for this invitation." }, 429);

      let adminUserId = inv.accepted_user_id as string | null;
      let tempPassword: string | null = null;
      try {
        if (!adminUserId) {
          const { data: existingProfile } = await admin
            .from("user_profiles")
            .select("id")
            .eq("email", inv.email)
            .maybeSingle();
          adminUserId = existingProfile?.id ?? null;
          if (!adminUserId) {
            tempPassword = `Gg${crypto.randomUUID().slice(0, 10)}!A`;
            const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
              email: inv.email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { full_name: inv.full_name },
            });
            if (createErr || !authUser?.user) throw new Error(createErr?.message ?? "Failed to create user");
            adminUserId = authUser.user.id;
          }
          await admin
            .from("user_profiles")
            .update({ organisation_id: inv.organisation_id, full_name: inv.full_name })
            .eq("id", adminUserId);
          await admin.from("user_roles").delete().eq("user_id", adminUserId);
          await admin.from("user_roles").insert({ user_id: adminUserId, role: inv.role });
        } else {
          const { data: link } = await admin.auth.admin.generateLink({
            type: "recovery",
            email: inv.email,
          });
          if (!link) throw new Error("Could not generate invitation link");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Resend failed";
        await admin
          .from("organisation_invitations")
          .update({
            status: "failed",
            failure_reason: msg,
            send_attempts: inv.send_attempts + 1,
            last_sent_at: new Date().toISOString(),
          })
          .eq("id", inv.id);
        return json({ error: msg }, 400);
      }

      await admin
        .from("organisation_invitations")
        .update({
          status: "sent",
          accepted_user_id: adminUserId,
          failure_reason: null,
          send_attempts: inv.send_attempts + 1,
          last_sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        })
        .eq("id", inv.id);

      await logEvent(inv.organisation_id, "invitation_resent", `Invitation resent to ${inv.email}`);
      return json({ success: true, temp_password: tempPassword });
    }

    if (!b.organisation_id) return json({ error: "organisation_id required" }, 400);
    const orgId = b.organisation_id;

    if (b.action === "change_package") {
      if (!b.package_id) return json({ error: "package_id required" }, 400);
      const { data: pkg } = await admin.from("subscription_packages").select("*").eq("id", b.package_id).maybeSingle();
      if (!pkg) return json({ error: "Package not found" }, 400);
      const { error } = await admin
        .from("tenant_subscriptions")
        .update({
          package_id: pkg.id,
          monthly_price: pkg.monthly_price,
          seats_included: pkg.included_users,
          unlimited_users: pkg.unlimited_users,
        })
        .eq("organisation_id", orgId);
      if (error) return json({ error: error.message }, 400);
      await logEvent(orgId, "package_changed", `Package changed to ${pkg.name}`, { package: pkg.code });
      return json({ success: true });
    }

    if (b.action === "extend_trial") {
      const days = b.extra_days ?? 14;
      const { data: sub } = await admin
        .from("tenant_subscriptions")
        .select("id, trial_end_date")
        .eq("organisation_id", orgId)
        .maybeSingle();
      if (!sub) return json({ error: "Subscription not found" }, 404);
      const base = sub.trial_end_date ? new Date(sub.trial_end_date) : new Date();
      const newEnd = new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);
      await admin
        .from("tenant_subscriptions")
        .update({ trial_end_date: newEnd, renewal_date: newEnd, status: "trial" })
        .eq("id", sub.id);
      await logEvent(orgId, "trial_extended", `Trial extended by ${days} days to ${newEnd}`);
      return json({ success: true, trial_end_date: newEnd });
    }

    if (b.action === "suspend" || b.action === "reactivate") {
      if (!b.reason || b.reason.trim().length < 5) {
        return json({ error: "A reason of at least 5 characters is required." }, 400);
      }
      const suspending = b.action === "suspend";
      await admin
        .from("organisations")
        .update({
          account_status: suspending ? "suspended" : "active",
          suspended_reason: suspending ? b.reason : null,
        })
        .eq("id", orgId);
      await admin
        .from("tenant_subscriptions")
        .update({ status: suspending ? "suspended" : "active" })
        .eq("organisation_id", orgId);
      await logEvent(orgId, suspending ? "tenant_suspended" : "tenant_reactivated", b.reason);
      await admin.from("audit_logs").insert({
        user_id: user.id,
        organisation_id: orgId,
        action: suspending ? "tenant_suspended" : "tenant_reactivated",
        module: "platform",
        record_id: orgId,
        severity: suspending ? "high" : "info",
        details: { reason: b.reason },
      });
      return json({ success: true });
    }

    if (b.action === "approve_onboarding" || b.action === "return_onboarding") {
      const { data: onb } = await admin
        .from("organisation_onboarding")
        .select("id, pathway_id")
        .eq("organisation_id", orgId)
        .maybeSingle();
      if (!onb) return json({ error: "Onboarding record not found" }, 404);

      if (b.action === "return_onboarding") {
        if (!b.reason || b.reason.trim().length < 5) {
          return json({ error: "Explain what the client needs to fix (min 5 characters)." }, 400);
        }
        await admin
          .from("organisation_onboarding")
          .update({
            status: "returned",
            returned_reason: b.reason,
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
          })
          .eq("id", onb.id);
        await logEvent(orgId, "onboarding_returned", b.reason);
        return json({ success: true });
      }

      // Approve: mandatory requirements must all be approved.
      const { data: reqs } = await admin
        .from("pathway_requirements")
        .select("requirement_key")
        .eq("pathway_id", onb.pathway_id)
        .eq("is_mandatory", true)
        .eq("is_active", true);
      const { data: findings } = await admin
        .from("onboarding_review_findings")
        .select("requirement_key, decision")
        .eq("onboarding_id", onb.id);
      const approved = new Set((findings ?? []).filter((f) => f.decision === "approved").map((f) => f.requirement_key));
      const outstanding = (reqs ?? []).map((r) => r.requirement_key).filter((k) => !approved.has(k));
      if (outstanding.length > 0) {
        return json({ error: "Mandatory requirements still need review", outstanding }, 400);
      }

      await admin
        .from("organisation_onboarding")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          progress_pct: 100,
        })
        .eq("id", onb.id);
      await admin
        .from("organisations")
        .update({ account_status: "active", activated_at: new Date().toISOString() })
        .eq("id", orgId);
      await admin
        .from("organisation_module_entitlements")
        .update({ is_enabled: true, activated_at: new Date().toISOString() })
        .eq("organisation_id", orgId);
      await logEvent(orgId, "onboarding_approved", "Onboarding approved and modules activated");
      await admin.from("audit_logs").insert({
        user_id: user.id,
        organisation_id: orgId,
        action: "onboarding_approved",
        module: "platform",
        record_id: orgId,
        severity: "info",
        details: { activated: true },
      });
      return json({ success: true });
    }

    if (b.action === "start_support_session") {
      if (!b.reason || b.reason.trim().length < 10) {
        return json({ error: "A support reason of at least 10 characters is required." }, 400);
      }
      const expires = new Date(Date.now() + 2 * 3600000).toISOString();
      const { data, error } = await admin
        .from("platform_support_sessions")
        .insert({
          organisation_id: orgId,
          requested_by: user.id,
          reason: b.reason,
          scope: "read_only",
          expires_at: expires,
        })
        .select("id, expires_at")
        .single();
      if (error) return json({ error: error.message }, 400);
      await logEvent(orgId, "support_session_started", b.reason, { expires_at: expires });
      return json({ success: true, session: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
