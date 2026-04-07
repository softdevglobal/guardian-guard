import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, AlertTriangle, Brain, Heart, ShieldAlert, CheckCircle, Users, TrendingUp } from "lucide-react";
import { format, differenceInDays } from "date-fns";

function PulseGauge({ label, score, icon: Icon, details }: { label: string; score: number; icon: React.ElementType; details?: string }) {
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
        {details && <p className="text-xs text-muted-foreground mt-1">{details}</p>}
      </CardContent>
    </Card>
  );
}

export default function Heartbeat() {
  // Governance: policy review currency + worker screening + audit completeness
  const { data: policyStats } = useQuery({
    queryKey: ["pulse-policies"],
    queryFn: async () => {
      const { data } = await supabase.from("policies").select("next_review_date, status, record_status").eq("record_status", "active");
      if (!data) return { total: 0, overdue: 0, published: 0 };
      const overdue = data.filter(p => p.next_review_date && differenceInDays(new Date(p.next_review_date), new Date()) < 0).length;
      const published = data.filter(p => p.status === "published").length;
      return { total: data.length, overdue, published };
    },
  });

  const { data: staffStats } = useQuery({
    queryKey: ["pulse-staff"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_compliance").select("police_check_status, wwcc_status, worker_screening_status, eligible_for_assignment, overall_compliance_pct");
      if (!data) return { total: 0, compliant: 0, avgPct: 0 };
      const compliant = data.filter(s => s.police_check_status === "current" && s.wwcc_status === "current").length;
      const avgPct = data.length > 0 ? Math.round(data.reduce((s, r) => s + (r.overall_compliance_pct ?? 0), 0) / data.length) : 0;
      return { total: data.length, compliant, avgPct };
    },
  });

  // Provision of Supports: complaint response + incident response
  const { data: incidentStats } = useQuery({
    queryKey: ["pulse-incidents"],
    queryFn: async () => {
      const { data } = await supabase.from("incidents").select("status, created_at, severity").eq("record_status", "active");
      if (!data) return { open: 0, stale: 0, total: 0 };
      const open = data.filter(i => !["closed", "actioned"].includes(i.status)).length;
      const stale = data.filter(i => {
        if (["closed", "actioned"].includes(i.status)) return false;
        return differenceInDays(new Date(), new Date(i.created_at)) > 5;
      }).length;
      return { open, stale, total: data.length };
    },
  });

  const { data: complaintStats } = useQuery({
    queryKey: ["pulse-complaints"],
    queryFn: async () => {
      const { data } = await supabase.from("complaints").select("status, acknowledgement_date, created_at").eq("record_status", "active");
      if (!data) return { open: 0, unacked: 0 };
      const open = data.filter(c => !["resolved", "closed"].includes(c.status)).length;
      const unacked = data.filter(c => !c.acknowledgement_date && !["resolved", "closed"].includes(c.status)).length;
      return { open, unacked };
    },
  });

  // Support Environment: safeguarding response + privacy
  const { data: safeguardingStats } = useQuery({
    queryKey: ["pulse-safeguarding"],
    queryFn: async () => {
      const { data } = await supabase.from("safeguarding_concerns").select("status, immediate_safety_risk").eq("record_status", "active");
      if (!data) return { active: 0, urgent: 0 };
      const active = data.filter(s => !["resolved", "closed"].includes(s.status)).length;
      const urgent = data.filter(s => s.immediate_safety_risk && !["resolved", "closed"].includes(s.status)).length;
      return { active, urgent };
    },
  });

  const { data: privacyStats } = useQuery({
    queryKey: ["pulse-privacy"],
    queryFn: async () => {
      const { data } = await supabase.from("privacy_incidents").select("status").eq("record_status", "active");
      if (!data) return { open: 0 };
      return { open: data.filter(p => !["closed", "actioned"].includes(p.status)).length };
    },
  });

  // AI Oversight
  const { data: aiStats } = useQuery({
    queryKey: ["pulse-ai"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_activity_logs").select("reviewed_at, confidence_score").order("created_at", { ascending: false }).limit(100);
      if (!data) return { total: 0, reviewed: 0, avgConfidence: 0 };
      const reviewed = data.filter(a => a.reviewed_at).length;
      const avgConfidence = data.length > 0 ? Math.round(data.reduce((s, a) => s + (Number(a.confidence_score) || 0), 0) / data.length) : 0;
      return { total: data.length, reviewed, avgConfidence };
    },
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ["participant-risk-scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("participant_risk_scores").select("*, participants(first_name, last_name)").order("score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: aiLogs = [] } = useQuery({
    queryKey: ["ai-activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_activity_logs").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Calculate pulse scores
  const governanceScore = (() => {
    let score = 100;
    if (policyStats?.overdue) score -= Math.min(policyStats.overdue * 10, 30);
    if (staffStats?.total && staffStats.total > 0) {
      const nonCompliantPct = ((staffStats.total - staffStats.compliant) / staffStats.total) * 100;
      score -= Math.min(nonCompliantPct * 0.4, 30);
    }
    return Math.max(0, Math.round(score));
  })();

  const supportsScore = (() => {
    let score = 100;
    if (incidentStats?.stale) score -= Math.min(incidentStats.stale * 8, 30);
    if (complaintStats?.unacked) score -= Math.min(complaintStats.unacked * 10, 30);
    if (incidentStats?.open) score -= Math.min(incidentStats.open * 3, 20);
    return Math.max(0, Math.round(score));
  })();

  const environmentScore = (() => {
    let score = 100;
    if (safeguardingStats?.urgent) score -= Math.min(safeguardingStats.urgent * 15, 40);
    if (safeguardingStats?.active) score -= Math.min(safeguardingStats.active * 5, 20);
    if (privacyStats?.open) score -= Math.min(privacyStats.open * 10, 25);
    return Math.max(0, Math.round(score));
  })();

  const aiOversightScore = (() => {
    if (!aiStats?.total) return 100;
    const reviewRate = aiStats.total > 0 ? (aiStats.reviewed / aiStats.total) * 100 : 100;
    return Math.max(0, Math.round(reviewRate));
  })();

  const overallScore = Math.round((governanceScore + supportsScore + environmentScore + aiOversightScore) / 4);
  const highRisk = riskScores.filter(r => r.score >= 70).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />Compliance Pulse Engine
        </h1>
        <p className="text-muted-foreground">Real-time audit readiness scoring and participant monitoring</p>
      </div>

      {/* Overall Pulse */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overall Compliance Pulse</p>
              <p className={`text-4xl font-bold ${overallScore >= 80 ? "text-success" : overallScore >= 60 ? "text-warning" : "text-destructive"}`}>{overallScore}%</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-xs text-muted-foreground">{incidentStats?.open ?? 0} open incidents</p>
              <p className="text-xs text-muted-foreground">{complaintStats?.open ?? 0} open complaints</p>
              <p className="text-xs text-muted-foreground">{policyStats?.overdue ?? 0} overdue policies</p>
              <p className="text-xs text-muted-foreground">{safeguardingStats?.active ?? 0} active safeguarding</p>
            </div>
          </div>
          <Progress value={overallScore} className={`mt-3 h-3 ${overallScore >= 80 ? "[&>div]:bg-success" : overallScore >= 60 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive"}`} />
        </CardContent>
      </Card>

      {/* Four Category Scores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PulseGauge label="Governance & Operations" score={governanceScore} icon={ShieldAlert} details={`${policyStats?.overdue ?? 0} overdue reviews, ${staffStats?.compliant ?? 0}/${staffStats?.total ?? 0} staff compliant`} />
        <PulseGauge label="Provision of Supports" score={supportsScore} icon={Users} details={`${incidentStats?.stale ?? 0} stale incidents, ${complaintStats?.unacked ?? 0} unacked complaints`} />
        <PulseGauge label="Support Environment" score={environmentScore} icon={CheckCircle} details={`${safeguardingStats?.urgent ?? 0} urgent safeguarding, ${privacyStats?.open ?? 0} open privacy`} />
        <PulseGauge label="AI Oversight" score={aiOversightScore} icon={Brain} details={`${aiStats?.reviewed ?? 0}/${aiStats?.total ?? 0} reviewed, ${aiStats?.avgConfidence ?? 0}% avg confidence`} />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Active Monitors</CardTitle><Heart className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">{riskScores.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">AI Interventions</CardTitle><Brain className="h-4 w-4 text-info" /></CardHeader><CardContent><div className="text-2xl font-bold">{aiLogs.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">High Risk Participants</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{highRisk}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Staff Avg Compliance</CardTitle><TrendingUp className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold">{staffStats?.avgPct ?? 0}%</div></CardContent></Card>
      </div>

      {/* AI Activity Log */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />AI Activity Log</CardTitle></CardHeader>
        <CardContent>
          {aiLogs.length === 0 ? <p className="text-center py-4 text-muted-foreground">No AI activity recorded yet</p> : (
            <div className="space-y-3" role="list">
              {aiLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg border p-3" role="listitem">
                  <Badge variant="outline" className="mt-0.5 shrink-0">{log.confidence_score ? `${log.confidence_score}%` : "—"}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.action_taken}</p>
                    <p className="text-xs text-muted-foreground">{log.trigger_reason}</p>
                    {log.reviewed_at && <p className="text-xs text-success mt-1">Reviewed {format(new Date(log.reviewed_at), "PPp")}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Participant Risk Scores */}
      <Card>
        <CardHeader><CardTitle>Participant Risk Scores</CardTitle></CardHeader>
        <CardContent>
          {riskScores.length === 0 ? <p className="text-center py-4 text-muted-foreground">No risk scores calculated yet</p> : (
            <div className="space-y-4">
              {riskScores.map(p => (
                <div key={p.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <div className="w-24 shrink-0">
                    <p className="font-medium text-sm">{(p.participants as any)?.first_name ?? "Unknown"} {((p.participants as any)?.last_name ?? "").charAt(0)}.</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-lg font-bold ${p.score >= 70 ? "text-destructive" : p.score >= 40 ? "text-warning" : "text-success"}`}>{p.score}</span>
                      <span className="text-xs text-muted-foreground">/ 100</span>
                      <Badge variant="secondary" className="text-xs capitalize">{p.trend ?? "stable"}</Badge>
                    </div>
                    <Progress value={p.score} className={`h-2 ${p.score >= 70 ? "[&>div]:bg-destructive" : p.score >= 40 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
