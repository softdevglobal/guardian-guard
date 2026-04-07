import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { UserCog, AlertTriangle, CheckCircle, Plus, ShieldCheck, ShieldX, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays, parseISO } from "date-fns";
import { logAudit } from "@/lib/auditLog";

const clearanceBadge = (status: string) => {
  if (status === "current") return <Badge className="bg-success text-success-foreground capitalize">Current</Badge>;
  if (status === "expiring") return <Badge className="bg-warning text-warning-foreground capitalize">Expiring</Badge>;
  if (status === "expired") return <Badge variant="destructive" className="capitalize">Expired</Badge>;
  return <Badge variant="outline" className="capitalize">{status}</Badge>;
};

const expiryWarning = (date: string | null) => {
  if (!date) return null;
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0) return <span className="text-xs text-destructive font-medium">Expired {Math.abs(days)}d ago</span>;
  if (days <= 60) return <span className="text-xs text-warning font-medium">Expires in {days}d</span>;
  return <span className="text-xs text-muted-foreground">{format(parseISO(date), "PP")}</span>;
};

type StaffRecord = any;

export default function StaffCompliance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<StaffRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formUserId, setFormUserId] = useState("");
  const [formStartDate, setFormStartDate] = useState("");

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff-compliance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_compliance").select("*, user_profiles(full_name, email)");
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_profiles").select("id, full_name, email");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { id: string; [key: string]: any }) => {
      const { id, ...rest } = updates;
      const { error } = await supabase.from("staff_compliance").update(rest).eq("id", id);
      if (error) throw error;
      if (user) await logAudit("staff_compliance", "updated", id, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-compliance"] });
      toast({ title: "Compliance record updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formUserId) throw new Error("Select a staff member");
      const { error } = await supabase.from("staff_compliance").insert({
        user_id: formUserId,
        start_date: formStartDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-compliance"] });
      setDialogOpen(false);
      setFormUserId("");
      setFormStartDate("");
      toast({ title: "Staff compliance record created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const compliant = staff.filter(s => s.police_check_status === "current" && s.wwcc_status === "current" && s.worker_screening_status === "current").length;
  const expiring = staff.filter(s => [s.police_check_status, s.wwcc_status, s.worker_screening_status].includes("expiring")).length;
  const nonCompliant = staff.filter(s => [s.police_check_status, s.wwcc_status, s.worker_screening_status].includes("expired")).length;
  const blocked = staff.filter(s => !s.eligible_for_assignment).length;

  const toggleField = (id: string, field: string, value: boolean) => {
    updateMutation.mutate({ id, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Compliance</h1>
          <p className="text-muted-foreground">Clearances, training, conduct, and assignment eligibility</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="touch-target"><Plus className="mr-2 h-4 w-4" />Add Staff Record</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Staff Compliance Record</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
              <div className="space-y-2">
                <Label>Staff Member</Label>
                <Select value={formUserId} onValueChange={setFormUserId}>
                  <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Fully Compliant</CardTitle><CheckCircle className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold">{compliant}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Expiring Soon</CardTitle><Clock className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold">{expiring}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Non-Compliant</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{nonCompliant}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Blocked from Assignment</CardTitle><ShieldX className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{blocked}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Staff Members</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-4 text-muted-foreground">Loading...</p> : staff.length === 0 ? <p className="text-center py-4 text-muted-foreground">No staff records found</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Police Check</TableHead>
                  <TableHead>WWCC</TableHead>
                  <TableHead>Worker Screening</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Overall</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {staff.map(s => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(s)}>
                      <TableCell className="font-medium">{(s.user_profiles as any)?.full_name ?? "Unknown"}</TableCell>
                      <TableCell>{clearanceBadge(s.police_check_status)}</TableCell>
                      <TableCell>{clearanceBadge(s.wwcc_status)}</TableCell>
                      <TableCell>{clearanceBadge(s.worker_screening_status)}</TableCell>
                      <TableCell>{s.eligible_for_assignment ? <ShieldCheck className="h-4 w-4 text-success" /> : <ShieldX className="h-4 w-4 text-destructive" />}</TableCell>
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

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{(selected.user_profiles as any)?.full_name ?? "Staff Member"}</SheetTitle>
                <p className="text-sm text-muted-foreground">{(selected.user_profiles as any)?.email}</p>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Eligibility Banner */}
                {!selected.eligible_for_assignment && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
                    <p className="text-sm font-medium text-destructive flex items-center gap-2">
                      <ShieldX className="h-4 w-4" /> Not eligible for participant assignment
                    </p>
                    {selected.restrictions_notes && <p className="text-xs text-muted-foreground mt-1">{selected.restrictions_notes}</p>}
                  </div>
                )}

                {/* Clearances Section */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Clearances & Screening</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Police Check</span>
                      <div className="flex items-center gap-2">
                        {clearanceBadge(selected.police_check_status)}
                        {expiryWarning(selected.police_check_expiry)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">WWCC ({selected.wwcc_number || "No number"})</span>
                      <div className="flex items-center gap-2">
                        {clearanceBadge(selected.wwcc_status)}
                        {expiryWarning(selected.wwcc_expiry)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">NDIS Worker Screening</span>
                      <div className="flex items-center gap-2">
                        {clearanceBadge(selected.worker_screening_status)}
                        {expiryWarning(selected.worker_screening_expiry)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Identity Verification</span>
                      <Badge variant={selected.identity_verification ? "default" : "outline"}>{selected.identity_verification ? "Verified" : "Pending"}</Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Training & Induction */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Training & Induction</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Mandatory Induction", field: "mandatory_induction" },
                      { label: "Worker Orientation", field: "worker_orientation" },
                      { label: "Cyber Safety Training", field: "cyber_safety_completed" },
                      { label: "Incident Management Training", field: "incident_mgmt_training" },
                      { label: "Safeguarding Training", field: "safeguarding_training" },
                    ].map(item => (
                      <div key={item.field} className="flex items-center justify-between">
                        <Label className="text-sm">{item.label}</Label>
                        <Switch
                          checked={!!selected[item.field]}
                          onCheckedChange={val => {
                            toggleField(selected.id, item.field, val);
                            setSelected({ ...selected, [item.field]: val });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Code of Conduct */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Code of Conduct</h3>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Acknowledged</Label>
                    <Switch
                      checked={!!selected.code_of_conduct_acknowledged}
                      onCheckedChange={val => {
                        const updates: any = { code_of_conduct_acknowledged: val };
                        if (val) updates.code_of_conduct_date = new Date().toISOString().split("T")[0];
                        toggleField(selected.id, "code_of_conduct_acknowledged", val);
                        setSelected({ ...selected, ...updates });
                      }}
                    />
                  </div>
                  {selected.code_of_conduct_date && (
                    <p className="text-xs text-muted-foreground mt-1">Last acknowledged: {selected.code_of_conduct_date}</p>
                  )}
                </div>

                <Separator />

                {/* Clearance Updates */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Update Clearances</h3>
                  <div className="grid gap-3">
                    {[
                      { label: "Police Check Status", field: "police_check_status" },
                      { label: "WWCC Status", field: "wwcc_status" },
                      { label: "Worker Screening Status", field: "worker_screening_status" },
                    ].map(item => (
                      <div key={item.field} className="space-y-1">
                        <Label className="text-xs">{item.label}</Label>
                        <Select
                          value={selected[item.field]}
                          onValueChange={val => {
                            updateMutation.mutate({ id: selected.id, [item.field]: val });
                            setSelected({ ...selected, [item.field]: val });
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="current">Current</SelectItem>
                            <SelectItem value="expiring">Expiring</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Restrictions */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Assignment & Restrictions</h3>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm">Eligible for Participant Assignment</Label>
                    <Switch
                      checked={!!selected.eligible_for_assignment}
                      onCheckedChange={val => {
                        updateMutation.mutate({ id: selected.id, eligible_for_assignment: val });
                        setSelected({ ...selected, eligible_for_assignment: val });
                      }}
                    />
                  </div>
                  <Textarea
                    placeholder="Restrictions or notes..."
                    defaultValue={selected.restrictions_notes ?? ""}
                    onBlur={e => {
                      if (e.target.value !== (selected.restrictions_notes ?? "")) {
                        updateMutation.mutate({ id: selected.id, restrictions_notes: e.target.value });
                      }
                    }}
                    className="text-sm"
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
