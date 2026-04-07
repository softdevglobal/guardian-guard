import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, ClipboardList } from "lucide-react";
import { useState } from "react";

const mockLogs = [
  { id: 1, timestamp: "2026-04-07 09:15:22", user: "Sarah Chen", action: "Created incident INC-001", module: "Incidents", severity: "Normal", ip: "10.0.1.45" },
  { id: 2, timestamp: "2026-04-07 09:10:05", user: "System AI", action: "Detected distress markers in chat session #4521", module: "Heartbeat", severity: "AI Action", ip: "N/A" },
  { id: 3, timestamp: "2026-04-07 08:55:33", user: "Admin", action: "Revealed masked data for participant P-002", module: "Participants", severity: "Sensitive", ip: "10.0.1.10" },
  { id: 4, timestamp: "2026-04-07 08:30:11", user: "James Patel", action: "Updated risk RSK-002 mitigation plan", module: "Risks", severity: "Normal", ip: "10.0.2.22" },
  { id: 5, timestamp: "2026-04-06 17:45:00", user: "System", action: "Auto-enrolled Mike Torres in refresher training TRN-002", module: "Training", severity: "Auto", ip: "N/A" },
  { id: 6, timestamp: "2026-04-06 16:20:15", user: "Lisa Zhang", action: "Submitted complaint CMP-001 on behalf of participant", module: "Complaints", severity: "Normal", ip: "10.0.1.55" },
  { id: 7, timestamp: "2026-04-06 15:00:00", user: "System AI", action: "Generated compliance report for Q1 2026", module: "Dashboard", severity: "AI Action", ip: "N/A" },
  { id: 8, timestamp: "2026-04-06 14:30:22", user: "Emma Wilson", action: "Failed login attempt (wrong password)", module: "Auth", severity: "Security", ip: "203.45.67.89" },
];

const severityVariant = (s: string) => {
  if (s === "Security" || s === "Sensitive") return "destructive" as const;
  if (s === "AI Action") return "outline" as const;
  if (s === "Auto") return "secondary" as const;
  return "default" as const;
};

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const filtered = mockLogs.filter((log) => {
    const matchesSearch = log.action.toLowerCase().includes(search.toLowerCase()) || log.user.toLowerCase().includes(search.toLowerCase());
    const matchesModule = moduleFilter === "all" || log.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">Complete system activity trail — every action is recorded</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input placeholder="Search logs..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search audit logs" />
            </div>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter by module">
                <ClipboardList className="mr-2 h-4 w-4" aria-hidden="true" />
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="Incidents">Incidents</SelectItem>
                <SelectItem value="Heartbeat">Heartbeat</SelectItem>
                <SelectItem value="Participants">Participants</SelectItem>
                <SelectItem value="Risks">Risks</SelectItem>
                <SelectItem value="Training">Training</SelectItem>
                <SelectItem value="Complaints">Complaints</SelectItem>
                <SelectItem value="Auth">Auth</SelectItem>
                <SelectItem value="Dashboard">Dashboard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Activity Log ({filtered.length} entries)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{log.timestamp}</TableCell>
                    <TableCell className="font-medium">{log.user}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{log.action}</TableCell>
                    <TableCell><Badge variant="secondary">{log.module}</Badge></TableCell>
                    <TableCell><Badge variant={severityVariant(log.severity)}>{log.severity}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{log.ip}</TableCell>
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
