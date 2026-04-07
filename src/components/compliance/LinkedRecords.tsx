import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2, AlertTriangle, FileText, Activity, ShieldAlert, GraduationCap, Users, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface LinkedRecordsProps {
  /** The module type of the current record */
  module: "incident" | "risk" | "complaint" | "safeguarding" | "participant";
  /** Current record's participant_id or linked_participant_id */
  participantId?: string | null;
  /** Current record's ID for reverse-lookups */
  recordId: string;
  /** Organisation ID for scoping queries */
  organisationId?: string | null;
}

interface LinkedItem {
  id: string;
  module: string;
  title: string;
  status?: string;
  severity?: string;
  date: string;
  link: string;
}

export function LinkedRecords({ module, participantId, recordId, organisationId }: LinkedRecordsProps) {
  // Fetch incidents linked to this participant or record
  const { data: linkedIncidents = [] } = useQuery({
    queryKey: ["linked-incidents", participantId, recordId, module],
    enabled: !!participantId || module === "risk",
    queryFn: async () => {
      let query = supabase.from("incidents")
        .select("id, incident_number, title, severity, status, created_at")
        .eq("record_status", "active");

      if (module === "risk") {
        // Find incidents linked to this risk
        const { data: risks } = await supabase.from("risks")
          .select("linked_incident_id")
          .eq("id", recordId)
          .single();
        if (risks?.linked_incident_id) {
          query = query.eq("id", risks.linked_incident_id);
        } else if (participantId) {
          query = query.eq("participant_id", participantId);
        } else {
          return [];
        }
      } else if (participantId) {
        query = query.eq("participant_id", participantId);
      } else {
        return [];
      }

      const { data } = await query.order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  // Fetch risks linked to participant or incident
  const { data: linkedRisks = [] } = useQuery({
    queryKey: ["linked-risks", participantId, recordId, module],
    enabled: !!participantId || module === "incident",
    queryFn: async () => {
      let query = supabase.from("risks")
        .select("id, title, risk_level, status, created_at")
        .eq("record_status", "active");

      if (module === "incident") {
        query = query.or(`linked_incident_id.eq.${recordId}${participantId ? `,linked_participant_id.eq.${participantId}` : ""}`);
      } else if (participantId) {
        query = query.eq("linked_participant_id", participantId);
      } else {
        return [];
      }

      const { data } = await query.order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  // Fetch complaints linked to participant
  const { data: linkedComplaints = [] } = useQuery({
    queryKey: ["linked-complaints", participantId],
    enabled: !!participantId && module !== "complaint",
    queryFn: async () => {
      const { data } = await supabase.from("complaints")
        .select("id, complaint_number, subject, status, priority, created_at")
        .eq("participant_id", participantId!)
        .eq("record_status", "active")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  // Fetch safeguarding concerns linked to participant
  const { data: linkedSafeguarding = [] } = useQuery({
    queryKey: ["linked-safeguarding", participantId],
    enabled: !!participantId && module !== "safeguarding",
    queryFn: async () => {
      const { data } = await supabase.from("safeguarding_concerns")
        .select("id, concern_type, status, date_raised, immediate_safety_risk")
        .eq("participant_id", participantId!)
        .eq("record_status", "active")
        .order("date_raised", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const items: LinkedItem[] = [];

  if (module !== "incident") {
    linkedIncidents.forEach(i => items.push({
      id: i.id, module: "Incident",
      title: `${i.incident_number}: ${i.title}`,
      status: i.status, severity: i.severity,
      date: i.created_at, link: "/incidents",
    }));
  }

  linkedRisks.forEach(r => items.push({
    id: r.id, module: "Risk",
    title: r.title,
    status: r.status, severity: r.risk_level?.toLowerCase(),
    date: r.created_at, link: "/risks",
  }));

  if (module !== "complaint") {
    linkedComplaints.forEach(c => items.push({
      id: c.id, module: "Complaint",
      title: `${c.complaint_number}: ${c.subject}`,
      status: c.status, severity: c.priority,
      date: c.created_at, link: "/complaints",
    }));
  }

  linkedSafeguarding.forEach(s => items.push({
    id: s.id, module: "Safeguarding",
    title: `${s.concern_type.replace(/_/g, " ")}${s.immediate_safety_risk ? " ⚠️" : ""}`,
    status: s.status,
    severity: s.immediate_safety_risk ? "critical" : "warning",
    date: s.date_raised, link: "/safeguarding",
  }));

  if (items.length === 0) return null;

  const getIcon = (mod: string) => {
    switch (mod) {
      case "Incident": return AlertTriangle;
      case "Risk": return Activity;
      case "Complaint": return FileText;
      case "Safeguarding": return ShieldAlert;
      default: return Link2;
    }
  };

  const getSeverityVariant = (s?: string) => {
    if (!s) return "secondary" as const;
    if (["critical", "high"].includes(s)) return "destructive" as const;
    return "outline" as const;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Linked Records ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.map(item => {
          const Icon = getIcon(item.module);
          return (
            <div
              key={`${item.module}-${item.id}`}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Badge variant="outline" className="text-[10px] h-4 shrink-0">{item.module}</Badge>
              <span className="truncate flex-1">{item.title}</span>
              {item.severity && (
                <Badge variant={getSeverityVariant(item.severity)} className="text-[10px] h-4 capitalize shrink-0">
                  {item.severity}
                </Badge>
              )}
              {item.status && (
                <Badge variant="secondary" className="text-[10px] h-4 capitalize shrink-0">
                  {item.status.replace(/_/g, " ")}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground shrink-0">
                {format(new Date(item.date), "dd MMM")}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
