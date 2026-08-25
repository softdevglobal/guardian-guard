import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, Users, UserCog, FileText, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { GettingStarted } from "@/components/GettingStarted";
import { formatScore, scoreExplanation, useOrgSnapshot, type ScoreBlock } from "@/lib/orgSnapshot";

function ScoreCard({
  label,
  block,
  subject,
  icon: Icon,
  calculatedAt,
  loading,
  onClick,
}: {
  label: string;
  block: ScoreBlock | undefined;
  subject: string;
  icon: React.ElementType;
  calculatedAt?: string;
  loading: boolean;
  onClick?: () => void;
}) {
  const pct = block?.percentage ?? null;
  const tone = pct === null ? "text-muted-foreground" : pct >= 80 ? "text-success" : pct >= 60 ? "text-warning" : "text-destructive";
  const bar = pct === null ? "" : pct >= 80 ? "[&>div]:bg-success" : pct >= 60 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive";

  return (
    <Card className={onClick ? "cursor-pointer hover:bg-muted/50" : undefined} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className={`text-2xl font-bold ${tone}`}>{formatScore(block)}</div>
            {pct !== null && <Progress value={pct} className={`h-2 ${bar}`} />}
            <p className="text-xs text-muted-foreground">{scoreExplanation(block, subject)}</p>
            {calculatedAt && (
              <p className="text-[11px] text-muted-foreground">Last calculated {format(new Date(calculatedAt), "PPp")}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CountCard({
  label,
  value,
  caption,
  icon: Icon,
  loading,
  onClick,
  tone,
}: {
  label: string;
  value: number | string;
  caption?: string;
  icon: React.ElementType;
  loading: boolean;
  onClick?: () => void;
  tone?: string;
}) {
  return (
    <Card className="cursor-pointer hover:bg-muted/50" onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${tone ?? "text-muted-foreground"}`} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{value}</div>}
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
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
  const { data: snapshot, isLoading } = useOrgSnapshot();

  const { data: alerts = [] } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const counts = snapshot?.counts;
  const evidence = snapshot?.evidence;

  return (
    <div className="space-y-6" role="region" aria-label="Compliance Dashboard">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Pulse Dashboard</h1>
        <p className="text-muted-foreground">
          Audit readiness overview for your organisation. Scores record evidence status — they do not certify compliance.
        </p>
      </div>

      <GettingStarted />

      <section aria-label="Compliance scores">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreCard label="Governance & Operations" block={snapshot?.scores.governance} subject="governance records" icon={ShieldAlert} calculatedAt={snapshot?.calculated_at} loading={isLoading} onClick={() => navigate("/governance")} />
          <ScoreCard label="Worker Compliance" block={snapshot?.scores.worker_compliance} subject="worker requirements" icon={UserCog} calculatedAt={snapshot?.calculated_at} loading={isLoading} onClick={() => navigate("/staff")} />
          <ScoreCard label="Provision of Supports" block={snapshot?.scores.supports} subject="incident and complaint records" icon={Users} calculatedAt={snapshot?.calculated_at} loading={isLoading} onClick={() => navigate("/participants")} />
          <ScoreCard label="Support Environment" block={snapshot?.scores.environment} subject="risk records" icon={CheckCircle} calculatedAt={snapshot?.calculated_at} loading={isLoading} onClick={() => navigate("/safe-environment")} />
        </div>
      </section>

      <section aria-label="Key statistics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CountCard label="Open Incidents" value={counts?.incidents_open ?? 0} caption={`${counts?.incidents_total ?? 0} in the register`} icon={AlertTriangle} tone="text-destructive" loading={isLoading} onClick={() => navigate("/incidents")} />
          <CountCard label="Open Complaints" value={counts?.complaints_open ?? 0} caption={`${counts?.complaints_total ?? 0} in the register`} icon={Users} tone="text-warning" loading={isLoading} onClick={() => navigate("/complaints")} />
          <CountCard label="Open Risks" value={counts?.risks_open ?? 0} caption={`${counts?.risks_total ?? 0} in the register`} icon={ShieldAlert} tone="text-warning" loading={isLoading} onClick={() => navigate("/risks")} />
          <CountCard label="Corrective Actions" value={counts?.corrective_actions_open ?? 0} caption="Open or in progress" icon={CheckCircle} tone="text-destructive" loading={isLoading} onClick={() => navigate("/corrective-actions")} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CountCard label="Policies Due" value={counts?.policies_due ?? 0} caption="Review within 30 days" icon={FileText} tone="text-warning" loading={isLoading} onClick={() => navigate("/policies")} />
          <CountCard label="Participants" value={counts?.participants ?? 0} caption="Compliance records held" icon={Users} tone="text-info" loading={isLoading} onClick={() => navigate("/participants")} />
          <CountCard label="Workers" value={counts?.staff ?? 0} caption="In your organisation" icon={UserCog} tone="text-info" loading={isLoading} onClick={() => navigate("/staff")} />
          <CountCard label="Upcoming Deadlines" value={evidence?.review_overdue ?? 0} caption="Evidence reviews overdue" icon={Clock} tone="text-destructive" loading={isLoading} onClick={() => navigate("/calendar")} />
        </div>
      </section>


      <section aria-label="Audit readiness">
        <ScoreCard
          label="Audit readiness"
          block={snapshot?.scores.audit_readiness}
          subject="evidence requirements"
          icon={ShieldCheck}
          calculatedAt={snapshot?.calculated_at}
          loading={isLoading}
          onClick={() => navigate("/evidence-matrix")}
        />
        {!isLoading && (evidence?.total_applicable ?? 0) === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            No evidence requirements are in scope yet. Confirm your registration groups to generate them — until then readiness is not assessable.
          </p>
        )}
      </section>

      <section aria-label="Recent alerts">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" aria-hidden="true" />Recent Compliance Alerts</CardTitle></CardHeader>
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
