import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const results: string[] = [];
    const todayStr = now.toISOString().split("T")[0];

    // 1. Staff clearance expiry warnings (60 days)
    const sixtyDaysFromNow = new Date(now);
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
    const sixtyDaysStr = sixtyDaysFromNow.toISOString().split("T")[0];

    const { data: expiringStaff } = await supabase
      .from("staff_compliance")
      .select("id, user_id, police_check_expiry, wwcc_expiry, worker_screening_expiry")
      .or(`police_check_expiry.lte.${sixtyDaysStr},wwcc_expiry.lte.${sixtyDaysStr},worker_screening_expiry.lte.${sixtyDaysStr}`);

    for (const staff of expiringStaff ?? []) {
      const expiringItems: string[] = [];
      if (staff.police_check_expiry && staff.police_check_expiry <= sixtyDaysStr) expiringItems.push("Police Check");
      if (staff.wwcc_expiry && staff.wwcc_expiry <= sixtyDaysStr) expiringItems.push("WWCC");
      if (staff.worker_screening_expiry && staff.worker_screening_expiry <= sixtyDaysStr) expiringItems.push("Worker Screening");

      if (expiringItems.length > 0) {
        await supabase.from("notifications").insert({
          user_id: staff.user_id,
          title: "Clearance Expiry Warning",
          message: `The following clearances are expiring soon: ${expiringItems.join(", ")}`,
          notification_type: "warning",
          link: "/staff",
        });
        results.push(`Expiry warning sent to user ${staff.user_id}`);
      }
    }

    // 2. Auto-suspend expired staff
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
        message: `Staff member has been automatically blocked from participant assignment due to expired clearance.`,
        alert_type: "staff_expired",
        severity: "high",
        assigned_to: staff.user_id,
        source_module: "staff_compliance",
        source_record_id: staff.id,
      });
      results.push(`Auto-suspended staff ${staff.user_id}`);
    }

    // 3. Stale incidents (open > 5 days)
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const { data: staleIncidents } = await supabase
      .from("incidents")
      .select("id, incident_number, assigned_to, reported_by, organisation_id")
      .in("status", ["reported", "review", "investigating", "submitted", "supervisor_review", "compliance_review"])
      .lt("created_at", fiveDaysAgo.toISOString());

    for (const inc of staleIncidents ?? []) {
      const notifyUser = inc.assigned_to || inc.reported_by;
      await supabase.from("alerts").insert({
        title: `Stale incident: ${inc.incident_number}`,
        message: "This incident has been open for more than 5 days without resolution.",
        alert_type: "stale_incident",
        severity: "high",
        assigned_to: notifyUser,
        source_module: "incidents",
        source_record_id: inc.id,
        organisation_id: inc.organisation_id,
      });
      results.push(`Stale alert for incident ${inc.incident_number}`);
    }

    // 4. Complaint acknowledgement overdue (2 days)
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: unackedComplaints } = await supabase
      .from("complaints")
      .select("id, complaint_number, assigned_to, submitted_by, organisation_id")
      .is("acknowledgement_date", null)
      .in("status", ["submitted", "under_review"])
      .lt("created_at", twoDaysAgo.toISOString());

    for (const comp of unackedComplaints ?? []) {
      const notifyUser = comp.assigned_to || comp.submitted_by;
      if (notifyUser) {
        await supabase.from("notifications").insert({
          user_id: notifyUser,
          title: `Complaint ${comp.complaint_number} needs acknowledgement`,
          message: "This complaint has not been acknowledged within 2 business days.",
          notification_type: "warning",
          link: "/complaints",
        });
      }
      results.push(`Ack reminder for complaint ${comp.complaint_number}`);
    }

    // 5. Policy review overdue
    const { data: overduePolicies } = await supabase
      .from("policies")
      .select("id, title, owner_id, organisation_id")
      .lt("next_review_date", todayStr)
      .neq("status", "archived")
      .eq("record_status", "active");

    for (const pol of overduePolicies ?? []) {
      if (pol.owner_id) {
        await supabase.from("notifications").insert({
          user_id: pol.owner_id,
          title: `Policy review overdue: ${pol.title}`,
          message: "This policy has passed its scheduled review date.",
          notification_type: "warning",
          link: "/policies",
        });
      }
      await supabase.from("alerts").insert({
        title: `Policy review overdue: ${pol.title}`,
        alert_type: "policy_overdue",
        severity: "medium",
        source_module: "policies",
        source_record_id: pol.id,
        organisation_id: pol.organisation_id,
      });
      results.push(`Overdue alert for policy ${pol.title}`);
    }

    // 6. Safeguarding urgent response check (24 hours)
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: urgentSafeguarding } = await supabase
      .from("safeguarding_concerns")
      .select("id, participant_id, raised_by, organisation_id")
      .eq("immediate_safety_risk", true)
      .eq("status", "raised")
      .lt("created_at", oneDayAgo.toISOString());

    for (const sg of urgentSafeguarding ?? []) {
      await supabase.from("alerts").insert({
        title: "Urgent safeguarding concern unactioned for 24+ hours",
        message: "An immediate safety risk concern has not been actioned within 24 hours.",
        alert_type: "safeguarding_urgent",
        severity: "high",
        assigned_to: sg.raised_by,
        source_module: "safeguarding_concerns",
        source_record_id: sg.id,
        organisation_id: sg.organisation_id,
      });
      results.push(`Urgent safeguarding alert for concern ${sg.id}`);
    }

    // 7. Risk review overdue
    const { data: overdueRisks } = await supabase
      .from("risks")
      .select("id, title, assigned_to, created_by, organisation_id")
      .lt("review_date", todayStr)
      .not("status", "eq", "closed")
      .eq("record_status", "active");

    for (const risk of overdueRisks ?? []) {
      const notifyUser = risk.assigned_to || risk.created_by;
      await supabase.from("alerts").insert({
        title: `Risk review overdue: ${risk.title}`,
        message: "This risk has passed its scheduled review date.",
        alert_type: "risk_review_overdue",
        severity: "medium",
        assigned_to: notifyUser,
        source_module: "risks",
        source_record_id: risk.id,
        organisation_id: risk.organisation_id,
      });
      results.push(`Review overdue alert for risk ${risk.title}`);
    }

    // 8. Repeat complaint detection (3+ for same participant)
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
          await supabase.from("alerts").insert({
            title: `Repeat complaint trend detected`,
            message: `Participant has ${info.count} complaints on record — review recommended.`,
            alert_type: "repeat_complaint",
            severity: "medium",
            source_module: "complaints",
            source_record_id: pid,
            organisation_id: info.org,
          });
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
