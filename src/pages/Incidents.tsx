import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Search, Filter, AlertTriangle, Clock, CheckCircle, ShieldAlert,
  Timer, FileWarning, BarChart3, Siren
} from "lucide-react";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { IncidentFormDialog } from "@/components/incidents/IncidentFormDialog";
import { IncidentDetailSheet } from "@/components/incidents/IncidentDetailSheet";
import type { Tables } from "@/integrations/supabase/types";

type Incident = Tables<"incidents">;

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-secondary text-secondary-foreground",
  reported: "bg-secondary text-secondary-foreground",
  supervisor_review: "bg-warning text-warning-foreground",
  compliance_review: "bg-warning text-warning-foreground",
  review: "bg-warning text-warning-foreground",
  investigating: "bg-primary/20 text-primary",
  actioned: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
};

const severityConfig: Record<string, { variant: "destructive" | "outline" | "secondary"; icon: typeof AlertTriangle }> = {
  critical: { variant: "destructive", icon: Siren },
  high: { variant: "destructive", icon: AlertTriangle },
  medium: { variant: "outline", icon: Clock },
  low: { variant: "secondary", icon: CheckCircle },
};

export default function Incidents() {
  const { user } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents"],
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

  // Stats
  const stats = useMemo(() => {
    const open = incidents.filter(i => !["closed", "actioned"].includes(i.status));
    const reportable = incidents.filter(i => i.is_reportable);
    const closed = incidents.filter(i => i.status === "closed");
    const critical = incidents.filter(i => i.severity === "critical" && i.status !== "closed");
    const overdue5d = incidents.filter(i => {
      if (["closed", "actioned"].includes(i.status)) return false;
      return differenceInDays(new Date(), new Date(i.created_at)) > 5;
    });
    const ndisBreached = incidents.filter(i => {
      if (["closed"].includes(i.status)) return false;
      if (!i.ndis_notification_deadline) return false;
      return new Date(i.ndis_notification_deadline) < new Date();
    });
    const investigating = incidents.filter(i => i.status === "investigating");

    return {
      total: incidents.length,
      open: open.length,
      reportable: reportable.length,
      closed: closed.length,
      critical: critical.length,
      overdue5d: overdue5d.length,
      ndisBreached: ndisBreached.length,
      investigating: investigating.length,
    };
  }, [incidents]);

  const filtered = incidents.filter(inc => {
    const matchesSearch = inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.incident_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inc.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || inc.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // Time breach helpers
  const getTimeBreaches = (inc: Incident) => {
    const breaches: string[] = [];
    if (!["closed", "actioned"].includes(inc.status)) {
      if (differenceInDays(new Date(), new Date(inc.created_at)) > 5) {
        breaches.push("5-day overdue");
      }
      if (inc.ndis_notification_deadline && new Date(inc.ndis_notification_deadline) < new Date()) {
        breaches.push("24h NDIS breach");
      }
    }
    return breaches;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground">NDIS-compliant workflow with enforcement, escalation & audit trail</p>
        </div>
        <IncidentFormDialog />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="register">Incident Register</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.open}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Critical / Active</CardTitle>
                <Siren className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-destructive">{stats.critical}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">NDIS Reportable</CardTitle>
                <ShieldAlert className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.reportable}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Closed</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-success">{stats.closed}</div></CardContent>
            </Card>
          </div>

          {/* Time Breach Alerts */}
          {(stats.ndisBreached > 0 || stats.overdue5d > 0) && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                  <Timer className="h-4 w-4" />Time Compliance Breaches
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.ndisBreached > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{stats.ndisBreached}</Badge>
                    <span className="text-sm">incidents have exceeded the 24-hour NDIS notification deadline</span>
                  </div>
                )}
                {stats.overdue5d > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-destructive text-destructive">{stats.overdue5d}</Badge>
                    <span className="text-sm">incidents have exceeded the 5-day resolution target</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Workflow Pipeline */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Workflow Pipeline</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 text-center">
                {["draft", "submitted", "supervisor_review", "compliance_review", "investigating", "actioned", "closed"].map(status => {
                  const count = incidents.filter(i => i.status === status).length;
                  return (
                    <div key={status} className="space-y-1">
                      <Badge className={`${statusColors[status]} text-[10px] w-full justify-center`}>
                        {status.replace(/_/g, " ")}
                      </Badge>
                      <div className="text-lg font-bold">{count}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Incidents */}
          <IncidentTable
            incidents={incidents.slice(0, 10)}
            title="Recent Incidents"
            onSelect={inc => { setSelectedIncident(inc); setSheetOpen(true); }}
            getTimeBreaches={getTimeBreaches}
          />
        </TabsContent>

        {/* REGISTER */}
        <TabsContent value="register" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search incidents..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="supervisor_review">Supervisor Review</SelectItem>
                    <SelectItem value="compliance_review">Compliance Review</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="actioned">Actioned</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="All Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <IncidentTable
            incidents={filtered}
            title={`Incident Register (${filtered.length})`}
            onSelect={inc => { setSelectedIncident(inc); setSheetOpen(true); }}
            getTimeBreaches={getTimeBreaches}
            showAll
          />
        </TabsContent>

        {/* REPORTING */}
        <TabsContent value="reporting" className="space-y-6 mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm">Severity Distribution</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {["critical", "high", "medium", "low"].map(sev => {
                  const count = incidents.filter(i => i.severity === sev).length;
                  const pct = incidents.length > 0 ? (count / incidents.length) * 100 : 0;
                  return (
                    <div key={sev} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{sev}</span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(
                  incidents.reduce<Record<string, number>>((acc, i) => {
                    const cat = i.incident_category ?? "uncategorised";
                    acc[cat] = (acc[cat] ?? 0) + 1;
                    return acc;
                  }, {})
                ).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between text-sm">
                    <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Compliance Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Total incidents</span><span className="font-bold">{stats.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Resolved within 5 days</span>
                  <span className="font-bold text-success">
                    {incidents.filter(i => i.status === "closed" && differenceInDays(new Date(i.closed_at ?? i.updated_at), new Date(i.created_at)) <= 5).length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>NDIS reportable</span><span className="font-bold">{stats.reportable}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Active time breaches</span>
                  <span className="font-bold text-destructive">{stats.ndisBreached + stats.overdue5d}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Under investigation</span><span className="font-bold">{stats.investigating}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Serious Incident Report */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-destructive" />Serious Incident Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const serious = incidents.filter(i => i.severity === "critical" || i.severity === "high" || i.is_reportable);
                return serious.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No serious incidents recorded</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>NDIS Reportable</TableHead>
                          <TableHead>NDIS Deadline</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Days Open</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serious.map(inc => {
                          const daysOpen = inc.closed_at
                            ? differenceInDays(new Date(inc.closed_at), new Date(inc.created_at))
                            : differenceInDays(new Date(), new Date(inc.created_at));
                          const ndisBreached = inc.ndis_notification_deadline && new Date(inc.ndis_notification_deadline) < new Date() && inc.status !== "closed";
                          return (
                            <TableRow key={inc.id} className="cursor-pointer" onClick={() => { setSelectedIncident(inc); setSheetOpen(true); }}>
                              <TableCell className="font-mono text-sm">{inc.incident_number}</TableCell>
                              <TableCell className="font-medium max-w-[180px] truncate">{inc.title}</TableCell>
                              <TableCell>
                                <Badge variant={severityConfig[inc.severity]?.variant ?? "secondary"} className="capitalize">{inc.severity}</Badge>
                              </TableCell>
                              <TableCell>
                                {inc.is_reportable ? <Badge variant="destructive">Yes</Badge> : <span className="text-muted-foreground text-sm">No</span>}
                              </TableCell>
                              <TableCell>
                                {inc.ndis_notification_deadline ? (
                                  <div>
                                    <span className="text-sm">{format(new Date(inc.ndis_notification_deadline), "PPp")}</span>
                                    {ndisBreached && <p className="text-xs text-destructive font-medium">BREACHED</p>}
                                  </div>
                                ) : "—"}
                              </TableCell>
                              <TableCell><Badge className={`${statusColors[inc.status]} capitalize`}>{inc.status.replace(/_/g, " ")}</Badge></TableCell>
                              <TableCell>
                                <span className={daysOpen > 5 ? "text-destructive font-medium" : ""}>{daysOpen}d</span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <IncidentDetailSheet incident={selectedIncident} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}

// Shared incident table component
function IncidentTable({ incidents, title, onSelect, getTimeBreaches, showAll }: {
  incidents: Incident[];
  title: string;
  onSelect: (inc: Incident) => void;
  getTimeBreaches: (inc: Incident) => string[];
  showAll?: boolean;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No incidents found</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reportable</TableHead>
                  <TableHead>Alerts</TableHead>
                  <TableHead>Reported</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map(inc => {
                  const breaches = getTimeBreaches(inc);
                  return (
                    <TableRow key={inc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(inc)}>
                      <TableCell className="font-mono text-sm">{inc.incident_number}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{inc.title}</TableCell>
                      <TableCell className="text-sm capitalize">{(inc.incident_category ?? inc.incident_type).replace(/_/g, " ")}</TableCell>
                      <TableCell>
                        <Badge variant={severityConfig[inc.severity]?.variant ?? "secondary"} className="capitalize">{inc.severity}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[inc.status] ?? ""} capitalize`}>{inc.status.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        {inc.is_reportable ? <Badge variant="destructive">NDIS</Badge> : <span className="text-sm text-muted-foreground">No</span>}
                      </TableCell>
                      <TableCell>
                        {breaches.length > 0 ? (
                          <div className="space-y-0.5">
                            {breaches.map(b => (
                              <Badge key={b} variant="destructive" className="text-[10px] block w-fit">{b}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(inc.created_at), "PP")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
