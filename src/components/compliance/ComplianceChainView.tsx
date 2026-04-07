import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Activity, AlertTriangle, FileText, GraduationCap, ArrowRight, ShieldAlert } from "lucide-react";

interface Props {
  participantId: string;
  participantName: string;
}

export function ComplianceChainView({ participantId, participantName }: Props) {
  const { data: counts } = useQuery({
    queryKey: ["compliance-chain-counts", participantId],
    queryFn: async () => {
      const [incidents, risks, complaints, safeguarding, training] = await Promise.all([
        supabase.from("incidents").select("id", { count: "exact", head: true }).eq("participant_id", participantId).eq("record_status", "active"),
        supabase.from("risks").select("id", { count: "exact", head: true }).eq("linked_participant_id", participantId).eq("record_status", "active"),
        supabase.from("complaints").select("id", { count: "exact", head: true }).eq("participant_id", participantId).eq("record_status", "active"),
        supabase.from("safeguarding_concerns").select("id", { count: "exact", head: true }).eq("participant_id", participantId).eq("record_status", "active"),
        supabase.from("incident_actions").select("id", { count: "exact", head: true })
          .in("incident_id", (await supabase.from("incidents").select("id").eq("participant_id", participantId)).data?.map(i => i.id) ?? []),
      ]);
      return {
        incidents: incidents.count ?? 0,
        risks: risks.count ?? 0,
        complaints: complaints.count ?? 0,
        safeguarding: safeguarding.count ?? 0,
        actions: training.count ?? 0,
      };
    },
  });

  if (!counts) return null;

  const nodes = [
    { icon: Users, label: "Participant", count: 1, color: "bg-primary/10 text-primary border-primary/30" },
    { icon: Activity, label: "Risks", count: counts.risks, color: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
    { icon: AlertTriangle, label: "Incidents", count: counts.incidents, color: "bg-destructive/10 text-destructive border-destructive/30" },
    { icon: ShieldAlert, label: "Safeguarding", count: counts.safeguarding, color: "bg-red-600/10 text-red-600 border-red-600/30" },
    { icon: FileText, label: "Complaints", count: counts.complaints, color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
    { icon: GraduationCap, label: "Actions", count: counts.actions, color: "bg-primary/10 text-primary border-primary/30" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Compliance Chain: {participantName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          {nodes.map((node, idx) => {
            const Icon = node.icon;
            return (
              <div key={node.label} className="flex items-center gap-1 shrink-0">
                <div className={`flex flex-col items-center gap-1 p-3 rounded-lg border ${node.color} min-w-[80px]`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{node.label}</span>
                  <Badge variant="secondary" className="text-xs">{node.count}</Badge>
                </div>
                {idx < nodes.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
