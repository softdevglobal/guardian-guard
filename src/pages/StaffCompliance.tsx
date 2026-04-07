import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Search, CheckCircle, Clock, AlertTriangle, ShieldX, UserCog, Filter } from "lucide-react";
import { ELIGIBILITY_BADGE_MAP } from "@/lib/staffEligibility";
import StaffComplianceDetail from "@/components/staff/StaffComplianceDetail";

export default function StaffCompliance() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Get all user profiles with their eligibility
  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ["staff-compliance-list"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, team_id, organisation_id")
        .order("full_name");
      if (error) throw error;

      // Get eligibility for all
      const { data: eligibility } = await supabase
        .from("staff_eligibility_status")
        .select("*");

      // Get roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Get compliance records count
      const { data: records } = await supabase
        .from("staff_compliance_records")
        .select("staff_id, status");

      // Get requirements count for org
      const { data: requirements } = await supabase
        .from("staff_compliance_requirements")
        .select("requirement_code");

      const reqCount = new Set(requirements?.map(r => r.requirement_code) ?? []).size;

      return (profiles ?? []).map(p => {
        const elig = eligibility?.find(e => e.staff_id === p.id);
        const role = roles?.find(r => r.user_id === p.id);
        const staffRecords = records?.filter(r => r.staff_id === p.id) ?? [];
        const verifiedCount = staffRecords.filter(r => r.status === "verified").length;
        const compliancePct = reqCount > 0 ? Math.round((verifiedCount / reqCount) * 100) : 0;

        return {
          ...p,
          role: role?.role ?? "support_worker",
          eligibility_status: elig?.eligibility_status ?? "non_compliant",
          is_eligible: elig?.is_eligible_for_assignment ?? false,
          reason_summary: elig?.reason_summary ?? "Not evaluated",
          compliance_pct: compliancePct,
          last_evaluated_at: elig?.last_evaluated_at,
        };
      });
    },
  });

  const filtered = staffList.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.eligibility_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const compliantCount = staffList.filter(s => s.eligibility_status === "compliant").length;
  const expiringCount = staffList.filter(s => s.eligibility_status === "expiring_soon").length;
  const nonCompliantCount = staffList.filter(s => s.eligibility_status === "non_compliant").length;
  const suspendedCount = staffList.filter(s => s.eligibility_status === "suspended").length;
  const blockedCount = staffList.filter(s => !s.is_eligible).length;

  if (selectedStaffId) {
    return (
      <StaffComplianceDetail
        staffId={selectedStaffId}
        onBack={() => setSelectedStaffId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff Compliance</h1>
        <p className="text-muted-foreground">Eligibility enforcement, clearance tracking, and compliance verification</p>
      </div>

      {/* Summary Cards */}
      <section aria-label="Compliance summary" className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{staffList.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Compliant</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" aria-hidden />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{compliantCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-warning" aria-hidden />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{expiringCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Non-Compliant</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{nonCompliantCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            <ShieldX className="h-4 w-4 text-destructive" aria-hidden />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{blockedCount}</div></CardContent>
        </Card>
      </section>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input placeholder="Search by name or email..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <Filter className="mr-2 h-4 w-4" aria-hidden /><SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="compliant">Compliant</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardHeader><CardTitle>Staff Members ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-4 text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No staff members found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Eligibility</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Compliance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => {
                    const badge = ELIGIBILITY_BADGE_MAP[s.eligibility_status] ?? ELIGIBILITY_BADGE_MAP.non_compliant;
                    return (
                      <TableRow
                        key={s.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedStaffId(s.id)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{s.full_name}</p>
                            <p className="text-xs text-muted-foreground">{s.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-sm">{(s.role as string).replace(/_/g, " ")}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant} className="capitalize">{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {s.is_eligible ? (
                            <Badge className="bg-success text-success-foreground">Eligible</Badge>
                          ) : (
                            <Badge variant="destructive">Blocked</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={s.compliance_pct} className="h-2 w-20" />
                            <span className="text-sm">{s.compliance_pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
