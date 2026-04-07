import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

const mockComplaints = [
  { id: "CMP-001", subject: "Trainer did not follow support plan", submittedBy: "Participant - John D.", status: "Under Review", priority: "High", date: "2026-04-06" },
  { id: "CMP-002", subject: "Scheduling conflict not resolved", submittedBy: "Family Member", status: "Submitted", priority: "Medium", date: "2026-04-05" },
  { id: "CMP-003", subject: "Communication breakdown with staff", submittedBy: "Participant - Alice M.", status: "Investigating", priority: "High", date: "2026-04-03" },
  { id: "CMP-004", subject: "Feedback on training materials", submittedBy: "Staff - Mike Torres", status: "Resolved", priority: "Low", date: "2026-04-01" },
];

export default function Complaints() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Complaints Management</h1>
          <p className="text-muted-foreground">Track, investigate, and resolve complaints</p>
        </div>
        <Button className="touch-target">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Log Complaint
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All Complaints</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockComplaints.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.id}</TableCell>
                    <TableCell className="font-medium">{c.subject}</TableCell>
                    <TableCell>{c.submittedBy}</TableCell>
                    <TableCell><Badge variant={c.priority === "High" ? "destructive" : "outline"}>{c.priority}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{c.date}</TableCell>
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
