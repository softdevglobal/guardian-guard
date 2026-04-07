import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, ClipboardList } from "lucide-react";
import { format } from "date-fns";

const severityVariant = (s: string) => {
  if (s === "security" || s === "sensitive") return "destructive" as const;
  if (s === "ai_action") return "outline" as const;
  if (s === "auto") return "secondary" as const;
  return "default" as const;
};

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const filtered = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(search.toLowerCase()) || (log.user_name ?? "").toLowerCase().includes(search.toLowerCase());
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
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search logs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search audit logs" />
            </div>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter by module">
                <ClipboardList className="mr-2 h-4 w-4" /><SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="incidents">Incidents</SelectItem>
                <SelectItem value="heartbeat">Heartbeat</SelectItem>
                <SelectItem value="participants">Participants</SelectItem>
                <SelectItem value="risks">Risks</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="complaints">Complaints</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Activity Log ({filtered.length} entries)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : filtered.length === 0 ? <p className="text-center py-4 text-muted-foreground">No logs found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Module</TableHead><TableHead>Type</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{format(new Date(log.created_at), "PPp")}</TableCell>
                      <TableCell className="font-medium">{log.user_name ?? "System"}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{log.action}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{log.module}</Badge></TableCell>
                      <TableCell><Badge variant={severityVariant(log.severity)} className="capitalize">{log.severity}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{log.ip_address ?? "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
