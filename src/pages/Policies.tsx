import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText } from "lucide-react";

const mockPolicies = [
  { id: "POL-001", title: "Privacy & Data Protection Policy", version: "3.2", status: "Published", lastReview: "2026-01-15", nextReview: "2027-01-15", owner: "Compliance Officer" },
  { id: "POL-002", title: "Incident Reporting & Management", version: "2.1", status: "Published", lastReview: "2025-11-20", nextReview: "2026-11-20", owner: "Compliance Officer" },
  { id: "POL-003", title: "Safeguarding & Child Protection", version: "4.0", status: "Under Review", lastReview: "2025-06-01", nextReview: "2026-06-01", owner: "Super Admin" },
  { id: "POL-004", title: "Staff Code of Conduct", version: "1.5", status: "Draft", lastReview: "N/A", nextReview: "N/A", owner: "HR Admin" },
  { id: "POL-005", title: "Digital Training Delivery Standards", version: "2.0", status: "Approved", lastReview: "2026-03-01", nextReview: "2027-03-01", owner: "Compliance Officer" },
];

const statusColor = (s: string) => {
  if (s === "Published") return "bg-success text-success-foreground";
  if (s === "Approved") return "bg-info text-info-foreground";
  if (s === "Under Review") return "bg-warning text-warning-foreground";
  return "bg-muted text-muted-foreground";
};

export default function Policies() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policy Management</h1>
          <p className="text-muted-foreground">Version-controlled policies with approval workflows</p>
        </div>
        <Button className="touch-target">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create Policy
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <FileText className="h-4 w-4 text-success" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">2</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Under Review</CardTitle>
            <FileText className="h-4 w-4 text-warning" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">1</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">1</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All Policies</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Review</TableHead>
                  <TableHead>Next Review</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPolicies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.id}</TableCell>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>v{p.version}</TableCell>
                    <TableCell><Badge className={statusColor(p.status)}>{p.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{p.lastReview}</TableCell>
                    <TableCell className="text-muted-foreground">{p.nextReview}</TableCell>
                    <TableCell>{p.owner}</TableCell>
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
