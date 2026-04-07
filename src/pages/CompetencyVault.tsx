import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Award, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

const expiryStatus = (date: string | null) => {
  if (!date) return "no_expiry";
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0) return "expired";
  if (days <= 60) return "expiring";
  return "current";
};

const statusBadge = (status: string) => {
  switch (status) {
    case "expired": return <Badge variant="destructive">Expired</Badge>;
    case "expiring": return <Badge className="bg-warning text-warning-foreground">Expiring Soon</Badge>;
    case "current": return <Badge className="bg-success text-success-foreground">Current</Badge>;
    default: return <Badge variant="outline">No Expiry</Badge>;
  }
};

export default function CompetencyVault() {
  const { user } = useAuth();
  const [typeFilter, setTypeFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");

  const { data: certifications = [], isLoading: certsLoading } = useQuery({
    queryKey: ["vault-certifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certifications")
        .select("*, user_profiles:user_id(full_name, email)")
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data.map((c: any) => ({
        ...c,
        record_type: c.qualification_type ?? "certification",
        staff_name: c.user_profiles?.full_name ?? "Unknown",
        staff_email: c.user_profiles?.email ?? "",
        expiry_status: expiryStatus(c.expiry_date),
      }));
    },
  });

  const { data: complianceRecords = [] } = useQuery({
    queryKey: ["vault-compliance-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_compliance_records")
        .select("*, user_profiles:staff_id(full_name, email)")
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data.map((r: any) => ({
        id: r.id,
        name: r.requirement_name,
        record_type: "compliance",
        staff_name: r.user_profiles?.full_name ?? "Unknown",
        staff_email: r.user_profiles?.email ?? "",
        issuer: null,
        issue_date: r.issue_date,
        expiry_date: r.expiry_date,
        status: r.status,
        expiry_status: expiryStatus(r.expiry_date),
      }));
    },
  });

  const allRecords = [...certifications, ...complianceRecords];

  const filtered = allRecords.filter(r => {
    if (typeFilter !== "all" && r.record_type !== typeFilter) return false;
    if (expiryFilter !== "all" && r.expiry_status !== expiryFilter) return false;
    return true;
  });

  const expiredCount = allRecords.filter(r => r.expiry_status === "expired").length;
  const expiringCount = allRecords.filter(r => r.expiry_status === "expiring").length;
  const currentCount = allRecords.filter(r => r.expiry_status === "current").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff Competency Vault</h1>
        <p className="text-muted-foreground">Qualifications, licences, inductions, and compliance records</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Records</CardTitle><Award className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{allRecords.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Current</CardTitle><CheckCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">{currentCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Expiring Soon</CardTitle><Clock className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">{expiringCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Expired</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{expiredCount}</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Type:</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="qualification">Qualification</SelectItem>
              <SelectItem value="licence">Licence</SelectItem>
              <SelectItem value="induction">Induction</SelectItem>
              <SelectItem value="certification">Certification</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Expiry:</Label>
          <Select value={expiryFilter} onValueChange={setExpiryFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="current">Current</SelectItem>
              <SelectItem value="expiring">Expiring Soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>All Competency Records</CardTitle></CardHeader>
        <CardContent>
          {certsLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : filtered.length === 0 ? <p className="text-center py-4 text-muted-foreground">No records found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Qualification/Cert</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Issuer</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow key={r.id} className={r.expiry_status === "expired" ? "bg-destructive/5" : r.expiry_status === "expiring" ? "bg-warning/5" : ""}>
                      <TableCell className="font-medium">{r.staff_name}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{r.record_type}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{r.issuer ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.issue_date ?? "—"}</TableCell>
                      <TableCell>{r.expiry_date ?? "—"}</TableCell>
                      <TableCell>{statusBadge(r.expiry_status)}</TableCell>
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
