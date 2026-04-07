import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, ShieldCheck, ShieldX, Upload, CheckCircle, XCircle,
  AlertTriangle, Clock, FileText, RefreshCw, Loader2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { logAudit } from "@/lib/auditLog";
import { evaluateStaffEligibility, ELIGIBILITY_BADGE_MAP, RECORD_STATUS_BADGE } from "@/lib/staffEligibility";

interface Props {
  staffId: string;
  onBack: () => void;
}

export default function StaffComplianceDetail({ staffId, onBack }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [conductDialogOpen, setConductDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role && ["super_admin", "compliance_officer", "hr_admin"].includes(user.role);
  const isSelf = user?.id === staffId;

  // Staff profile
  const { data: profile } = useQuery({
    queryKey: ["staff-profile", staffId],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("id", staffId).single();
      return data;
    },
  });

  // Role
  const { data: roleData } = useQuery({
    queryKey: ["staff-role", staffId],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", staffId).limit(1).single();
      return data;
    },
  });

  // Eligibility
  const { data: eligibility } = useQuery({
    queryKey: ["staff-eligibility", staffId],
    queryFn: async () => {
      const { data } = await supabase.from("staff_eligibility_status").select("*").eq("staff_id", staffId).maybeSingle();
      return data;
    },
  });

  // Requirements for the org
  const { data: requirements = [] } = useQuery({
    queryKey: ["staff-requirements"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_compliance_requirements").select("*").order("requirement_name");
      return data ?? [];
    },
  });

  // Compliance records
  const { data: records = [] } = useQuery({
    queryKey: ["staff-records", staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_compliance_records")
        .select("*")
        .eq("staff_id", staffId)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  // Conduct events
  const { data: conductEvents = [] } = useQuery({
    queryKey: ["staff-conduct", staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_conduct_events")
        .select("*")
        .eq("staff_id", staffId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Audit logs for this staff member's compliance
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["staff-audit", staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("module", "staff_compliance_records")
        .eq("record_id", staffId)
        .order("created_at", { ascending: false })
        .limit(50);
      // Also get records that reference this staff in details
      const { data: data2 } = await supabase
        .from("audit_logs")
        .select("*")
        .in("module", ["staff_compliance_records", "staff_conduct_events"])
        .order("created_at", { ascending: false })
        .limit(100);
      // Filter by staff_id in details
      const filtered = (data2 ?? []).filter(log => {
        const details = log.details as any;
        return details?.new?.staff_id === staffId || details?.staff_id === staffId || log.record_id === staffId;
      });
      return filtered.slice(0, 50);
    },
  });

  // Re-evaluate eligibility
  const evaluateMutation = useMutation({
    mutationFn: async () => {
      await evaluateStaffEligibility(staffId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-eligibility", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staff-compliance-list"] });
      toast({ title: "Eligibility re-evaluated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Upload compliance document
  const uploadMutation = useMutation({
    mutationFn: async ({ requirementCode, requirementName, file, issueDate, expiryDate }: {
      requirementCode: string; requirementName: string; file?: File; issueDate?: string; expiryDate?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      let fileUrl: string | null = null;

      if (file) {
        const ext = file.name.split(".").pop() || "pdf";
        const path = `${user.id}/compliance/${requirementCode}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("form-attachments").upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("form-attachments").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("staff_compliance_records").insert({
        staff_id: staffId,
        organisation_id: user.organisation_id!,
        requirement_code: requirementCode,
        requirement_name: requirementName,
        status: "pending_review",
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        uploaded_file_url: fileUrl,
      } as any);
      if (error) throw error;

      await logAudit({
        action: "compliance_document_uploaded",
        module: "staff_compliance_records",
        record_id: staffId,
        details: { requirement_code: requirementCode, requirement_name: requirementName },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-records", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staff-eligibility", staffId] });
      setUploadDialogOpen(false);
      toast({ title: "Document uploaded for review" });
    },
    onError: (err: any) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  // Verify or reject
  const verifyMutation = useMutation({
    mutationFn: async ({ recordId, action, reason }: { recordId: string; action: "verify" | "reject"; reason?: string }) => {
      if (!user) throw new Error("Not authenticated");
      if (action === "reject" && !reason?.trim()) throw new Error("Rejection reason is required");

      const update: any = action === "verify"
        ? { status: "verified", verified_by: user.id, verified_at: new Date().toISOString() }
        : { status: "rejected", verified_by: user.id, verified_at: new Date().toISOString(), rejection_reason: reason };

      const { error } = await supabase.from("staff_compliance_records").update(update).eq("id", recordId);
      if (error) throw error;

      await logAudit({
        action: action === "verify" ? "compliance_record_verified" : "compliance_record_rejected",
        module: "staff_compliance_records",
        record_id: staffId,
        details: { record_id: recordId, action, reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-records", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staff-eligibility", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staff-compliance-list"] });
      setVerifyDialogOpen(false);
      setSelectedRecord(null);
      setRejectReason("");
      toast({ title: "Record updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Add conduct event
  const conductMutation = useMutation({
    mutationFn: async (params: { event_type: string; description: string; action_taken: string; source_type: string; source_record_id?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("staff_conduct_events").insert({
        staff_id: staffId,
        organisation_id: user.organisation_id!,
        created_by: user.id,
        ...params,
      } as any);
      if (error) throw error;
      await logAudit({
        action: "conduct_event_created",
        module: "staff_conduct_events",
        record_id: staffId,
        details: params,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-conduct", staffId] });
      setConductDialogOpen(false);
      toast({ title: "Conduct event recorded" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Build compliance checklist: one row per unique requirement
  const uniqueReqs = [...new Set(requirements.map(r => r.requirement_code))];
  const checklist = uniqueReqs.map(code => {
    const req = requirements.find(r => r.requirement_code === code)!;
    const record = records.find(r => r.requirement_code === code && ["verified", "pending_review", "expiring_soon"].includes(r.status))
      ?? records.find(r => r.requirement_code === code);
    return { ...req, record };
  });

  const eligBadge = ELIGIBILITY_BADGE_MAP[eligibility?.eligibility_status ?? "non_compliant"] ?? ELIGIBILITY_BADGE_MAP.non_compliant;

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Eligibility Banner */}
      {eligibility && !eligibility.is_eligible_for_assignment && (
        <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldX className="h-5 w-5 text-destructive" />
            <span className="font-semibold text-destructive">BLOCKED — Not eligible for participant assignment</span>
          </div>
          {eligibility.reason_summary && (
            <div className="text-sm text-destructive/80 space-y-1">
              {eligibility.reason_summary.split("; ").map((r, i) => (
                <p key={i}>• {r}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {eligibility?.is_eligible_for_assignment && (
        <div className="rounded-lg border-2 border-success bg-success/10 p-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-success" />
          <span className="font-semibold text-success">Eligible for participant assignment</span>
          <Badge variant={eligBadge.variant} className="ml-auto">{eligBadge.label}</Badge>
        </div>
      )}

      {/* Compliance Checklist */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Compliance Checklist</CardTitle>
          {(isAdmin || isSelf) && (
            <UploadDialog
              open={uploadDialogOpen}
              onOpenChange={setUploadDialogOpen}
              requirements={requirements}
              onUpload={(data) => uploadMutation.mutate(data)}
              isPending={uploadMutation.isPending}
            />
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Mandatory</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Verified By</TableHead>
                  {isAdmin && !isSelf && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {checklist.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">No requirements configured</TableCell></TableRow>
                ) : (
                  checklist.map(item => {
                    const status = item.record?.status ?? "missing";
                    const statusBadge = RECORD_STATUS_BADGE[status] ?? RECORD_STATUS_BADGE.missing;
                    const expiryDays = item.record?.expiry_date ? differenceInDays(new Date(item.record.expiry_date), new Date()) : null;

                    return (
                      <TableRow key={item.requirement_code}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{item.requirement_name}</p>
                            {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.is_mandatory ? (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Optional</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{item.record?.issue_date ? format(new Date(item.record.issue_date), "PP") : "—"}</TableCell>
                        <TableCell>
                          {item.record?.expiry_date ? (
                            <div>
                              <span className="text-sm">{format(new Date(item.record.expiry_date), "PP")}</span>
                              {expiryDays !== null && expiryDays < 0 && (
                                <p className="text-xs text-destructive font-medium">Expired {Math.abs(expiryDays)}d ago</p>
                              )}
                              {expiryDays !== null && expiryDays >= 0 && expiryDays <= 60 && (
                                <p className="text-xs text-warning font-medium">Expires in {expiryDays}d</p>
                              )}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {item.record?.uploaded_file_url ? (
                            <a href={item.record.uploaded_file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1">
                              <FileText className="h-3 w-3" />View
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.record?.verified_by ? (
                            <div>
                              <span className="text-xs">Verified</span>
                              {item.record.verified_at && <p className="text-xs text-muted-foreground">{format(new Date(item.record.verified_at), "PP")}</p>}
                            </div>
                          ) : "—"}
                        </TableCell>
                        {isAdmin && !isSelf && (
                          <TableCell>
                            {item.record?.status === "pending_review" && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="h-7 text-xs"
                                  onClick={() => verifyMutation.mutate({ recordId: item.record.id, action: "verify" })}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />Verify
                                </Button>
                                <Button size="sm" variant="destructive" className="h-7 text-xs"
                                  onClick={() => { setSelectedRecord(item.record); setVerifyDialogOpen(true); }}
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

      {/* Conduct Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Conduct & Restrictions</CardTitle>
          {isAdmin && (
            <ConductDialog
              open={conductDialogOpen}
              onOpenChange={setConductDialogOpen}
              onSubmit={(data) => conductMutation.mutate(data)}
              isPending={conductMutation.isPending}
            />
          )}
        </CardHeader>
        <CardContent>
          {conductEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No conduct events recorded</p>
          ) : (
            <div className="space-y-3">
              {conductEvents.map(event => (
                <div key={event.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize text-xs">{event.event_type.replace(/_/g, " ")}</Badge>
                    <Badge variant="secondary" className="capitalize text-xs">{(event.source_type as string).replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{format(new Date(event.created_at), "PPp")}</span>
                  </div>
                  {event.description && <p className="text-sm">{event.description}</p>}
                  {event.action_taken && <p className="text-sm text-muted-foreground">Action: {event.action_taken}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Timeline / Audit */}
      <Card>
        <CardHeader><CardTitle>Compliance Timeline</CardTitle></CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No audit trail entries</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 border-l-2 border-muted pl-3 pb-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{log.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{log.user_name} · {format(new Date(log.created_at), "PPp")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Compliance Record</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">Record: <strong>{selectedRecord?.requirement_name}</strong></p>
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain why this record is being rejected..." required />
            </div>
            <Button
              variant="destructive"
              className="w-full"
              disabled={verifyMutation.isPending || !rejectReason.trim()}
              onClick={() => selectedRecord && verifyMutation.mutate({ recordId: selectedRecord.id, action: "reject", reason: rejectReason })}
            >
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Upload Dialog Component
function UploadDialog({ open, onOpenChange, requirements, onUpload, isPending }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requirements: any[];
  onUpload: (data: any) => void;
  isPending: boolean;
}) {
  const [reqCode, setReqCode] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const selectedReq = requirements.find(r => r.requirement_code === reqCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Upload className="h-4 w-4 mr-1" />Upload Document</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload Compliance Document</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={e => {
          e.preventDefault();
          if (!selectedReq) return;
          onUpload({
            requirementCode: reqCode,
            requirementName: selectedReq.requirement_name,
            file: file ?? undefined,
            issueDate: issueDate || undefined,
            expiryDate: expiryDate || undefined,
          });
        }}>
          <div className="space-y-2">
            <Label>Requirement *</Label>
            <Select value={reqCode} onValueChange={setReqCode}>
              <SelectTrigger><SelectValue placeholder="Select requirement" /></SelectTrigger>
              <SelectContent>
                {[...new Map(requirements.map(r => [r.requirement_code, r])).values()].map(r => (
                  <SelectItem key={r.requirement_code} value={r.requirement_code}>{r.requirement_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Issue Date</Label><Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Expiry Date</Label><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Document File</Label>
            <Input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button type="submit" className="w-full" disabled={isPending || !reqCode}>
            {isPending ? "Uploading..." : "Submit for Review"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Conduct Dialog Component
function ConductDialog({ open, onOpenChange, onSubmit, isPending }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [eventType, setEventType] = useState("warning");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [sourceType, setSourceType] = useState("manual_review");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><AlertTriangle className="h-4 w-4 mr-1" />Record Conduct Event</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Conduct Event</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={e => {
          e.preventDefault();
          onSubmit({ event_type: eventType, description, action_taken: actionTaken, source_type: sourceType });
        }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="formal_review">Formal Review</SelectItem>
                  <SelectItem value="suspension">Suspension</SelectItem>
                  <SelectItem value="restriction">Restriction</SelectItem>
                  <SelectItem value="commendation">Commendation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual_review">Manual Review</SelectItem>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Description *</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Action Taken</Label><Textarea value={actionTaken} onChange={e => setActionTaken(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={isPending}>{isPending ? "Saving..." : "Record Event"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
