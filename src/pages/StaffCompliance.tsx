import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, UserCog, AlertTriangle, CheckCircle } from "lucide-react";

const mockStaff = [
  { id: "STF-001", name: "Sarah Chen", role: "Trainer", policeCheck: "Current", wwcc: "Current", training: 100, nextExpiry: "2026-09-15" },
  { id: "STF-002", name: "Mike Torres", role: "Trainer", policeCheck: "Current", wwcc: "Expiring", training: 85, nextExpiry: "2026-05-01" },
  { id: "STF-003", name: "Emma Wilson", role: "Support Worker", policeCheck: "Current", wwcc: "Current", training: 60, nextExpiry: "2026-12-20" },
  { id: "STF-004", name: "James Patel", role: "Supervisor", policeCheck: "Expired", wwcc: "Current", training: 90, nextExpiry: "2026-04-01" },
  { id: "STF-005", name: "Lisa Zhang", role: "Trainer", policeCheck: "Current", wwcc: "Current", training: 100, nextExpiry: "2027-01-10" },
];

const clearanceColor = (status: string) => {
  if (status === "Current") return "default" as const;
  if (status === "Expiring") return "outline" as const;
  return "destructive" as const;
};

export default function StaffCompliance() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Compliance</h1>
          <p className="text-muted-foreground">Clearances, training, and certification tracking</p>
        </div>
        <Button className="touch-target">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add Staff Member
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fully Compliant</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">3</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">1</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Non-Compliant</CardTitle>
            <UserCog className="h-4 w-4 text-destructive" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">1</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Staff Members</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Police Check</TableHead>
                  <TableHead>WWCC</TableHead>
                  <TableHead>Training</TableHead>
                  <TableHead>Next Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockStaff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.id}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.role}</TableCell>
                    <TableCell><Badge variant={clearanceColor(s.policeCheck)}>{s.policeCheck}</Badge></TableCell>
                    <TableCell><Badge variant={clearanceColor(s.wwcc)}>{s.wwcc}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={s.training} className="h-2 w-20" />
                        <span className="text-sm">{s.training}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.nextExpiry}</TableCell>
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
