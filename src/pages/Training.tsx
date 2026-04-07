import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GraduationCap, Clock, CheckCircle, AlertTriangle, ShieldX, Search,
  Upload, FileText, XCircle, Filter, ArrowLeft, RefreshCw, Loader2, Plus
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { logAudit } from "@/lib/auditLog";
import { evaluateStaffEligibility, RECORD_STATUS_BADGE } from "@/lib/staffEligibility";

interface TrainingRequirement {
  id: string;
  training_code: string;
  training_name: string;
  description: string | null;
  is_mandatory: boolean;
  validity_months: number | null;
  min_pass_score: number;
  required_for_roles: unknown;
}

interface TrainingCompletion {
  id: string;
  user_id: string;
  module_id: string;
  training_code: string | null;
  completion_date: string | null;
  score: number | null;
  status: string;
  expiry_date: string | null;
  evidence_file_url: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  assessment_passed: boolean;
  created_at: string;
  updated_at: string;
}

const TRAINING_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  missing: { label: "Missing", className: "bg-muted text-muted-foreground" },
  enrolled: { label: "Enrolled", className: "bg-secondary text-secondary-foreground" },
  completed: { label: "Completed", className: "bg-primary/20 text-primary" },
  verified: { label: "Verified", className: "bg-success text-success-foreground" },
  expired: { label: "Expired", className: "bg-destructive text-destructive-foreground" },
  rejected: { label: "Rejected", className: "bg-destructive text-destructive-foreground" },
  expiring_soon: { label: "Expiring Soon", className: "bg-warning text-warning-foreground" },
};

