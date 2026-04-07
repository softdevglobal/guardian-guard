import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, AlertTriangle, Filter } from "lucide-react";

type IncidentStatus = "reported" | "review" | "investigating" | "actioned" | "closed";
type Severity = "low" | "medium" | "high" | "critical";

interface Incident {
  id: string;
  title: string;
  type: string;
  status: IncidentStatus;
  severity: Severity;
  reportedBy: string;
  reportedAt: string;
  participant: string;
  isReportable: boolean;
}

const mockIncidents: Incident[] = [
  { id: "INC-001", title: "Participant distress during call training", type: "Participant-related", status: "investigating", severity: "high", reportedBy: "Sarah Chen", reportedAt: "2026-04-07 09:15", participant: "John D.", isReportable: true },
  { id: "INC-002", title: "Equipment malfunction in training room", type: "Environmental", status: "reported", severity: "medium", reportedBy: "Mike Torres", reportedAt: "2026-04-06 14:30", participant: "N/A", isReportable: false },
  { id: "INC-003", title: "Medication incident during session", type: "Participant-related", status: "review", severity: "high", reportedBy: "Emma Wilson", reportedAt: "2026-04-05 11:00", participant: "Alice M.", isReportable: true },
  { id: "INC-004", title: "Near-miss slip hazard in corridor", type: "Environmental", status: "actioned", severity: "low", reportedBy: "James Patel", reportedAt: "2026-04-04 16:45", participant: "N/A", isReportable: false },
  { id: "INC-005", title: "Verbal complaint from family member", type: "Complaint-related", status: "closed", severity: "medium", reportedBy: "Lisa Zhang", reportedAt: "2026-04-03 10:20", participant: "Robert K.", isReportable: false },
];

const statusColors: Record<IncidentStatus, string> = {
  reported: "bg-info text-info-foreground",
  review: "bg-warning text-warning-foreground",
  investigating: "bg-destructive text-destructive-foreground",
  actioned: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
};

const severityVariant = (s: Severity) => {
  if (s === "critical" || s === "high") return "destructive" as const;
  if (s === "medium") return "outline" as const;
  return "secondary" as const;
};

export default function Incidents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = mockIncidents.filter((inc) => {
    const matchesSearch = inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || inc.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incident Management</h1>
          <p className="text-muted-foreground">Smart classification & NDIS-compliant incident tracking</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="touch-target">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Report Incident
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Report New Incident</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <Label htmlFor="inc-title">Incident Title</Label>
                <Input id="inc-title" placeholder="Brief description of what happened" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inc-type">Incident Type</Label>
                  <Select>
                    <SelectTrigger id="inc-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="participant">Participant-related</SelectItem>
                      <SelectItem value="environmental">Environmental</SelectItem>
                      <SelectItem value="complaint">Complaint-related</SelectItem>
                      <SelectItem value="operational">Operational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inc-injury">Injury Involved?</Label>
                  <Select>
                    <SelectTrigger id="inc-injury"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inc-desc">Full Description</Label>
                <Textarea id="inc-desc" placeholder="Provide detailed account of the incident..." rows={4} required />
              </div>
              <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                  Smart Classification Active
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  If injury = Yes AND type = Participant-related, this will be auto-classified as a Reportable Incident.
                </p>
              </div>
              <Button type="submit" className="w-full touch-target">Submit Incident Report</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search incidents..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search incidents"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
                <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="reported">Reported</SelectItem>
                <SelectItem value="review">Under Review</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="actioned">Actioned</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Incidents ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reportable</TableHead>
                  <TableHead>Reported</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inc) => (
                  <TableRow key={inc.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">{inc.id}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{inc.title}</TableCell>
                    <TableCell className="text-sm">{inc.type}</TableCell>
                    <TableCell>
                      <Badge variant={severityVariant(inc.severity)} className="capitalize">{inc.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[inc.status]} capitalize`}>{inc.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {inc.isReportable ? (
                        <Badge variant="destructive">NDIS Reportable</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inc.reportedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
