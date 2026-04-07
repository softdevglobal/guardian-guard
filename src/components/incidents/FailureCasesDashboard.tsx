import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Clock, AlertTriangle, XCircle, ShieldAlert, TrendingUp, BarChart3
} from "lucide-react";
import { format, differenceInDays, differenceInHours } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

interface AuditLogEntry {
  id: string;
  action: string;
  user_name: string | null;
  created_at: string;
  severity: string;
  details: Json;
  record_id: string | null;
  module: string;
}

export function FailureCasesDashboard() {
  const { data: incidents = [] } = useQuery({
    queryKey: ["failure-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("record_status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["failure-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, user_name, created_at, severity, details, record_id, module")
        .eq("module", "incidents")
        .in("action", [
          "system_flag", "system_alert", "system_block", "closure_blocked",
          "forced_escalation", "duplicate_blocked", "pattern_detected"
        ])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });

  const analysis = useMemo(() => {
    // Late incidents: reported date > incident date
    const lateReported = incidents.filter(i => {
      if (!i.date_of_incident || !i.date_reported) return false;
      return new Date(i.date_reported) > new Date(i.date_of_incident);
    });

    // Overdue (>5 days open)
    const overdue = incidents.filter(i => {
      if (["closed", "actioned"].includes(i.status)) return false;
      return differenceInDays(new Date(), new Date(i.created_at)) > 5;
    });

    // NDIS deadline breached
    const ndisBreached = incidents.filter(i => {
      if (!i.ndis_notification_deadline) return false;
      if (i.status === "closed") {
        return i.closed_at && new Date(i.ndis_notification_deadline) < new Date(i.closed_at);
      }
      return new Date(i.ndis_notification_deadline) < new Date();
    });

    // Missing immediate action (from audit logs)
    const missingActionFlags = auditLogs.filter(l => {
      const details = l.details as Record<string, unknown> | null;
      return l.action === "system_block" && details?.flag === "missing_immediate_action";
    });

    // Misclassifications
    const misclassifications = auditLogs.filter(l => {
      const details = l.details as Record<string, unknown> | null;
      return l.action === "system_alert" && details?.flag === "possible_misclassification";
    });

    // Closure blocks
    const closureBlocks = auditLogs.filter(l => l.action === "closure_blocked");

    // Delayed escalations
    const delayedEscalations = auditLogs.filter(l => {
      const details = l.details as Record<string, unknown> | null;
      return l.action === "system_alert" && details?.flag === "unactioned_critical";
    });

    // Pattern detections
    const patterns = auditLogs.filter(l => l.action === "pattern_detected");

    // System interventions total
    const systemInterventions = auditLogs.length;

    return {
      lateReported,
      overdue,
      ndisBreached,
      missingActionFlags,
      misclassifications,
      closureBlocks,
      delayedEscalations,
      patterns,
      systemInterventions,
    };
  }, [incidents, auditLogs]);

  const totalIssues = analysis.lateReported.length + analysis.ndisBreached.length +
    analysis.misclassifications.length + analysis.delayedEscalations.length +
    analysis.missingActionFlags.length + analysis.closureBlocks.length;

  const complianceScore = incidents.length > 0
    ? Math.max(0, Math.round(((incidents.length - totalIssues) / incidents.length) * 100))
    : 100;

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-destructive/30">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-destructive">{totalIssues}</div>
            <p className="text-sm text-muted-foreground">Total Issues Detected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{analysis.systemInterventions}</div>
            <p className="text-sm text-muted-foreground">System Interventions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{analysis.lateReported.length}</div>
            <p className="text-sm text-muted-foreground">Late Reports</p>
          </CardContent>
        </Card>
        <Card className={complianceScore >= 80 ? "border-success/30" : "border-warning/30"}>
          <CardContent className="pt-6 text-center">
            <div className={`text-3xl font-bold ${complianceScore >= 80 ? "text-success" : "text-warning"}`}>
              {complianceScore}%
            </div>
            <p className="text-sm text-muted-foreground">Compliance Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Issue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Failure Category Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Late Reporting", count: analysis.lateReported.length, icon: Clock, color: "text-destructive" },
            { label: "Wrong Classification", count: analysis.misclassifications.length, icon: AlertTriangle, color: "text-warning" },
            { label: "Missed Escalation", count: analysis.delayedEscalations.length, icon: ShieldAlert, color: "text-destructive" },
            { label: "Missing Immediate Action", count: analysis.missingActionFlags.length, icon: XCircle, color: "text-destructive" },
            { label: "Closure Blocked", count: analysis.closureBlocks.length, icon: XCircle, color: "text-warning" },
            { label: "NDIS Deadline Breached", count: analysis.ndisBreached.length, icon: Clock, color: "text-destructive" },
            { label: "Repeat Patterns", count: analysis.patterns.length, icon: TrendingUp, color: "text-warning" },
          ].map(item => {
            const pct = incidents.length > 0 ? (item.count / incidents.length) * 100 : 0;
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <Badge variant={item.count > 0 ? "destructive" : "outline"}>
                    {item.count}
                  </Badge>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Late Incidents Detail */}
      {analysis.lateReported.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-destructive" />
              Late Reported Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Incident Date</TableHead>
                  <TableHead>Report Date</TableHead>
                  <TableHead>Delay</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.lateReported.map(inc => {
                  const delay = differenceInDays(new Date(inc.date_reported!), new Date(inc.date_of_incident!));
                  return (
                    <TableRow key={inc.id}>
                      <TableCell className="font-mono text-sm">{inc.incident_number}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{inc.title}</TableCell>
                      <TableCell>{format(new Date(inc.date_of_incident!), "PP")}</TableCell>
                      <TableCell>{format(new Date(inc.date_reported!), "PP")}</TableCell>
                      <TableCell><Badge variant="destructive">{delay} day{delay !== 1 ? "s" : ""}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{inc.severity}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* System Intervention Log */}
      {auditLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              System Intervention Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.slice(0, 20).map(log => {
                  const details = log.details as Record<string, unknown> | null;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "PP p")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">
                        {(details?.note as string) ?? (details?.flag as string) ?? log.action}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.severity === "critical" ? "destructive" : "secondary"} className="capitalize text-xs">
                          {log.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Overdue Incidents */}
      {analysis.overdue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Currently Overdue (&gt;5 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Days Open</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.overdue.map(inc => {
                  const days = differenceInDays(new Date(), new Date(inc.created_at));
                  return (
                    <TableRow key={inc.id}>
                      <TableCell className="font-mono text-sm">{inc.incident_number}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{inc.title}</TableCell>
                      <TableCell><Badge variant="destructive">{days}d</Badge></TableCell>
                      <TableCell className="capitalize">{inc.status.replace(/_/g, " ")}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{inc.severity}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