export default function Training() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("dashboard");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [requirementDialogOpen, setRequirementDialogOpen] = useState(false);

  const isAdmin = user?.role && ["super_admin", "compliance_officer", "hr_admin"].includes(user.role);

  // Training requirements
  const { data: requirements = [] } = useQuery({
    queryKey: ["training-requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_requirements")
        .select("*")
        .order("training_name");
      if (error) throw error;
      return data as unknown as TrainingRequirement[];
    },
  });

  // All staff profiles
  const { data: staffList = [], isLoading: staffLoading } = useQuery({
    queryKey: ["training-staff-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, organisation_id")
        .order("full_name");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: completions } = await supabase
        .from("training_completions")
        .select("user_id, training_code, status, verified_by, expiry_date, score");

      return (profiles ?? []).map(p => {
        const role = roles?.find(r => r.user_id === p.id);
        const staffCompletions = (completions ?? []).filter(c => c.user_id === p.id);
        const mandatoryReqs = requirements.filter(r => r.is_mandatory);
        const verifiedCount = mandatoryReqs.filter(req =>
          staffCompletions.some(c =>
            c.training_code === req.training_code &&
            c.status === "completed" &&
            c.verified_by
          )
        ).length;

        const expiredCount = mandatoryReqs.filter(req =>
          staffCompletions.some(c =>
            c.training_code === req.training_code &&
            c.expiry_date && new Date(c.expiry_date) < new Date()
          )
        ).length;

        const compliancePct = mandatoryReqs.length > 0
          ? Math.round((verifiedCount / mandatoryReqs.length) * 100)
          : 0;

        let trainingStatus: string;
        if (expiredCount > 0) trainingStatus = "non_compliant";
        else if (verifiedCount >= mandatoryReqs.length && mandatoryReqs.length > 0) trainingStatus = "compliant";
        else if (verifiedCount > 0) trainingStatus = "partial";
        else trainingStatus = "non_compliant";

        return {
          ...p,
          role: role?.role ?? "support_worker",
          compliance_pct: compliancePct,
          verified_count: verifiedCount,
          total_required: mandatoryReqs.length,
          expired_count: expiredCount,
          training_status: trainingStatus,
        };
      });
    },
    enabled: requirements.length > 0,
  });

  // Stats
  const stats = useMemo(() => {
    const compliant = staffList.filter(s => s.training_status === "compliant").length;
    const partial = staffList.filter(s => s.training_status === "partial").length;
    const nonCompliant = staffList.filter(s => s.training_status === "non_compliant").length;
    const expiredTraining = staffList.filter(s => s.expired_count > 0).length;
    return { total: staffList.length, compliant, partial, nonCompliant, expiredTraining };
  }, [staffList]);

  const filteredStaff = staffList.filter(s =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedStaffId) {
    return (
      <StaffTrainingDetail
        staffId={selectedStaffId}
        requirements={requirements}
        onBack={() => setSelectedStaffId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Compliance</h1>
          <p className="text-muted-foreground">Competency enforcement, verification workflows, and NDIS training register</p>
        </div>
        {isAdmin && (
          <RequirementDialog
            open={requirementDialogOpen}
            onOpenChange={setRequirementDialogOpen}
            onCreated={() => queryClient.invalidateQueries({ queryKey: ["training-requirements"] })}
          />
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="requirements">Requirements ({requirements.length})</TabsTrigger>
          <TabsTrigger value="register">Staff Register</TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <div className="grid gap-4 sm:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Fully Trained</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-success">{stats.compliant}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Partially Trained</CardTitle>
                <Clock className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-warning">{stats.partial}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Non-Compliant</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-destructive">{stats.nonCompliant}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Expired Training</CardTitle>
                <ShieldX className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-destructive">{stats.expiredTraining}</div></CardContent>
            </Card>
          </div>

          {/* Staff Training Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Staff Training Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search staff..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              {staffLoading ? (
                <p className="text-center py-4 text-muted-foreground">Loading...</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Training Progress</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expired</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStaff.map(s => (
                        <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedStaffId(s.id)}>
                          <TableCell>
                            <p className="font-medium">{s.full_name}</p>
                            <p className="text-xs text-muted-foreground">{s.email}</p>
                          </TableCell>
                          <TableCell className="capitalize text-sm">{(s.role as string).replace(/_/g, " ")}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={s.compliance_pct} className="h-2 w-20" />
                              <span className="text-sm">{s.verified_count}/{s.total_required}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              s.training_status === "compliant" ? "default" :
                              s.training_status === "partial" ? "outline" : "destructive"
                            } className="capitalize">
                              {s.training_status === "non_compliant" ? "Non-Compliant" : s.training_status === "partial" ? "Partial" : "Compliant"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {s.expired_count > 0 && (
                              <Badge variant="destructive">{s.expired_count} expired</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requirements */}
        <TabsContent value="requirements" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Training Requirements</CardTitle></CardHeader>
            <CardContent>
              {requirements.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No training requirements configured</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Training</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Mandatory</TableHead>
                        <TableHead>Validity</TableHead>
                        <TableHead>Min Score</TableHead>
                        <TableHead>Roles</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requirements.map(r => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <p className="font-medium">{r.training_name}</p>
                            {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                          </TableCell>
                          <TableCell><code className="text-xs">{r.training_code}</code></TableCell>
                          <TableCell>
                            <Badge variant={r.is_mandatory ? "destructive" : "secondary"}>
                              {r.is_mandatory ? "Required" : "Optional"}
                            </Badge>
                          </TableCell>
                          <TableCell>{r.validity_months ? `${r.validity_months} months` : "No expiry"}</TableCell>
                          <TableCell>{r.min_pass_score > 0 ? `${r.min_pass_score}%` : "—"}</TableCell>
                          <TableCell>
                            {Array.isArray(r.required_for_roles) && (r.required_for_roles as string[]).length > 0
                              ? (r.required_for_roles as string[]).map(role => (
                                  <Badge key={role} variant="outline" className="mr-1 text-xs capitalize">{role.replace(/_/g, " ")}</Badge>
                                ))
                              : <span className="text-xs text-muted-foreground">All roles</span>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Register */}
        <TabsContent value="register" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Training Compliance Register</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Staff</TableHead>
                      {requirements.filter(r => r.is_mandatory).map(r => (
                        <TableHead key={r.training_code} className="text-center text-xs min-w-[100px]">
                          {r.training_name.split(" ").slice(0, 2).join(" ")}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map(s => (
                      <RegisterRow key={s.id} staff={s} requirements={requirements.filter(r => r.is_mandatory)} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Register row — fetches completions per staff member
function RegisterRow({ staff, requirements }: { staff: any; requirements: TrainingRequirement[] }) {
  const { data: completions = [] } = useQuery({
    queryKey: ["training-completions-register", staff.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_completions")
        .select("training_code, status, verified_by, expiry_date, score")
        .eq("user_id", staff.id);
      return data ?? [];
    },
  });

  return (
    <TableRow>
      <TableCell className="sticky left-0 bg-background z-10">
        <p className="font-medium text-sm">{staff.full_name}</p>
      </TableCell>
      {requirements.map(req => {
        const comp = completions.find((c: any) => c.training_code === req.training_code);
        let status = "missing";
        if (comp) {
          if (comp.verified_by && comp.status === "completed") {
            if (comp.expiry_date && new Date(comp.expiry_date) < new Date()) status = "expired";
            else status = "verified";
          } else if (comp.status === "completed") status = "completed";
          else status = comp.status;
        }
        const badge = TRAINING_STATUS_BADGE[status] ?? TRAINING_STATUS_BADGE.missing;
        return (
          <TableCell key={req.training_code} className="text-center">
            <Badge className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
          </TableCell>
        );
      })}
    </TableRow>
  );
}

// Staff Training Detail View
function StaffTrainingDetail({ staffId, requirements, onBack }: {
  staffId: string;
  requirements: TrainingRequirement[];
  onBack: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedCompletion, setSelectedCompletion] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  const isAdmin = user?.role && ["super_admin", "compliance_officer", "hr_admin"].includes(user.role);
  const isSelf = user?.id === staffId;

  const { data: profile } = useQuery({
    queryKey: ["training-staff-profile", staffId],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("id", staffId).single();
      return data;
    },
  });

  const { data: roleData } = useQuery({
    queryKey: ["training-staff-role", staffId],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", staffId).limit(1).single();
      return data;
    },
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["training-completions", staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_completions")
        .select("*")
        .eq("user_id", staffId)
        .order("updated_at", { ascending: false });
      return (data ?? []) as unknown as TrainingCompletion[];
    },
  });

  const checklist = requirements.map(req => {
    const comp = completions.find(c => c.training_code === req.training_code && c.status === "completed" && c.verified_by)
      ?? completions.find(c => c.training_code === req.training_code && c.status === "completed")
      ?? completions.find(c => c.training_code === req.training_code);

    let status = "missing";
    if (comp) {
      if (comp.verified_by && comp.status === "completed") {
        if (comp.expiry_date && new Date(comp.expiry_date) < new Date()) status = "expired";
        else if (comp.expiry_date && differenceInDays(new Date(comp.expiry_date), new Date()) <= 60) status = "expiring_soon";
        else status = "verified";
      } else if (comp.status === "completed") status = "completed";
      else if (comp.rejection_reason) status = "rejected";
      else status = comp.status;
    }

    return { ...req, completion: comp, displayStatus: status };
  });

  const verifiedCount = checklist.filter(c => c.displayStatus === "verified").length;
  const mandatoryCount = checklist.filter(c => c.is_mandatory).length;

  // Record training completion
  const submitMutation = useMutation({
    mutationFn: async (params: {
      trainingCode: string; moduleId?: string; score?: number;
      completionDate: string; expiryDate?: string; file?: File;
    }) => {
      if (!user) throw new Error("Not authenticated");
      let fileUrl: string | null = null;
      if (params.file) {
        const ext = params.file.name.split(".").pop() || "pdf";
        const path = `${staffId}/training/${params.trainingCode}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("form-attachments").upload(path, params.file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("form-attachments").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      // Find training module to link
      const { data: modules } = await supabase.from("training_modules").select("id").limit(1);
      const moduleId = params.moduleId || modules?.[0]?.id;

      const insertData: Record<string, unknown> = {
        user_id: staffId,
        module_id: moduleId,
        training_code: params.trainingCode,
        status: "completed",
        score: params.score ?? null,
        completion_date: params.completionDate,
        expiry_date: params.expiryDate || null,
        evidence_file_url: fileUrl,
        assessment_passed: params.score ? params.score >= (requirements.find(r => r.training_code === params.trainingCode)?.min_pass_score ?? 0) : false,
        organisation_id: user.organisation_id,
      };
      const { error } = await supabase.from("training_completions").insert(insertData as any);
      if (error) throw error;

      await logAudit({
        action: "training_completion_recorded",
        module: "training_completions",
        record_id: staffId,
        details: { training_code: params.trainingCode },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-completions", staffId] });
      queryClient.invalidateQueries({ queryKey: ["training-staff-list"] });
      setUploadOpen(false);
      toast({ title: "Training completion recorded" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Verify training
  const verifyMutation = useMutation({
    mutationFn: async ({ completionId, action, reason }: { completionId: string; action: "verify" | "reject"; reason?: string }) => {
      if (!user) throw new Error("Not authenticated");
      if (action === "reject" && !reason?.trim()) throw new Error("Rejection reason is required");

      const update: Record<string, unknown> = action === "verify"
        ? { verified_by: user.id, verified_at: new Date().toISOString(), assessment_passed: true }
        : { rejection_reason: reason, verified_by: user.id, verified_at: new Date().toISOString() };

      const { error } = await supabase.from("training_completions").update(update).eq("id", completionId);
      if (error) throw error;

      await logAudit({
        action: action === "verify" ? "training_verified" : "training_rejected",
        module: "training_completions",
        record_id: staffId,
        details: { completion_id: completionId, action, reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-completions", staffId] });
      queryClient.invalidateQueries({ queryKey: ["training-staff-list"] });
      setRejectDialogOpen(false);
      setSelectedCompletion(null);
      setRejectReason("");
      toast({ title: "Training record updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Re-evaluate
  const evaluateMutation = useMutation({
    mutationFn: () => evaluateStaffEligibility(staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-staff-list"] });
      toast({ title: "Eligibility re-evaluated" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{profile?.full_name ?? "Staff Member"}</h1>
          <p className="text-muted-foreground">{profile?.email} · {(roleData?.role ?? "support_worker").replace(/_/g, " ")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => evaluateMutation.mutate()} disabled={evaluateMutation.isPending}>
          {evaluateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Re-evaluate
        </Button>
      </div>

      {/* Training Progress Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Training Compliance: {verifiedCount}/{mandatoryCount} mandatory verified</span>
            <Badge variant={verifiedCount >= mandatoryCount && mandatoryCount > 0 ? "default" : "destructive"}>
              {verifiedCount >= mandatoryCount && mandatoryCount > 0 ? "Compliant" : "Non-Compliant"}
            </Badge>
          </div>
          <Progress value={mandatoryCount > 0 ? (verifiedCount / mandatoryCount) * 100 : 0} className="h-3" />
        </CardContent>
      </Card>

      {/* Training Checklist */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Training Checklist</CardTitle>
          {(isAdmin || isSelf) && (
            <TrainingUploadDialog
              open={uploadOpen}
              onOpenChange={setUploadOpen}
              requirements={requirements}
              onSubmit={data => submitMutation.mutate(data)}
              isPending={submitMutation.isPending}
            />
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Training</TableHead>
                  <TableHead>Mandatory</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Verified</TableHead>
                  {isAdmin && !isSelf && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {checklist.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-4">No requirements configured</TableCell></TableRow>
                ) : (
                  checklist.map(item => {
                    const badge = TRAINING_STATUS_BADGE[item.displayStatus] ?? TRAINING_STATUS_BADGE.missing;
                    const expiryDays = item.completion?.expiry_date
                      ? differenceInDays(new Date(item.completion.expiry_date), new Date())
                      : null;
                    const scorePass = item.min_pass_score > 0 && item.completion?.score != null
                      ? item.completion.score >= item.min_pass_score
                      : null;

                    return (
                      <TableRow key={item.training_code}>
                        <TableCell>
                          <p className="font-medium text-sm">{item.training_name}</p>
                          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.is_mandatory ? "destructive" : "secondary"} className="text-xs">
                            {item.is_mandatory ? "Required" : "Optional"}
                          </Badge>
                        </TableCell>
                        <TableCell><Badge className={badge.className}>{badge.label}</Badge></TableCell>
                        <TableCell>
                          {item.completion?.score != null ? (
                            <span className={`text-sm font-medium ${scorePass === false ? "text-destructive" : scorePass ? "text-success" : ""}`}>
                              {item.completion.score}%
                              {item.min_pass_score > 0 && <span className="text-xs text-muted-foreground"> (min {item.min_pass_score}%)</span>}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.completion?.completion_date ? format(new Date(item.completion.completion_date), "PP") : "—"}
                        </TableCell>
                        <TableCell>
                          {item.completion?.expiry_date ? (
                            <div>
                              <span className="text-sm">{format(new Date(item.completion.expiry_date), "PP")}</span>
                              {expiryDays !== null && expiryDays < 0 && (
                                <p className="text-xs text-destructive font-medium">Expired {Math.abs(expiryDays)}d ago</p>
                              )}
                              {expiryDays !== null && expiryDays >= 0 && expiryDays <= 60 && (
                                <p className="text-xs text-warning font-medium">Expires in {expiryDays}d</p>
                              )}
                            </div>
                          ) : item.validity_months ? (
                            <span className="text-xs text-muted-foreground">Valid {item.validity_months}mo</span>
                          ) : "No expiry"}
                        </TableCell>
                        <TableCell>
                          {item.completion?.evidence_file_url ? (
                            <a href={item.completion.evidence_file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1">
                              <FileText className="h-3 w-3" />View
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.completion?.verified_by ? (
                            <div>
                              <CheckCircle className="h-3 w-3 text-success inline mr-1" />
                              {item.completion.verified_at && <span className="text-xs">{format(new Date(item.completion.verified_at), "PP")}</span>}
                            </div>
                          ) : item.completion?.rejection_reason ? (
                            <div>
                              <XCircle className="h-3 w-3 text-destructive inline mr-1" />
                              <span className="text-xs text-destructive">{item.completion.rejection_reason}</span>
                            </div>
                          ) : "—"}
                        </TableCell>
                        {isAdmin && !isSelf && (
                          <TableCell>
                            {item.completion?.status === "completed" && !item.completion?.verified_by && !item.completion?.rejection_reason && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="h-7 text-xs"
                                  onClick={() => verifyMutation.mutate({ completionId: item.completion!.id, action: "verify" })}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />Verify
                                </Button>
                                <Button size="sm" variant="destructive" className="h-7 text-xs"
                                  onClick={() => { setSelectedCompletion(item.completion); setRejectDialogOpen(true); }}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Training Completion</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Training: <strong>{selectedCompletion?.training_code}</strong></p>
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain why this is being rejected..." required />
            </div>
            <Button variant="destructive" className="w-full"
              disabled={verifyMutation.isPending || !rejectReason.trim()}
              onClick={() => selectedCompletion && verifyMutation.mutate({ completionId: selectedCompletion.id, action: "reject", reason: rejectReason })}
            >
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Training Upload Dialog
function TrainingUploadDialog({ open, onOpenChange, requirements, onSubmit, isPending }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requirements: TrainingRequirement[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [trainingCode, setTrainingCode] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [score, setScore] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const selectedReq = requirements.find(r => r.training_code === trainingCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Upload className="h-4 w-4 mr-1" />Record Training</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Training Completion</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={e => {
          e.preventDefault();
          if (!trainingCode || !completionDate) return;
          onSubmit({
            trainingCode,
            score: score ? parseFloat(score) : undefined,
            completionDate,
            expiryDate: expiryDate || undefined,
            file: file ?? undefined,
          });
        }}>
          <div className="space-y-2">
            <Label>Training *</Label>
            <Select value={trainingCode} onValueChange={setTrainingCode}>
              <SelectTrigger><SelectValue placeholder="Select training" /></SelectTrigger>
              <SelectContent>
                {requirements.map(r => (
                  <SelectItem key={r.training_code} value={r.training_code}>{r.training_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Completion Date *</Label><Input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
          </div>
          {selectedReq && selectedReq.min_pass_score > 0 && (
            <div className="space-y-2">
              <Label>Assessment Score (min {selectedReq.min_pass_score}%)</Label>
              <Input type="number" min="0" max="100" value={score} onChange={e => setScore(e.target.value)} placeholder="Enter score %" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Evidence / Certificate</Label>
            <Input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button type="submit" className="w-full" disabled={isPending || !trainingCode || !completionDate}>
            {isPending ? "Submitting..." : "Record Completion"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Add Requirement Dialog
function RequirementDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    training_code: "", training_name: "", description: "",
    is_mandatory: true, validity_months: "", min_pass_score: "0",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("training_requirements").insert({
        organisation_id: user.organisation_id,
        training_code: form.training_code.toUpperCase().replace(/\s+/g, "_"),
        training_name: form.training_name,
        description: form.description || null,
        is_mandatory: form.is_mandatory,
        validity_months: form.validity_months ? parseInt(form.validity_months) : null,
        min_pass_score: parseFloat(form.min_pass_score) || 0,
        required_for_roles: "[]",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      onCreated();
      onOpenChange(false);
      setForm({ training_code: "", training_name: "", description: "", is_mandatory: true, validity_months: "", min_pass_score: "0" });
      toast({ title: "Training requirement created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Requirement</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Training Requirement</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Training Code *</Label><Input value={form.training_code} onChange={e => setForm(f => ({ ...f, training_code: e.target.value }))} placeholder="e.g. FIRE_SAFETY" required /></div>
            <div className="space-y-2"><Label>Training Name *</Label><Input value={form.training_name} onChange={e => setForm(f => ({ ...f, training_name: e.target.value }))} required /></div>
          </div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Mandatory</Label>
              <Select value={form.is_mandatory ? "yes" : "no"} onValueChange={v => setForm(f => ({ ...f, is_mandatory: v === "yes" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Validity (months)</Label><Input type="number" value={form.validity_months} onChange={e => setForm(f => ({ ...f, validity_months: e.target.value }))} placeholder="e.g. 12" /></div>
            <div className="space-y-2"><Label>Min Score %</Label><Input type="number" min="0" max="100" value={form.min_pass_score} onChange={e => setForm(f => ({ ...f, min_pass_score: e.target.value }))} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Create Requirement"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
