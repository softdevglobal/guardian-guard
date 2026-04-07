import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ShieldAlert } from "lucide-react";

const mockRisks = [
  { id: "RSK-001", title: "Remote access from unsecured networks", category: "Digital Security", likelihood: "High", impact: "Critical", status: "Open", mitigations: 2 },
  { id: "RSK-002", title: "Staff training certification gaps", category: "Workforce", likelihood: "Medium", impact: "High", status: "Mitigating", mitigations: 3 },
  { id: "RSK-003", title: "Participant data breach potential", category: "Privacy", likelihood: "Low", impact: "Critical", status: "Open", mitigations: 1 },
  { id: "RSK-004", title: "Inadequate incident response time", category: "Operational", likelihood: "Medium", impact: "Medium", status: "Resolved", mitigations: 4 },
];

export default function Risks() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk Register</h1>
          <p className="text-muted-foreground">Identify, assess, and mitigate compliance risks</p>
        </div>
        <Button className="touch-target">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add Risk
        </Button>
      </div>

      {/* Risk Heat Map Summary */}
      <section aria-label="Risk summary" className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Risks</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">2</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mitigating</CardTitle>
            <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">1</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <ShieldAlert className="h-4 w-4 text-success" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">1</div></CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>All Risks</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Likelihood</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mitigations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRisks.map((risk) => (
                  <TableRow key={risk.id}>
                    <TableCell className="font-mono text-sm">{risk.id}</TableCell>
                    <TableCell className="font-medium">{risk.title}</TableCell>
                    <TableCell>{risk.category}</TableCell>
                    <TableCell><Badge variant={risk.likelihood === "High" ? "destructive" : "outline"}>{risk.likelihood}</Badge></TableCell>
                    <TableCell><Badge variant={risk.impact === "Critical" ? "destructive" : "outline"}>{risk.impact}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{risk.status}</Badge></TableCell>
                    <TableCell>{risk.mitigations}</TableCell>
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
