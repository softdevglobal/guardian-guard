import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface Participant {
  id: string;
  name: string;
  maskedName: string;
  riskScore: number;
  status: string;
  trainer: string;
  goalsCount: number;
  lastSession: string;
}

const mockParticipants: Participant[] = [
  { id: "P-001", name: "John Doe", maskedName: "John D.", riskScore: 35, status: "Active", trainer: "Sarah Chen", goalsCount: 4, lastSession: "2026-04-07" },
  { id: "P-002", name: "Alice Martin", maskedName: "Alice M.", riskScore: 72, status: "Active", trainer: "Sarah Chen", goalsCount: 3, lastSession: "2026-04-06" },
  { id: "P-003", name: "Robert Kim", maskedName: "Robert K.", riskScore: 15, status: "Active", trainer: "Emma Wilson", goalsCount: 5, lastSession: "2026-04-07" },
  { id: "P-004", name: "Maria Garcia", maskedName: "Maria G.", riskScore: 50, status: "On Hold", trainer: "Mike Torres", goalsCount: 2, lastSession: "2026-04-01" },
];

const getRiskColor = (score: number) => {
  if (score >= 70) return "text-destructive";
  if (score >= 40) return "text-warning";
  return "text-success";
};

export default function Participants() {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Participant Profiles</h1>
          <p className="text-muted-foreground">Outcome tracking with sensitive data masking</p>
        </div>
        <Button className="touch-target">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add Participant
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All Participants</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Goals</TableHead>
                  <TableHead>Last Session</TableHead>
                  <TableHead>Data Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockParticipants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.id}</TableCell>
                    <TableCell className="font-medium">
                      {revealed.has(p.id) ? p.name : p.maskedName}
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${getRiskColor(p.riskScore)}`}>{p.riskScore}</span>
                    </TableCell>
                    <TableCell><Badge variant={p.status === "Active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    <TableCell>{p.trainer}</TableCell>
                    <TableCell>{p.goalsCount}</TableCell>
                    <TableCell className="text-muted-foreground">{p.lastSession}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleReveal(p.id)}
                        className="touch-target"
                        aria-label={revealed.has(p.id) ? "Mask data" : "Reveal data"}
                      >
                        {revealed.has(p.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </TableCell>
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
