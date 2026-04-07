import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GraduationCap, Clock, CheckCircle, AlertTriangle } from "lucide-react";

const mockModules = [
  { id: "TRN-001", title: "NDIS Orientation", type: "Mandatory", duration: "4 hrs", completionRate: 92, enrolled: 12, status: "Active" },
  { id: "TRN-002", title: "Cyber Safety & Digital Literacy", type: "Mandatory", duration: "2 hrs", completionRate: 78, enrolled: 15, status: "Active" },
  { id: "TRN-003", title: "Incident Handling Procedures", type: "Mandatory", duration: "3 hrs", completionRate: 100, enrolled: 10, status: "Active" },
  { id: "TRN-004", title: "Safeguarding Vulnerable People", type: "Mandatory", duration: "3 hrs", completionRate: 85, enrolled: 12, status: "Active" },
  { id: "TRN-005", title: "Advanced Communication Skills", type: "Elective", duration: "2 hrs", completionRate: 60, enrolled: 8, status: "Active" },
  { id: "TRN-006", title: "Conflict Resolution", type: "Elective", duration: "1.5 hrs", completionRate: 45, enrolled: 6, status: "Draft" },
];

export default function Training() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training Matrix</h1>
        <p className="text-muted-foreground">Competency mapping, enforcement logic, and auto re-certification</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Modules</CardTitle>
            <GraduationCap className="h-4 w-4 text-primary" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">5</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">83%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">3</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring (60 days)</CardTitle>
            <Clock className="h-4 w-4 text-info" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">2</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Training Modules</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Completion Rate</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockModules.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">{m.id}</TableCell>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell><Badge variant={m.type === "Mandatory" ? "destructive" : "secondary"}>{m.type}</Badge></TableCell>
                    <TableCell>{m.duration}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={m.completionRate} className="h-2 w-20" />
                        <span className="text-sm">{m.completionRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{m.enrolled}</TableCell>
                    <TableCell><Badge variant={m.status === "Active" ? "default" : "secondary"}>{m.status}</Badge></TableCell>
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
