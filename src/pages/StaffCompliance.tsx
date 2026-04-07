import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCog, AlertTriangle, CheckCircle } from "lucide-react";

const clearanceColor = (status: string) => {
  if (status === "current") return "default" as const;
  if (status === "expiring") return "outline" as const;
  return "destructive" as const;
};

export default function StaffCompliance() {
  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff-compliance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_compliance").select("*, user_profiles(full_name, email)");
      if (error) throw error;
      return data;
    },
  });

  const compliant = staff.filter(s => s.police_check_status === "current" && s.wwcc_status === "current").length;
  const expiring = staff.filter(s => s.police_check_status === "expiring" || s.wwcc_status === "expiring").length;
  const nonCompliant = staff.filter(s => s.police_check_status === "expired" || s.wwcc_status === "expired").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff Compliance</h1>
        <p className="text-muted-foreground">Clearances, training, and certification tracking</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Fully Compliant</CardTitle><CheckCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">{compliant}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Expiring Soon</CardTitle><AlertTriangle className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">{expiring}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Non-Compliant</CardTitle><UserCog className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{nonCompliant}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Staff Members</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : staff.length === 0 ? <p className="text-center py-4 text-muted-foreground">No staff records found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Police Check</TableHead><TableHead>WWCC</TableHead><TableHead>Worker Screening</TableHead><TableHead>Overall</TableHead></TableRow></TableHeader>
                <TableBody>
                  {staff.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{(s.user_profiles as any)?.full_name ?? "Unknown"}</TableCell>
                      <TableCell><Badge variant={clearanceColor(s.police_check_status)} className="capitalize">{s.police_check_status}</Badge></TableCell>
                      <TableCell><Badge variant={clearanceColor(s.wwcc_status)} className="capitalize">{s.wwcc_status}</Badge></TableCell>
                      <TableCell><Badge variant={clearanceColor(s.worker_screening_status)} className="capitalize">{s.worker_screening_status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={s.overall_compliance_pct ?? 0} className="h-2 w-20" />
                          <span className="text-sm">{s.overall_compliance_pct ?? 0}%</span>
                        </div>
                      </TableCell>
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
