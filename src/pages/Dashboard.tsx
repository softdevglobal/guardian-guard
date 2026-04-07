import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, TrendingUp, Users, FileText, Activity } from "lucide-react";

function ComplianceGauge({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  const getColor = (s: number) => {
    if (s >= 80) return "text-success";
    if (s >= 60) return "text-warning";
    return "text-destructive";
  };
  const getProgressClass = (s: number) => {
    if (s >= 80) return "[&>div]:bg-success";
    if (s >= 60) return "[&>div]:bg-warning";
    return "[&>div]:bg-destructive";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${getColor(score)}`} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${getColor(score)}`} aria-label={`${label} score: ${score}%`}>
          {score}%
        </div>
        <Progress value={score} className={`mt-2 h-2 ${getProgressClass(score)}`} aria-hidden="true" />
      </CardContent>
    </Card>
  );
}

const recentAlerts = [
  { id: 1, type: "incident", message: "New incident reported - Participant distress during training session", severity: "high", time: "12 min ago" },
  { id: 2, type: "policy", message: "Privacy Policy due for annual review in 5 days", severity: "medium", time: "1 hr ago" },
  { id: 3, type: "staff", message: "Worker screening expiring for 2 staff members", severity: "high", time: "2 hrs ago" },
  { id: 4, type: "training", message: "3 staff members have overdue mandatory training", severity: "medium", time: "3 hrs ago" },
  { id: 5, type: "heartbeat", message: "AI detected potential distress markers in chat interaction", severity: "low", time: "4 hrs ago" },
];

const getSeverityVariant = (severity: string) => {
  switch (severity) {
    case "high": return "destructive" as const;
    case "medium": return "outline" as const;
    default: return "secondary" as const;
  }
};

export default function Dashboard() {
  return (
    <div className="space-y-6" role="region" aria-label="Compliance Dashboard">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Pulse Dashboard</h1>
        <p className="text-muted-foreground">Real-time audit readiness overview for DGTG PTY LTD</p>
      </div>

      {/* Compliance Gauges */}
      <section aria-label="Compliance scores">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ComplianceGauge label="Governance & Operations" score={87} icon={ShieldAlert} />
          <ComplianceGauge label="Provision of Supports" score={72} icon={Users} />
          <ComplianceGauge label="Support Environment" score={91} icon={CheckCircle} />
          <ComplianceGauge label="AI Oversight" score={95} icon={Activity} />
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Key statistics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">1 reportable, 2 under review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Participants</CardTitle>
              <Users className="h-4 w-4 text-info" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">18 in active training</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Policies Due</CardTitle>
              <FileText className="h-4 w-4 text-warning" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2</div>
              <p className="text-xs text-muted-foreground">Review within 30 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Staff Compliance</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">94%</div>
              <p className="text-xs text-muted-foreground">All clearances current</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Recent Alerts */}
      <section aria-label="Recent alerts">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" aria-hidden="true" />
              Recent Compliance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" role="list">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                  role="listitem"
                >
                  <Badge variant={getSeverityVariant(alert.severity)} className="mt-0.5 shrink-0 capitalize">
                    {alert.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
