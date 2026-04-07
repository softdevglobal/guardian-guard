import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import {
  AlertTriangle, ShieldAlert, FileText, GraduationCap,
  Users, Activity, Clock, ChevronRight
} from "lucide-react";

interface TimelineEvent {
  id: string;
  date: string;
  module: "incident" | "risk" | "complaint" | "safeguarding" | "training" | "audit";
  title: string;
  description?: string;
  severity?: string;
  status?: string;
  linkedEntities?: { type: string; label: string }[];
}

const MODULE_CONFIG = {
  incident: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", label: "Incident" },
  risk: { icon: Activity, color: "text-orange-500", bg: "bg-orange-500/10", label: "Risk" },
  complaint: { icon: FileText, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Complaint" },
  safeguarding: { icon: ShieldAlert, color: "text-red-600", bg: "bg-red-600/10", label: "Safeguarding" },
  training: { icon: GraduationCap, color: "text-primary", bg: "bg-primary/10", label: "Training" },
  audit: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "Audit" },
};

interface Props {
  participantId: string;
  participantName: string;
}

export function ParticipantTimeline({ participantId, participantName }: Props) {
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  const { data: incidents = [] } = useQuery({
    queryKey: ["timeline-incidents", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incidents")
        .select("id, incident_number, title, severity, status, created_at, date_of_incident, reported_by, incident_type")
        .eq("participant_id", participantId)
        .eq("record_status", "active")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: risks = [] } = useQuery({
    queryKey: ["timeline-risks", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("risks")
        .select("id, title, risk_level, status, created_at, date_identified, category")
        .eq("linked_participant_id", participantId)
        .eq("record_status", "active")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: complaints = [] } = useQuery({
    queryKey: ["timeline-complaints", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("complaints")
        .select("id, complaint_number, subject, status, priority, created_at")
        .eq("participant_id", participantId)
        .eq("record_status", "active")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: safeguarding = [] } = useQuery({
    queryKey: ["timeline-safeguarding", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("safeguarding_concerns")
        .select("id, concern_type, status, date_raised, immediate_safety_risk, escalation_level")
        .eq("participant_id", participantId)
        .eq("record_status", "active")
        .order("date_raised", { ascending: false });
      return data ?? [];
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["timeline-audit", participantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, module, created_at, user_name, severity")
        .eq("record_id", participantId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const timeline = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    incidents.forEach(i => events.push({
      id: i.id, date: i.date_of_incident ?? i.created_at, module: "incident",
      title: `${i.incident_number}: ${i.title}`,
      description: `Type: ${i.incident_type}`,
      severity: i.severity, status: i.status,
    }));

    risks.forEach(r => events.push({
      id: r.id, date: r.date_identified ?? r.created_at, module: "risk",
      title: r.title,
      description: `Category: ${r.category}`,
      severity: r.risk_level?.toLowerCase(), status: r.status,
    }));

    complaints.forEach(c => events.push({
      id: c.id, date: c.created_at, module: "complaint",
      title: `${c.complaint_number}: ${c.subject}`,
      severity: c.priority, status: c.status,
    }));

    safeguarding.forEach(s => events.push({
      id: s.id, date: s.date_raised, module: "safeguarding",
      title: `Safeguarding: ${s.concern_type.replace(/_/g, " ")}`,
      description: s.immediate_safety_risk ? "⚠️ Immediate safety risk" : undefined,
      severity: s.immediate_safety_risk ? "critical" : "warning",
      status: s.status,
    }));

    auditLogs.forEach(a => events.push({
      id: a.id, date: a.created_at, module: "audit",
      title: `${a.action.replace(/_/g, " ")} (${a.module})`,
      description: a.user_name ? `By: ${a.user_name}` : undefined,
      severity: a.severity === "elevated" ? "warning" : undefined,
    }));

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events;
  }, [incidents, risks, complaints, safeguarding, auditLogs]);

  const filtered = moduleFilter === "all" ? timeline : timeline.filter(e => e.module === moduleFilter);

  const getSeverityVariant = (s?: string) => {
    if (!s) return "secondary" as const;
    if (["critical", "high"].includes(s)) return "destructive" as const;
    if (["medium", "warning", "urgent"].includes(s)) return "outline" as const;
    return "secondary" as const;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> Compliance Timeline
          </h3>
          <p className="text-sm text-muted-foreground">
            {participantName} — {timeline.length} events across all modules
          </p>
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules ({timeline.length})</SelectItem>
            <SelectItem value="incident">Incidents ({incidents.length})</SelectItem>
            <SelectItem value="risk">Risks ({risks.length})</SelectItem>
            <SelectItem value="complaint">Complaints ({complaints.length})</SelectItem>
            <SelectItem value="safeguarding">Safeguarding ({safeguarding.length})</SelectItem>
            <SelectItem value="audit">Audit Logs ({auditLogs.length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="max-h-[500px]">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No events found</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-1">
              {filtered.map(event => {
                const config = MODULE_CONFIG[event.module];
                const Icon = config.icon;
                return (
                  <div key={`${event.module}-${event.id}`} className="relative pl-10 py-2">
                    <div className={`absolute left-2 top-3 w-5 h-5 rounded-full flex items-center justify-center ${config.bg}`}>
                      <Icon className={`h-3 w-3 ${config.color}`} />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] h-4 shrink-0">{config.label}</Badge>
                          <span className="text-sm font-medium truncate">{event.title}</span>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(event.date), "PPp")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {event.severity && (
                          <Badge variant={getSeverityVariant(event.severity)} className="text-[10px] h-4 capitalize">
                            {event.severity}
                          </Badge>
                        )}
                        {event.status && (
                          <Badge variant="secondary" className="text-[10px] h-4 capitalize">
                            {event.status.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
