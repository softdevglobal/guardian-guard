import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { logAudit } from "@/lib/auditLog";
import {
  AlertTriangle, Timer, CheckCircle, XCircle, Plus, Clock,
  ShieldAlert, Siren, ArrowRight, Loader2, GraduationCap, Download
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { IncidentTimeline } from "@/components/incidents/IncidentTimeline";
import { IncidentExportButton } from "@/components/incidents/IncidentExportButtons";
import { LinkedRecords } from "@/components/compliance/LinkedRecords";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IncidentTrainingLinks } from "@/components/incidents/IncidentTrainingLinks";
import { ApprovalStatus } from "@/components/incidents/ApprovalStatus";
import { EvidenceScoreBadge } from "@/components/incidents/EvidenceScoreBadge";
import { computeIncidentEvidenceScore } from "@/lib/evidenceScore";

type Incident = Tables<"incidents">;

const STATUS_FLOW: Record<string, string> = {
  draft: "submitted",
  submitted: "supervisor_review",
  supervisor_review: "compliance_review",
  compliance_review: "investigating",
  investigating: "actioned",
  actioned: "closed",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  supervisor_review: "Supervisor Review",
  compliance_review: "Compliance Review",
  investigating: "Under Investigation",
  actioned: "Action Required / Actioned",
  closed: "Closed",
};

const STATUS_ROLE_GATE: Record<string, string[]> = {
  submitted: ["super_admin", "compliance_officer", "supervisor", "support_worker", "trainer"],
  supervisor_review: ["super_admin", "compliance_officer", "supervisor"],
  compliance_review: ["super_admin", "compliance_officer"],
  investigating: ["super_admin", "compliance_officer"],
  actioned: ["super_admin", "compliance_officer"],
  closed: ["super_admin", "compliance_officer"],
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-secondary text-secondary-foreground",
  supervisor_review: "bg-warning text-warning-foreground",
  compliance_review: "bg-warning text-warning-foreground",
  investigating: "bg-primary/20 text-primary",
  actioned: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
  reported: "bg-secondary text-secondary-foreground",
  review: "bg-warning text-warning-foreground",
};

