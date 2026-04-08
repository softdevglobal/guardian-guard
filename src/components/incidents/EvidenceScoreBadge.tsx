import { Badge } from "@/components/ui/badge";
import { SCORE_COLORS, type EvidenceScore } from "@/lib/evidenceScore";
import { ShieldCheck } from "lucide-react";

interface Props {
  score: EvidenceScore;
  compact?: boolean;
}

export function EvidenceScoreBadge({ score, compact }: Props) {
  const color = SCORE_COLORS[score.status];
  if (compact) {
    return (
      <Badge variant="outline" className={`${color} text-[10px] gap-1`}>
        <ShieldCheck className="h-3 w-3" />
        {score.score}%
      </Badge>
    );
  }
  return (
    <div className={`flex items-center gap-1.5 ${color}`}>
      <ShieldCheck className="h-4 w-4" />
      <span className="text-sm font-medium">Audit Readiness: {score.score}%</span>
      <Badge variant="outline" className={`${color} text-[10px] capitalize`}>{score.status.replace("-", " ")}</Badge>
    </div>
  );
}
