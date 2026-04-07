import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, TrendingUp, Users, FileText, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";

function ComplianceGauge({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  const getColor = (s: number) => s >= 80 ? "text-success" : s >= 60 ? "text-warning" : "text-destructive";
  const getProgressClass = (s: number) => s >= 80 ? "[&>div]:bg-success" : s >= 60 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${getColor(score)}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${getColor(score)}`}>{score}%</div>
        <Progress value={score} className={`mt-2 h-2 ${getProgressClass(score)}`} />
      </CardContent>
    </Card>
  );
}

const getSeverityVariant = (severity: string) => {
  switch (severity) {
    case "high": case "critical": return "destructive" as const;
    case "medium": return "outline" as const;
    default: return "secondary" as const;
  }
};

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: incidentCount = 0 } = useQuery({
    queryKey: ["dashboard-incidents"],
    queryFn: async () => {
      const { count } = await supabase.from("incidents").select("*", { count: "exact", head: true }).neq("status", "closed");
      return count ?? 0;
    },
  });

  const { data: participantCount = 0 } = useQuery({
    queryKey: ["dashboard-participants"],
    queryFn: async () => {
      const { count } = await supabase.from("participants").select("*", { count: "exact", head: true }).eq("status", "active");
      return count ?? 0;
    },
  });

  const { data: policiesDue = 0 } = useQuery({
    queryKey: ["dashboard-policies-due"],
    queryFn: async () => {
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      const { count } = await supabase.from("policies").select("*", { count: "exact", head: true }).lte("next_review_date", thirtyDays.toISOString().split("T")[0]).neq("status", "archived");
      return count ?? 0;
    },
  });

  const { data: staffCompliance = 0 } = useQuery({
    queryKey: ["dashboard-staff-compliance"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_compliance").select("overall_compliance_pct");
      if (!data || data.length === 0) return 0;
      return Math.round(data.reduce((sum, s) => sum + (s.overall_compliance_pct ?? 0), 0) / data.length);
    },
  });

  // Compute real pulse scores
  const { data: pulseScores } = useQuery({
    queryKey: ["dashboard-pulse"],
    queryFn: async () => {
      const [policies, staff, incidents, complaints, safeguarding, privacy, ai] = await Promise.all([
        supabase.from("policies").select("next_review_date, status").eq("record_status", "active"),
        supabase.from("staff_compliance").select("police_check_status, wwcc_status"),
        supabase.from("incidents").select("status, created_at").eq("record_status", "active"),
        supabase.from("complaints").select("status, acknowledgement_date").eq("record_status", "active"),
        supabase.from("safeguarding_concerns").select("status, immediate_safety_risk").eq("record_status", "active"),
        supabase.from("privacy_incidents").select("status").eq("record_status", "active"),
        supabase.from("ai_activity_logs").select("reviewed_at").limit(100),
      ]);

      let gov = 100;
      const overdueP = (policies.data ?? []).filter(p => p.next_review_date && differenceInDays(new Date(p.next_review_date), new Date()) < 0).length;
      gov -= Math.min(overdueP * 10, 30);
      const staffData = staff.data ?? [];
      if (staffData.length > 0) {
        const nonC = staffData.filter(s => s.police_check_status !== "current" || s.wwcc_status !== "current").length;
        gov -= Math.min((nonC / staffData.length) * 40, 30);
      }

      let sup = 100;
      const staleI = (incidents.data ?? []).filter(i => !["closed", "actioned"].includes(i.status) && differenceInDays(new Date(), new Date(i.created_at)) > 5).length;
      sup -= Math.min(staleI * 8, 30);
      const unackedC = (complaints.data ?? []).filter(c => !c.acknowledgement_date && !["resolved", "closed"].includes(c.status)).length;
      sup -= Math.min(unackedC * 10, 30);

      let env = 100;
      const urgentS = (safeguarding.data ?? []).filter(s => s.immediate_safety_risk && !["resolved", "closed"].includes(s.status)).length;
      env -= Math.min(urgentS * 15, 40);
      const openP = (privacy.data ?? []).filter(p => !["closed", "actioned"].includes(p.status)).length;
      env -= Math.min(openP * 10, 25);

      const aiData = ai.data ?? [];
      const aiScore = aiData.length > 0 ? Math.round((aiData.filter(a => a.reviewed_at).length / aiData.length) * 100) : 100;

      return {
        governance: Math.max(0, Math.round(gov)),
        supports: Math.max(0, Math.round(sup)),
        environment: Math.max(0, Math.round(env)),
        ai: Math.max(0, aiScore),
      };
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6" role="region" aria-label="Compliance Dashboard">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Pulse Dashboard</h1>
        <p className="text-muted-foreground">Real-time audit readiness overview</p>
      </div>

      <section aria-label="Compliance scores">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ComplianceGauge label="Governance & Operations" score={pulseScores?.governance ?? 100} icon={ShieldAlert} />
          <ComplianceGauge label="Provision of Supports" score={pulseScores?.supports ?? 100} icon={Users} />
          <ComplianceGauge label="Support Environment" score={pulseScores?.environment ?? 100} icon={CheckCircle} />
          <ComplianceGauge label="AI Oversight" score={pulseScores?.ai ?? 100} icon={Activity} />
        </div>
      </section>

      <section aria-label="Key statistics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/incidents")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open Incidents</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{incidentCount}</div><p className="text-xs text-muted-foreground">Click to view</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/participants")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Active Participants</CardTitle><Users className="h-4 w-4 text-info" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{participantCount}</div></CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/policies")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Policies Due</CardTitle><FileText className="h-4 w-4 text-warning" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{policiesDue}</div><p className="text-xs text-muted-foreground">Review within 30 days</p></CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/staff")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Staff Compliance</CardTitle><TrendingUp className="h-4 w-4 text-success" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{staffCompliance}%</div></CardContent>
          </Card>
        </div>
      </section>

      <section aria-label="Recent alerts">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Recent Compliance Alerts</CardTitle></CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent alerts</p>
            ) : (
              <div className="space-y-3" role="list">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 rounded-lg border p-3" role="listitem">
                    <Badge variant={getSeverityVariant(alert.severity)} className="mt-0.5 shrink-0 capitalize">{alert.severity}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(alert.created_at), "PPp")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
