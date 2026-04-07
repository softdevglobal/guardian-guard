import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, AlertTriangle, Brain, Heart, TrendingUp } from "lucide-react";

const severityColor = (s: string) => {
  if (s === "high" || s === "critical") return "destructive" as const;
  if (s === "medium") return "outline" as const;
  return "secondary" as const;
};

const getRiskColor = (score: number) => {
  if (score >= 70) return "text-destructive";
  if (score >= 40) return "text-warning";
  return "text-success";
};

export default function Heartbeat() {
  const { data: aiLogs = [] } = useQuery({
    queryKey: ["ai-activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_activity_logs").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
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

  const highRisk = riskScores.filter(r => r.score >= 70).length;
  const avgScore = riskScores.length > 0 ? Math.round(riskScores.reduce((s, r) => s + r.score, 0) / riskScores.length) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />Continuous Monitoring Engine
        </h1>
        <p className="text-muted-foreground">AI-powered real-time participant wellbeing monitoring</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Active Monitors</CardTitle><Heart className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">{riskScores.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">AI Triggers Today</CardTitle><Brain className="h-4 w-4 text-info" /></CardHeader><CardContent><div className="text-2xl font-bold">{aiLogs.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">High Risk</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{highRisk}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Avg Risk Score</CardTitle><TrendingUp className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold">{avgScore}</div></CardContent></Card>
      </div>

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
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                      <span className={`text-lg font-bold ${getRiskColor(p.score)}`}>{p.score}</span>
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
