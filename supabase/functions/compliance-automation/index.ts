import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationPayload {
  user_id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "urgent" | "critical";
  notification_type: string;
  source_table: string;
  source_record_id?: string;
  link: string;
  organisation_id?: string;
}

async function createNotification(supabase: ReturnType<typeof createClient>, payload: NotificationPayload) {
  await supabase.from("notifications").insert({
    user_id: payload.user_id,
    title: payload.title,
    message: payload.message,
    severity: payload.severity,
    notification_type: payload.notification_type,
    source_table: payload.source_table,
    source_record_id: payload.source_record_id,
    link: payload.link,
    organisation_id: payload.organisation_id,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const results: string[] = [];
    const todayStr = now.toISOString().split("T")[0];

    // ── 1. Staff clearance expiry warnings (60 days) ──
    const sixtyDaysFromNow = new Date(now);
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
    const sixtyDaysStr = sixtyDaysFromNow.toISOString().split("T")[0];

    const { data: expiringStaff } = await supabase
      .from("staff_compliance")
      .select("id, user_id, police_check_expiry, wwcc_expiry, worker_screening_expiry")
      .or(`police_check_expiry.lte.${sixtyDaysStr},wwcc_expiry.lte.${sixtyDaysStr},worker_screening_expiry.lte.${sixtyDaysStr}`);

    for (const staff of expiringStaff ?? []) {
      const items: string[] = [];
      if (staff.police_check_expiry && staff.police_check_expiry <= sixtyDaysStr) items.push("Police Check");
      if (staff.wwcc_expiry && staff.wwcc_expiry <= sixtyDaysStr) items.push("WWCC");
      if (staff.worker_screening_expiry && staff.worker_screening_expiry <= sixtyDaysStr) items.push("Worker Screening");

      if (items.length > 0) {
        const isExpired = items.some(i => {
          if (i === "Police Check" && staff.police_check_expiry && staff.police_check_expiry < todayStr) return true;
          if (i === "WWCC" && staff.wwcc_expiry && staff.wwcc_expiry < todayStr) return true;
          if (i === "Worker Screening" && staff.worker_screening_expiry && staff.worker_screening_expiry < todayStr) return true;
          return false;
        });

        // Notify the staff member
        await createNotification(supabase, {
          user_id: staff.user_id,
          title: isExpired ? "Clearance EXPIRED" : "Clearance Expiry Warning",
          message: `${isExpired ? "EXPIRED" : "Expiring soon"}: ${items.join(", ")}. ${isExpired ? "You have been blocked from participant assignment." : "Please renew before expiry."}`,
          severity: isExpired ? "critical" : "warning",
          notification_type: isExpired ? "critical" : "warning",
          source_table: "staff_compliance",
          source_record_id: staff.id,
          link: "/staff",
        });

        // Notify HR and supervisors for expired
        if (isExpired) {
          const { data: profile } = await supabase.from("user_profiles").select("organisation_id, team_id").eq("id", staff.user_id).maybeSingle();
          if (profile?.organisation_id) {
            const { data: hrUsers } = await supabase
              .from("user_roles")
              .select("user_id")
              .in("role", ["hr_admin", "super_admin"]);
            for (const hr of hrUsers ?? []) {
              const { data: hrProfile } = await supabase.from("user_profiles").select("organisation_id").eq("id", hr.user_id).maybeSingle();
              if (hrProfile?.organisation_id === profile.organisation_id) {
                await createNotification(supabase, {
                  user_id: hr.user_id,
                  title: "Staff clearance expired — assignment blocked",
                  message: `A staff member's clearance has expired: ${items.join(", ")}. They have been automatically blocked from assignment.`,
                  severity: "critical",
                  notification_type: "critical",
                  source_table: "staff_compliance",
                  source_record_id: staff.id,
                  link: "/staff",
                  organisation_id: profile.organisation_id,
                });
              }
            }
          }
        }
        results.push(`${isExpired ? "Expired" : "Expiry warning"} notification for user ${staff.user_id}`);
      }
    }

    // ── 2. Auto-suspend expired staff ──
    const { data: expiredStaff } = await supabase
      .from("staff_compliance")
      .select("id, user_id")
      .or(`police_check_expiry.lt.${todayStr},wwcc_expiry.lt.${todayStr},worker_screening_expiry.lt.${todayStr}`)
      .eq("eligible_for_assignment", true);

    for (const staff of expiredStaff ?? []) {
      await supabase.from("staff_compliance").update({
        eligible_for_assignment: false,
        police_check_status: "expired",
      }).eq("id", staff.id);

      await supabase.from("alerts").insert({
        title: "Staff clearance expired - assignment blocked",
        message: "Staff member has been automatically blocked from participant assignment due to expired clearance.",
        alert_type: "staff_expired",
        severity: "high",
        assigned_to: staff.user_id,
        source_module: "staff_compliance",
        source_record_id: staff.id,
      });
      results.push(`Auto-suspended staff ${staff.user_id}`);
    }

    // ── 3. Stale incidents (open > 5 days) ──
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const { data: staleIncidents } = await supabase
      .from("incidents")
      .select("id, incident_number, assigned_to, reported_by, organisation_id, team_id")
      .in("status", ["reported", "review", "investigating", "submitted", "supervisor_review", "compliance_review"])
      .lt("created_at", fiveDaysAgo.toISOString());

    for (const inc of staleIncidents ?? []) {
      const notifyUsers = new Set<string>();
      if (inc.assigned_to) notifyUsers.add(inc.assigned_to);
      if (inc.reported_by) notifyUsers.add(inc.reported_by);

      // Also notify compliance officers in the org
      const { data: complianceUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["compliance_officer", "super_admin"]);
      for (const cu of complianceUsers ?? []) {
        const { data: p } = await supabase.from("user_profiles").select("organisation_id").eq("id", cu.user_id).maybeSingle();
        if (p?.organisation_id === inc.organisation_id) notifyUsers.add(cu.user_id);
      }

      for (const uid of notifyUsers) {
        await createNotification(supabase, {
          user_id: uid,
          title: `Stale incident: ${inc.incident_number}`,
          message: "This incident has been open for more than 5 days without resolution. Immediate action required.",
          severity: "urgent",
          notification_type: "warning",
          source_table: "incidents",
          source_record_id: inc.id,
          link: "/incidents",
          organisation_id: inc.organisation_id,
        });
      }
      results.push(`Stale alert for incident ${inc.incident_number}`);
    }

    // ── 4. Complaint acknowledgement overdue (2 days) ──
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: unackedComplaints } = await supabase
      .from("complaints")
      .select("id, complaint_number, assigned_to, submitted_by, organisation_id")
      .is("acknowledgement_date", null)
      .in("status", ["submitted", "under_review"])
      .lt("created_at", twoDaysAgo.toISOString());

    for (const comp of unackedComplaints ?? []) {
      const notifyUsers = new Set<string>();
      if (comp.assigned_to) notifyUsers.add(comp.assigned_to);
      if (comp.submitted_by) notifyUsers.add(comp.submitted_by);

      for (const uid of notifyUsers) {
        await createNotification(supabase, {
          user_id: uid,
          title: `Complaint ${comp.complaint_number} needs acknowledgement`,
          message: "This complaint has not been acknowledged within 2 business days. NDIS requires timely acknowledgement.",
          severity: "urgent",
          notification_type: "warning",
          source_table: "complaints",
          source_record_id: comp.id,
          link: "/complaints",
          organisation_id: comp.organisation_id,
        });
      }
      results.push(`Ack reminder for complaint ${comp.complaint_number}`);
    }

    // ── 5. Policy review overdue ──
    const { data: overduePolicies } = await supabase
      .from("policies")
      .select("id, title, owner_id, organisation_id")
      .lt("next_review_date", todayStr)
      .neq("status", "archived")
      .eq("record_status", "active");

    for (const pol of overduePolicies ?? []) {
      if (pol.owner_id) {
        await createNotification(supabase, {
          user_id: pol.owner_id,
          title: `Policy review overdue: ${pol.title}`,
          message: "This policy has passed its scheduled review date and must be reviewed immediately.",
          severity: "warning",
          notification_type: "warning",
          source_table: "policies",
          source_record_id: pol.id,
          link: "/policies",
          organisation_id: pol.organisation_id,
        });
      }

      // Notify compliance
      const { data: compUsers } = await supabase.from("user_roles").select("user_id").in("role", ["compliance_officer", "super_admin"]);
      for (const cu of compUsers ?? []) {
        const { data: p } = await supabase.from("user_profiles").select("organisation_id").eq("id", cu.user_id).maybeSingle();
        if (p?.organisation_id === pol.organisation_id && cu.user_id !== pol.owner_id) {
          await createNotification(supabase, {
            user_id: cu.user_id,
            title: `Policy review overdue: ${pol.title}`,
            message: "A policy in your organisation has passed its review date.",
            severity: "warning",
            notification_type: "warning",
            source_table: "policies",
            source_record_id: pol.id,
            link: "/policies",
            organisation_id: pol.organisation_id,
          });
        }
      }
      results.push(`Overdue alert for policy ${pol.title}`);
    }

    // ── 6. Policy review due in 30 days ──
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split("T")[0];

    const { data: upcomingPolicies } = await supabase
      .from("policies")
      .select("id, title, owner_id, organisation_id")
      .gte("next_review_date", todayStr)
      .lte("next_review_date", thirtyDaysStr)
      .neq("status", "archived")
      .eq("record_status", "active");

    for (const pol of upcomingPolicies ?? []) {
      if (pol.owner_id) {
        await createNotification(supabase, {
          user_id: pol.owner_id,
          title: `Policy review due soon: ${pol.title}`,
          message: "This policy is due for review within the next 30 days.",
          severity: "info",
          notification_type: "info",
          source_table: "policies",
          source_record_id: pol.id,
          link: "/policies",
          organisation_id: pol.organisation_id,
        });
      }
      results.push(`Upcoming review for policy ${pol.title}`);
    }

    // ── 7. Safeguarding urgent response check (24 hours) ──
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: urgentSafeguarding } = await supabase
      .from("safeguarding_concerns")
      .select("id, participant_id, raised_by, organisation_id")
      .eq("immediate_safety_risk", true)
      .eq("status", "raised")
      .lt("created_at", oneDayAgo.toISOString());

    for (const sg of urgentSafeguarding ?? []) {
      // Notify raiser
      await createNotification(supabase, {
        user_id: sg.raised_by,
        title: "URGENT: Safeguarding concern unactioned 24+ hours",
        message: "An immediate safety risk concern has not been actioned within 24 hours. This requires immediate escalation.",
        severity: "critical",
        notification_type: "critical",
        source_table: "safeguarding_concerns",
        source_record_id: sg.id,
        link: "/safeguarding",
        organisation_id: sg.organisation_id,
      });

      // Notify compliance
      const { data: compUsers } = await supabase.from("user_roles").select("user_id").in("role", ["compliance_officer", "super_admin"]);
      for (const cu of compUsers ?? []) {
        const { data: p } = await supabase.from("user_profiles").select("organisation_id").eq("id", cu.user_id).maybeSingle();
        if (p?.organisation_id === sg.organisation_id) {
          await createNotification(supabase, {
            user_id: cu.user_id,
            title: "CRITICAL: Safeguarding concern unactioned 24+ hours",
            message: "An immediate safety risk concern has been open for more than 24 hours without action.",
            severity: "critical",
            notification_type: "critical",
            source_table: "safeguarding_concerns",
            source_record_id: sg.id,
            link: "/safeguarding",
            organisation_id: sg.organisation_id,
          });
        }
      }
      results.push(`Urgent safeguarding alert for concern ${sg.id}`);
    }

    // ── 8. Risk review overdue ──
    const { data: overdueRisks } = await supabase
      .from("risks")
      .select("id, title, assigned_to, created_by, organisation_id")
      .lt("review_date", todayStr)
      .not("status", "eq", "closed")
      .eq("record_status", "active");

    for (const risk of overdueRisks ?? []) {
      const notifyUser = risk.assigned_to || risk.created_by;
      await createNotification(supabase, {
        user_id: notifyUser,
        title: `Risk review overdue: ${risk.title}`,
        message: "This risk has passed its scheduled review date and requires immediate attention.",
        severity: "warning",
        notification_type: "warning",
        source_table: "risks",
        source_record_id: risk.id,
        link: "/risks",
        organisation_id: risk.organisation_id,
      });
      results.push(`Review overdue alert for risk ${risk.title}`);
    }

    // ── 9. High/critical risks ──
    const oneDayAgoStr = oneDayAgo.toISOString();
    const { data: highRisks } = await supabase
      .from("risks")
      .select("id, title, assigned_to, created_by, organisation_id, risk_level")
      .in("risk_level", ["High", "Critical"])
      .gte("created_at", oneDayAgoStr)
      .eq("record_status", "active");

    for (const risk of highRisks ?? []) {
      const { data: compUsers } = await supabase.from("user_roles").select("user_id").in("role", ["compliance_officer", "super_admin"]);
      for (const cu of compUsers ?? []) {
        const { data: p } = await supabase.from("user_profiles").select("organisation_id").eq("id", cu.user_id).maybeSingle();
        if (p?.organisation_id === risk.organisation_id) {
          await createNotification(supabase, {
            user_id: cu.user_id,
            title: `${risk.risk_level} risk created: ${risk.title}`,
            message: `A ${risk.risk_level?.toLowerCase()} risk has been identified and requires compliance review.`,
            severity: risk.risk_level === "Critical" ? "critical" : "urgent",
            notification_type: risk.risk_level === "Critical" ? "critical" : "warning",
            source_table: "risks",
            source_record_id: risk.id,
            link: "/risks",
            organisation_id: risk.organisation_id,
          });
        }
      }
      results.push(`High risk notification for ${risk.title}`);
    }

    // ── 10. Repeat complaint detection (3+ for same participant) ──
    const { data: complaintCounts } = await supabase
      .from("complaints")
      .select("participant_id, organisation_id")
      .not("participant_id", "is", null)
      .eq("record_status", "active");

    if (complaintCounts) {
      const countMap: Record<string, { count: number; org: string }> = {};
      for (const c of complaintCounts) {
        if (c.participant_id) {
          if (!countMap[c.participant_id]) countMap[c.participant_id] = { count: 0, org: c.organisation_id };
          countMap[c.participant_id].count++;
        }
      }
      for (const [pid, info] of Object.entries(countMap)) {
        if (info.count >= 3) {
          const { data: compUsers } = await supabase.from("user_roles").select("user_id").in("role", ["compliance_officer", "super_admin"]);
          for (const cu of compUsers ?? []) {
            const { data: p } = await supabase.from("user_profiles").select("organisation_id").eq("id", cu.user_id).maybeSingle();
            if (p?.organisation_id === info.org) {
              await createNotification(supabase, {
                user_id: cu.user_id,
                title: "Repeat complaint trend detected",
                message: `A participant has ${info.count} complaints on record — pattern review recommended.`,
                severity: "warning",
                notification_type: "warning",
                source_table: "complaints",
                source_record_id: pid,
                link: "/complaints",
                organisation_id: info.org,
              });
            }
          }
          results.push(`Repeat complaint alert for participant ${pid}`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, actions: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Automation trigger error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
