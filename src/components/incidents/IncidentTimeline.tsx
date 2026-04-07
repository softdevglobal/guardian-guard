import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ArrowRight, FileText, History, User, Shield } from "lucide-react";

interface Props {
  incidentId: string;
  createdAt: string;
}

export function IncidentTimeline({ incidentId, createdAt }: Props) {
  const { data: versions = [] } = useQuery({
    queryKey: ["incident-versions", incidentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_versions")
        .select("*")
        .eq("incident_id", incidentId)
        .order("version_number", { ascending: true });
      return data ?? [];
    },
  });

  const { data: workflow = [] } = useQuery({
    queryKey: ["incident-workflow", incidentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_workflow_history")
        .select("*")
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["incident-audit-logs", incidentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("record_id", incidentId)
        .eq("module", "incidents")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  // Merge all events into a single timeline
  type TimelineEvent = {
    id: string;
    type: "creation" | "version" | "workflow" | "audit";
    timestamp: string;
    title: string;
    description?: string;
    severity?: string;
    meta?: Record<string, any>;
  };

  const events: TimelineEvent[] = [
    {
      id: "creation",
      type: "creation",
      timestamp: createdAt,
      title: "Incident Created",
      description: "Initial record created",
    },
    ...versions.map((v) => ({
      id: `v-${v.id}`,
      type: "version" as const,
      timestamp: v.created_at,
      title: `Version ${v.version_number}`,
      description: `Fields changed: ${Object.keys(v.changes && typeof v.changes === "object" ? v.changes : {}).join(", ") || "No details"}`,
      meta: v.changes as Record<string, any>,
    })),
    ...workflow.map((w) => ({
      id: `w-${w.id}`,
      type: "workflow" as const,
      timestamp: w.created_at,
      title: `Status: ${(w.from_status ?? "new").replace(/_/g, " ")} → ${w.to_status.replace(/_/g, " ")}`,
      description: w.notes ?? undefined,
    })),
    ...auditLogs.map((a) => ({
      id: `a-${a.id}`,
      type: "audit" as const,
      timestamp: a.created_at,
      title: a.action.replace(/_/g, " "),
      description: a.user_name ? `By ${a.user_name}` : undefined,
      severity: a.severity,
      meta: a.details as Record<string, any>,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const typeIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "creation": return <FileText className="h-3.5 w-3.5" />;
      case "version": return <History className="h-3.5 w-3.5" />;
      case "workflow": return <ArrowRight className="h-3.5 w-3.5" />;
      case "audit": return <Shield className="h-3.5 w-3.5" />;
    }
  };

  const typeBadgeVariant = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "creation": return "default" as const;
      case "version": return "secondary" as const;
      case "workflow": return "outline" as const;
      case "audit": return "outline" as const;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" />
          Incident Timeline ({events.length} events)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex gap-3 relative">
                  <div className={`mt-1 z-10 h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                    event.type === "creation" ? "bg-primary text-primary-foreground" :
                    event.type === "workflow" ? "bg-warning/20 text-warning" :
                    event.type === "version" ? "bg-secondary text-secondary-foreground" :
                    event.severity === "critical" || event.severity === "high" ? "bg-destructive/20 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {typeIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={typeBadgeVariant(event.type)} className="text-[10px] capitalize">
                        {event.type}
                      </Badge>
                      <span className="text-sm font-medium capitalize">{event.title}</span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(event.timestamp), "PPp")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
