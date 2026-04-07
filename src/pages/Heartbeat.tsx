import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, AlertTriangle, Brain, Heart, TrendingUp } from "lucide-react";

const heartbeatAlerts = [
  { id: 1, participant: "Alice M.", trigger: "Repeated distress keywords detected", confidence: 87, severity: "High", time: "12 min ago", status: "Draft Incident Created" },
  { id: 2, participant: "John D.", trigger: "Emotional escalation pattern in training chat", confidence: 72, severity: "Medium", time: "45 min ago", status: "Supervisor Notified" },
  { id: 3, participant: "Maria G.", trigger: "3 consecutive missed sessions", confidence: 95, severity: "Medium", time: "2 hrs ago", status: "Under Review" },
  { id: 4, participant: "Robert K.", trigger: "Positive engagement spike", confidence: 91, severity: "Low", time: "3 hrs ago", status: "Logged" },
];

const riskScores = [
  { participant: "Alice M.", score: 72, trend: "up", factors: ["Distress signals (3)", "Incident history (1)", "Missed sessions (0)"] },
  { participant: "Maria G.", score: 50, trend: "up", factors: ["Distress signals (0)", "Incident history (0)", "Missed sessions (3)"] },
  { participant: "John D.", score: 35, trend: "stable", factors: ["Distress signals (1)", "Incident history (0)", "Missed sessions (0)"] },
  { participant: "Robert K.", score: 15, trend: "down", factors: ["Distress signals (0)", "Incident history (0)", "Missed sessions (0)"] },
];

const severityColor = (s: string) => {
  if (s === "High") return "destructive" as const;
  if (s === "Medium") return "outline" as const;
  return "secondary" as const;
};

const getRiskColor = (score: number) => {
  if (score >= 70) return "text-destructive";
  if (score >= 40) return "text-warning";
  return "text-success";
};

export default function Heartbeat() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" aria-hidden="true" />
          Continuous Monitoring Engine
        </h1>
        <p className="text-muted-foreground">AI-powered real-time participant wellbeing monitoring</p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Monitors</CardTitle>
            <Heart className="h-4 w-4 text-success" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">24</div><p className="text-xs text-muted-foreground">All participants monitored</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">AI Triggers Today</CardTitle>
            <Brain className="h-4 w-4 text-info" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">4</div><p className="text-xs text-muted-foreground">2 high, 1 medium, 1 low</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">1</div><p className="text-xs text-muted-foreground">Risk score &gt; 70</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Risk Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">43</div><p className="text-xs text-muted-foreground">Within safe range</p></CardContent>
        </Card>
      </div>

      {/* AI Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" aria-hidden="true" />
            AI Monitoring Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3" role="list">
            {heartbeatAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 rounded-lg border p-3" role="listitem">
                <Badge variant={severityColor(alert.severity)} className="mt-0.5 shrink-0">{alert.severity}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.participant} — {alert.trigger}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">Confidence: {alert.confidence}%</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{alert.time}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <Badge variant="secondary" className="text-xs">{alert.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Scores */}
      <Card>
        <CardHeader><CardTitle>Participant Risk Scores</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {riskScores.map((p) => (
              <div key={p.participant} className="flex items-center gap-4 rounded-lg border p-3">
                <div className="w-24 shrink-0">
                  <p className="font-medium text-sm">{p.participant}</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-lg font-bold ${getRiskColor(p.score)}`}>{p.score}</span>
                    <span className="text-xs text-muted-foreground">/ 100</span>
                    <Badge variant="secondary" className="text-xs capitalize">{p.trend}</Badge>
                  </div>
                  <Progress value={p.score} className={`h-2 ${p.score >= 70 ? "[&>div]:bg-destructive" : p.score >= 40 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`} />
                  <div className="flex flex-wrap gap-2 mt-1">
                    {p.factors.map((f, i) => (
                      <span key={i} className="text-xs text-muted-foreground">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
