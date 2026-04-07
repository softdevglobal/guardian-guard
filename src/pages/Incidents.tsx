import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { IncidentFormDialog } from "@/components/incidents/IncidentFormDialog";
import { IncidentDetailSheet } from "@/components/incidents/IncidentDetailSheet";
import type { Tables } from "@/integrations/supabase/types";

type Incident = Tables<"incidents">;

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info text-info-foreground",
  reported: "bg-info text-info-foreground",
  supervisor_review: "bg-warning text-warning-foreground",
  compliance_review: "bg-warning text-warning-foreground",
  review: "bg-warning text-warning-foreground",
  investigating: "bg-destructive text-destructive-foreground",
  actioned: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
};

const severityVariant = (s: string) => {
  if (s === "critical" || s === "high") return "destructive" as const;
  if (s === "medium") return "outline" as const;
  return "secondary" as const;
};

export default function Incidents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incidents").select("*").eq("record_status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = incidents.filter((inc) => {
    const matchesSearch = inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || inc.incident_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCount = incidents.filter((i) => !["closed", "actioned"].includes(i.status)).length;
  const reportableCount = incidents.filter((i) => i.is_reportable).length;
  const closedCount = incidents.filter((i) => i.status === "closed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground">Smart classification & NDIS-compliant incident tracking</p>
        </div>
        <IncidentFormDialog />
      </div>

      <section aria-label="Incident summary" className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{openCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">NDIS Reportable</CardTitle>
            <Clock className="h-4 w-4 text-warning" aria-hidden />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{reportableCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" aria-hidden />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{closedCount}</div></CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input placeholder="Search incidents..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search incidents" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
                <Filter className="mr-2 h-4 w-4" aria-hidden /><SelectValue placeholder="All Statuses" />
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Incidents ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : filtered.length === 0 ? (
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
                    <TableHead>Reported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inc) => (
                    <TableRow
                      key={inc.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedIncident(inc); setSheetOpen(true); }}
                    >
                      <TableCell className="font-mono text-sm">{inc.incident_number}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{inc.title}</TableCell>
                      <TableCell className="text-sm capitalize">{(inc.incident_category ?? inc.incident_type).replace(/_/g, " ")}</TableCell>
                      <TableCell><Badge variant={severityVariant(inc.severity)} className="capitalize">{inc.severity}</Badge></TableCell>
                      <TableCell><Badge className={`${statusColors[inc.status] ?? ""} capitalize`}>{inc.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell>{inc.is_reportable ? <Badge variant="destructive">NDIS</Badge> : <span className="text-sm text-muted-foreground">No</span>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(inc.created_at), "PP")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <IncidentDetailSheet incident={selectedIncident} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
