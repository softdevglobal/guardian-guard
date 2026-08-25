import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Brain } from "lucide-react";
import { format } from "date-fns";
import { formatScore, scoreExplanation, useOrgSnapshot, type ScoreBlock } from "@/lib/orgSnapshot";
import {
  COMPLIANCE_SCORE_CARDS, headlineCounts, isAssessable, overallScore, scoreBlock, scoreTone,
} from "@/lib/complianceScore";
import { LoadingState } from "@/components/compliance/GateUI";

const TONE_TEXT: Record<string, string> = {
  good: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
};

const TONE_BAR: Record<string, string> = {
  good: "[&>div]:bg-success",
  warn: "[&>div]:bg-warning",
  bad: "[&>div]:bg-destructive",
  neutral: "[&>div]:bg-muted",
};

function PulseGauge({ label, block, details }: { label: string; block: ScoreBlock | null; details: string }) {
  const tone = scoreTone(block);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${TONE_TEXT[tone]}`}>{formatScore(block)}</div>
        <Progress
          value={isAssessable(block) ? (block!.percentage as number) : 0}
          className={`mt-2 h-2 ${TONE_BAR[tone]}`}
          aria-label={`${label} ${formatScore(block)}`}
        />
        <p className="text-xs text-muted-foreground mt-1">{details}</p>
      </CardContent>
    </Card>
  );
}

export default function Heartbeat() {
  // One authoritative scoring service — identical figures to the Dashboard.
  const { data: snapshot, isLoading } = useOrgSnapshot();
  const overall = overallScore(snapshot);
  const counts = headlineCounts(snapshot);

  const { data: aiLogs = [] } = useQuery({
    queryKey: ["ai-activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-2"><LoadingState rows={6} /></div>;

  const overallTone = scoreTone(overall);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" aria-hidden="true" />Compliance Pulse
        </h1>
        <p className="text-muted-foreground">
          Audit-readiness and evidence status. Scores are only calculated where records exist —
          all findings require human review.
        </p>
      </div>

      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overall audit readiness</p>
              <p className={`text-4xl font-bold ${TONE_TEXT[overallTone]}`}>{formatScore(overall)}</p>
              {!isAssessable(overall) && (
                <p className="text-xs text-muted-foreground mt-1">
                  No assessable records or requirements yet.
                </p>
              )}
            </div>
            <div className="text-right space-y-1">
              {counts.map((c) => (
                <p key={c.key} className="text-xs text-muted-foreground">{c.value} {c.label.toLowerCase()}</p>
              ))}
            </div>
          </div>
          <Progress
            value={isAssessable(overall) ? (overall!.percentage as number) : 0}
            className={`mt-3 h-3 ${TONE_BAR[overallTone]}`}
            aria-label={`Overall audit readiness ${formatScore(overall)}`}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMPLIANCE_SCORE_CARDS.map((card) => {
          const block = scoreBlock(snapshot, card.key);
          return (
            <PulseGauge
              key={card.key}
              label={card.label}
              block={block}
              details={scoreExplanation(block, card.subject)}
            />
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {counts.slice(0, 3).map((c) => (
          <Card key={c.key}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{c.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" aria-hidden="true" />AI activity log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiLogs.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No AI activity recorded yet</p>
          ) : (
            <div className="space-y-3" role="list">
              {aiLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg border p-3" role="listitem">
                  <Badge variant="outline" className="mt-0.5 shrink-0">
                    {log.confidence_score ? `${log.confidence_score}%` : "—"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.action_taken}</p>
                    <p className="text-xs text-muted-foreground">{log.trigger_reason}</p>
                    {log.reviewed_at
                      ? <p className="text-xs text-success mt-1">Reviewed {format(new Date(log.reviewed_at), "PPp")}</p>
                      : <p className="text-xs text-warning mt-1">Requires human review</p>}
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