interface Props {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IncidentDetailSheet({ incident, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [closureErrors, setClosureErrors] = useState<string[]>([]);
  const [actionForm, setActionForm] = useState({ description: "", due_date: "", assigned_to: "" });
  const [showActionForm, setShowActionForm] = useState(false);

  // Workflow history
  const { data: history = [] } = useQuery({
    queryKey: ["incident-workflow", incident?.id],
    enabled: !!incident,
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_workflow_history")
        .select("*")
        .eq("incident_id", incident!.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  // Corrective actions
  const { data: actions = [] } = useQuery({
    queryKey: ["incident-actions", incident?.id],
    enabled: !!incident,
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_actions")
        .select("*")
        .eq("incident_id", incident!.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  // Approvals for this incident
  const { data: approvals = [] } = useQuery({
    queryKey: ["approvals", "incident", incident?.id],
    enabled: !!incident,
    queryFn: async () => {
      const { data } = await supabase
        .from("approvals" as any)
        .select("*")
        .eq("record_type", "incident")
        .eq("record_id", incident!.id);
      return (data ?? []) as any[];
    },
  });

  // Training links for this incident
  const { data: trainingLinks = [] } = useQuery({
    queryKey: ["incident-training-links", incident?.id],
    enabled: !!incident,
    queryFn: async () => {
      const { data } = await supabase
        .from("incident_training_links" as any)
        .select("*")
        .eq("incident_id", incident!.id);
      return (data ?? []) as any[];
    },
  });

  // Staff list for action assignment
  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-list-actions"],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("id, full_name").limit(100);
      return data ?? [];
    },
  });

  // Training eligibility check for current user
  const { data: trainingCheck } = useQuery({
    queryKey: ["incident-training-check", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_incident_handler_training", { _user_id: user!.id });
      if (error) return { has_incident_training: true }; // Fail open if RPC not found
      return data as unknown as { has_incident_training: boolean };
    },
  });

  const getField = (key: string) => editFields[key] ?? (incident as any)?.[key] ?? "";

  // Time breach calculations
  const getTimeBreaches = () => {
    if (!incident || ["closed"].includes(incident.status)) return [];
    const breaches: { type: string; message: string; severity: "critical" | "warning" }[] = [];

    if (incident.ndis_notification_deadline) {
      const hoursRemaining = differenceInHours(new Date(incident.ndis_notification_deadline), new Date());
      if (hoursRemaining < 0) {
        breaches.push({
          type: "ndis",
          message: `24h NDIS notification deadline BREACHED ${Math.abs(hoursRemaining)}h ago`,
          severity: "critical",
        });
      } else if (hoursRemaining <= 6) {
        breaches.push({
          type: "ndis_warning",
          message: `NDIS deadline in ${hoursRemaining}h — immediate action required`,
          severity: "warning",
        });
      }
    }

    const daysOpen = differenceInDays(new Date(), new Date(incident.created_at));
    if (daysOpen > 5 && !["actioned", "closed"].includes(incident.status)) {
      breaches.push({
        type: "closure",
        message: `5-day resolution target exceeded (${daysOpen} days open)`,
        severity: "warning",
      });
    }

    return breaches;
  };

  // Save field mutation
  const saveMutation = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      if (!incident) return;
      const { error } = await supabase.from("incidents").update(fields as any).eq("id", incident.id);
      if (error) throw error;
      await logAudit({ action: "field_updated", module: "incidents", record_id: incident.id, details: fields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast({ title: "Saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Closure validation
  const validateClosure = (): string[] => {
    if (!incident) return [];
    const errors: string[] = [];
    const rc = getField("root_cause");
    const cf = getField("contributing_factors");
    const ca = getField("corrective_actions");
    const desc = getField("description") || incident.description;
    const followup = editFields.participant_followup_completed ?? incident.participant_followup_completed;

    if (!desc) errors.push("Description is required");
    if (!rc) errors.push("Root cause analysis is required");
    if (!cf) errors.push("Contributing factors must be documented");
    if (!ca) errors.push("Corrective actions are required before closure");
    if (!followup) errors.push("Participant follow-up must be completed");

    // Check if there are pending corrective actions
    const pendingActions = actions.filter(a => a.status === "pending" || a.status === "in_progress");
    if (pendingActions.length > 0) {
      errors.push(`${pendingActions.length} corrective action(s) still pending`);
    }

    return errors;
  };

  // Advance status
  const advanceMutation = useMutation({
    mutationFn: async () => {
      if (!incident || !user) return;
      const nextStatus = STATUS_FLOW[incident.status];
      if (!nextStatus) throw new Error("No next status available");

      // Training check for non-admin actions
      if (!trainingCheck?.has_incident_training && !["super_admin", "compliance_officer"].includes(user.role)) {
        throw new Error("You must complete verified Incident Management Training before handling incidents.");
      }

      if (nextStatus === "closed") {
        const errors = validateClosure();
        if (errors.length > 0) {
          setClosureErrors(errors);
          throw new Error("Closure criteria not met");
        }
      }
      setClosureErrors([]);

      const updatePayload: any = { status: nextStatus };
      if (nextStatus === "closed") {
        updatePayload.closed_at = new Date().toISOString();
        updatePayload.closed_by = user.id;
      }

      // Save pending edit fields
      Object.assign(updatePayload, editFields);

      const { error: updateErr } = await supabase.from("incidents").update(updatePayload).eq("id", incident.id);
      if (updateErr) throw updateErr;

      await supabase.from("incident_workflow_history").insert({
        incident_id: incident.id,
        from_status: incident.status,
        to_status: nextStatus as any,
        changed_by: user.id,
      });

      await logAudit({
        action: "status_advanced",
        module: "incidents",
        record_id: incident.id,
        details: { from: incident.status, to: nextStatus },
        severity: nextStatus === "closed" ? "high" : "normal",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["incident-workflow", incident?.id] });
      setEditFields({});
      toast({ title: "Status updated" });
    },
    onError: (err: any) => {
      if (err.message !== "Closure criteria not met") {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  // Add corrective action
  const addActionMutation = useMutation({
    mutationFn: async () => {
      if (!incident || !user) return;
      if (!actionForm.description.trim()) throw new Error("Description is required");

      const { error } = await supabase.from("incident_actions").insert({
        incident_id: incident.id,
        description: actionForm.description,
        action_type: "corrective",
        due_date: actionForm.due_date || null,
        assigned_to: actionForm.assigned_to || null,
        created_by: user.id,
        status: "pending",
      });
      if (error) throw error;

      await logAudit({
        action: "corrective_action_added",
        module: "incident_actions",
        record_id: incident.id,
        details: { description: actionForm.description },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incident-actions", incident?.id] });
      setActionForm({ description: "", due_date: "", assigned_to: "" });
      setShowActionForm(false);
      toast({ title: "Corrective action added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Complete corrective action
  const completeActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase.from("incident_actions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incident-actions", incident?.id] });
      toast({ title: "Action completed" });
    },
  });

  if (!incident) return null;

  const nextStatus = STATUS_FLOW[incident.status];
  const canAdvance = nextStatus && user && STATUS_ROLE_GATE[nextStatus]?.includes(user.role);
  const isInvestigating = ["investigating", "actioned", "closed"].includes(incident.status);
  const isEditable = incident.status !== "closed";
  const timeBreaches = getTimeBreaches();
  const daysOpen = differenceInDays(new Date(), new Date(incident.created_at));

  const setEdit = (key: string, val: any) => setEditFields(prev => ({ ...prev, [key]: val }));

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="p-6 space-y-4">
          <SheetHeader>
            <SheetTitle className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm">{incident.incident_number}</span>
              <Badge className={`${statusColors[incident.status] ?? ""} capitalize`}>
                {STATUS_LABELS[incident.status] ?? incident.status.replace(/_/g, " ")}
              </Badge>
              <Badge variant={incident.severity === "critical" || incident.severity === "high" ? "destructive" : "outline"} className="capitalize">
                {incident.severity}
              </Badge>
              {incident.is_reportable && <Badge variant="destructive">NDIS Reportable</Badge>}
            </SheetTitle>
            <EvidenceScoreBadge score={computeIncidentEvidenceScore(incident, actions, approvals, trainingLinks)} />
          </SheetHeader>

          <h3 className="font-semibold text-lg">{incident.title}</h3>

          {/* Training Warning */}
          {trainingCheck && !trainingCheck.has_incident_training && (
            <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
              <p className="text-sm flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-warning" />
                <span><strong>Training Required:</strong> You have not completed verified Incident Management Training. Your ability to advance incidents is restricted.</span>
              </p>
            </div>
          )}

          {/* Time Breach Alerts */}
          {timeBreaches.length > 0 && (
            <div className="space-y-2">
              {timeBreaches.map((breach, i) => (
                <div key={i} className={`rounded-md p-3 border ${breach.severity === "critical" ? "bg-destructive/10 border-destructive/30" : "bg-warning/10 border-warning/30"}`}>
                  <p className={`text-sm font-medium flex items-center gap-2 ${breach.severity === "critical" ? "text-destructive" : "text-warning"}`}>
                    <Timer className="h-4 w-4" />{breach.message}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* NDIS Deadline Banner */}
          {incident.ndis_notification_deadline && (
            <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  <span><strong>NDIS Notification Deadline:</strong> {format(new Date(incident.ndis_notification_deadline), "PPp")}</span>
                </p>
                {new Date(incident.ndis_notification_deadline) < new Date() && incident.status !== "closed" && (
                  <Badge variant="destructive">BREACHED</Badge>
                )}
              </div>
            </div>
          )}

          {/* Status Info Bar */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{daysOpen} day{daysOpen !== 1 ? "s" : ""} open</span>
            <span>·</span>
            <span>Reported {format(new Date(incident.created_at), "PPp")}</span>
            {incident.closed_at && (
              <>
                <span>·</span>
                <span>Closed {format(new Date(incident.closed_at), "PP")}</span>
              </>
            )}
          </div>

          <Separator />

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of Incident" value={incident.date_of_incident ? format(new Date(incident.date_of_incident), "PP") : "—"} />
            <Field label="Time" value={incident.time_of_incident ?? "—"} />
            <Field label="Location" value={incident.incident_location} />
            <Field label="Environment" value={incident.environment} />
            <Field label="Type" value={incident.incident_type} />
            <Field label="Category" value={(incident.incident_category ?? "").replace(/_/g, " ")} />
          </div>

          <Separator />
          <h4 className="text-sm font-semibold">Harm & Emergency Assessment</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Participant Harmed" value={incident.participant_harmed ? "Yes" : "No"} />
            <Field label="Staff Harmed" value={incident.staff_harmed ? "Yes" : "No"} />
            <Field label="Medical Attention" value={incident.medical_attention_required ? "Yes" : "No"} />
            <Field label="Emergency Services" value={incident.emergency_service_contacted ? "Yes" : "No"} />
          </div>

          <Separator />
          <h4 className="text-sm font-semibold">Description</h4>
          <p className="text-sm whitespace-pre-wrap">{incident.description ?? "No description"}</p>
          {incident.immediate_action_taken && (
            <>
              <h4 className="text-sm font-semibold">Immediate Action Taken</h4>
              <p className="text-sm whitespace-pre-wrap">{incident.immediate_action_taken}</p>
            </>
          )}

          {/* Investigation Section */}
          {isInvestigating && (
            <>
              <Separator />
              <h4 className="text-sm font-semibold">Investigation Findings</h4>
              <div className="space-y-3">
                {[
                  { key: "root_cause", label: "Root Cause Analysis", placeholder: "What was the root cause?" },
                  { key: "contributing_factors", label: "Contributing Factors", placeholder: "What factors contributed?" },
                  { key: "corrective_actions", label: "Corrective Actions Taken", placeholder: "What corrective actions were taken?" },
                  { key: "preventive_actions", label: "Preventive Actions", placeholder: "What will prevent recurrence?" },
                ].map(field => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs">{field.label} {field.key !== "preventive_actions" && <span className="text-destructive">*</span>}</Label>
                    {isEditable ? (
                      <Textarea
                        value={getField(field.key)}
                        onChange={e => setEdit(field.key, e.target.value)}
                        onBlur={() => editFields[field.key] !== undefined && saveMutation.mutate({ [field.key]: editFields[field.key] })}
                        rows={2}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{(incident as any)[field.key] ?? "—"}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Corrective Actions Management */}
          {isInvestigating && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Corrective Actions ({actions.length})</h4>
                {isEditable && (
                  <Button size="sm" variant="outline" onClick={() => setShowActionForm(!showActionForm)}>
                    <Plus className="h-3 w-3 mr-1" />Add Action
                  </Button>
                )}
              </div>

              {showActionForm && (
                <Card className="border-dashed">
                  <CardContent className="pt-4 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Action Description *</Label>
                      <Textarea value={actionForm.description} onChange={e => setActionForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the corrective action..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Due Date</Label>
                        <Input type="date" value={actionForm.due_date} onChange={e => setActionForm(f => ({ ...f, due_date: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Assigned To</Label>
                        <Select value={actionForm.assigned_to} onValueChange={v => setActionForm(f => ({ ...f, assigned_to: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                          <SelectContent>
                            {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => addActionMutation.mutate()} disabled={addActionMutation.isPending}>
                      {addActionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Save Action
                    </Button>
                  </CardContent>
                </Card>
              )}

              {actions.length > 0 && (
                <div className="space-y-2">
                  {actions.map(action => {
                    const isOverdue = action.due_date && new Date(action.due_date) < new Date() && action.status !== "completed";
                    const assignee = staffList.find(s => s.id === action.assigned_to);
                    return (
                      <div key={action.id} className={`rounded-md border p-3 ${action.status === "completed" ? "bg-muted/30" : isOverdue ? "border-destructive/50" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm">{action.description}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Badge variant={action.status === "completed" ? "default" : action.status === "pending" ? "outline" : "secondary"} className="text-[10px]">
                                {action.status}
                              </Badge>
                              {action.due_date && (
                                <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                  Due: {format(new Date(action.due_date), "PP")}
                                  {isOverdue && " (OVERDUE)"}
                                </span>
                              )}
                              {assignee && <span className="text-xs text-muted-foreground">→ {assignee.full_name}</span>}
                            </div>
                          </div>
                          {action.status !== "completed" && isEditable && (
                            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                              onClick={() => completeActionMutation.mutate(action.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" />Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Closure Section */}
          {["actioned", "closed"].includes(incident.status) && (
            <>
              <Separator />
              <h4 className="text-sm font-semibold">Closure</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Outcome Summary</Label>
                  {isEditable ? (
                    <Textarea
                      value={getField("outcome_summary")}
                      onChange={e => setEdit("outcome_summary", e.target.value)}
                      onBlur={() => editFields.outcome_summary !== undefined && saveMutation.mutate({ outcome_summary: editFields.outcome_summary })}
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{incident.outcome_summary ?? "—"}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Closure Recommendation</Label>
                  {isEditable ? (
                    <Textarea
                      value={getField("closure_recommendation")}
                      onChange={e => setEdit("closure_recommendation", e.target.value)}
                      onBlur={() => editFields.closure_recommendation !== undefined && saveMutation.mutate({ closure_recommendation: editFields.closure_recommendation })}
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{incident.closure_recommendation ?? "—"}</p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Participant Follow-up Completed</Label>
                  {isEditable ? (
                    <Switch
                      checked={editFields.participant_followup_completed ?? incident.participant_followup_completed ?? false}
                      onCheckedChange={val => {
                        setEdit("participant_followup_completed", val);
                        saveMutation.mutate({ participant_followup_completed: val });
                      }}
                    />
                  ) : (
                    <p className="text-sm">{incident.participant_followup_completed ? "Yes" : "No"}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Closure Validation Errors */}
          {closureErrors.length > 0 && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 space-y-1">
              <p className="text-sm font-medium flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" /> Cannot close — criteria not met:
              </p>
              <ul className="text-xs text-destructive space-y-0.5 list-disc list-inside">
                {closureErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <Separator />

          {/* Training Links */}
          {isInvestigating && (
            <IncidentTrainingLinks incidentId={incident.id} organisationId={incident.organisation_id} />
          )}

          <Separator />

          {/* Approvals */}
          <ApprovalStatus recordType="incident" recordId={incident.id} organisationId={incident.organisation_id} />

          <Separator />

          {/* Linked Records */}
          <LinkedRecords
            module="incident"
            participantId={incident.participant_id}
            recordId={incident.id}
            organisationId={incident.organisation_id}
          />

          {/* Export Button */}
          <div className="flex justify-end">
            <IncidentExportButton incidentId={incident.id} incidentNumber={incident.incident_number} />
          </div>

          {/* Timeline & Audit Tabs */}
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
              <TabsTrigger value="workflow" className="flex-1">Workflow</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-3">
              <IncidentTimeline incidentId={incident.id} createdAt={incident.created_at} />
            </TabsContent>

            <TabsContent value="workflow" className="mt-3">
              {/* Workflow History */}
              <h4 className="text-sm font-semibold mb-2">Workflow Audit Trail</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(incident.created_at), "PPp")}</span>
                </div>
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <Badge variant="outline" className="capitalize text-xs">{(h.from_status ?? "new").replace(/_/g, " ")}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className="capitalize text-xs">{h.to_status.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(h.created_at), "PPp")}</span>
                  </div>
                ))}
              </div>

              {/* Workflow stages visualization */}
              <div className="flex items-center gap-1 overflow-x-auto pb-2 mt-4">
                {["draft", "submitted", "supervisor_review", "compliance_review", "investigating", "actioned", "closed"].map((status, idx) => {
                  const isCurrent = incident.status === status;
                  const isPast = ["draft", "submitted", "supervisor_review", "compliance_review", "investigating", "actioned", "closed"]
                    .indexOf(incident.status) > idx;
                  return (
                    <div key={status} className="flex items-center">
                      <div className={`px-2 py-1 rounded text-[10px] whitespace-nowrap ${
                        isCurrent ? "bg-primary text-primary-foreground font-bold" :
                        isPast ? "bg-success/20 text-success" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
                      </div>
                      {idx < 6 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-0.5 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* Advance Button */}
          {nextStatus && (
            <Button
              className="w-full"
              disabled={!canAdvance || advanceMutation.isPending}
              onClick={() => advanceMutation.mutate()}
            >
              {advanceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {canAdvance
                ? `Advance to ${STATUS_LABELS[nextStatus] ?? nextStatus.replace(/_/g, " ")}`
                : `Requires ${STATUS_ROLE_GATE[nextStatus]?.join(", ")} role`}
            </Button>
          )}

          {incident.status === "closed" && (
            <div className="rounded-md bg-success/10 border border-success/30 p-3 text-center">
              <p className="text-sm font-medium text-success flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" />Incident closed
                {incident.closed_at && ` on ${format(new Date(incident.closed_at), "PP")}`}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
