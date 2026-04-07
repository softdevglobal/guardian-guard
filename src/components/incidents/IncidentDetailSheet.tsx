import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { logAudit } from "@/lib/auditLog";
import { AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Incident = Tables<"incidents">;

const STATUS_FLOW: Record<string, string> = {
  draft: "submitted",
  submitted: "supervisor_review",
  supervisor_review: "compliance_review",
  compliance_review: "investigating",
  investigating: "actioned",
  actioned: "closed",
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
  submitted: "bg-info text-info-foreground",
  supervisor_review: "bg-warning text-warning-foreground",
  compliance_review: "bg-warning text-warning-foreground",
  investigating: "bg-destructive text-destructive-foreground",
  actioned: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
  reported: "bg-info text-info-foreground",
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

  const getField = (key: string) => editFields[key] ?? (incident as any)?.[key] ?? "";

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

  const validateClosure = (): string[] => {
    if (!incident) return [];
    const errors: string[] = [];
    const rc = getField("root_cause");
    const cf = getField("contributing_factors");
    const ca = getField("corrective_actions");
    const desc = getField("description") || incident.description;
    const followup = editFields.participant_followup_completed ?? incident.participant_followup_completed;

    if (!desc) errors.push("Description is required");
    if (!rc) errors.push("Root cause is required");
    if (!cf) errors.push("Contributing factors are required");
    if (!ca) errors.push("Corrective actions are required");
    if (!followup) errors.push("Participant follow-up must be completed");
    return errors;
  };

  const advanceMutation = useMutation({
    mutationFn: async () => {
      if (!incident || !user) return;
      const nextStatus = STATUS_FLOW[incident.status];
      if (!nextStatus) throw new Error("No next status available");

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

      // Also save any pending edit fields
      const pendingEdits = { ...editFields };
      Object.assign(updatePayload, pendingEdits);

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

  if (!incident) return null;

  const nextStatus = STATUS_FLOW[incident.status];
  const canAdvance = nextStatus && user && STATUS_ROLE_GATE[nextStatus]?.includes(user.role);
  const isInvestigating = ["investigating", "actioned", "closed"].includes(incident.status);
  const isEditable = incident.status !== "closed";

  const setEdit = (key: string, val: any) => setEditFields(prev => ({ ...prev, [key]: val }));

  const Field = ({ label, value }: { label: string; value: any }) => (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{incident.incident_number}</span>
            <Badge className={`${statusColors[incident.status] ?? ""} capitalize`}>{incident.status.replace(/_/g, " ")}</Badge>
            {incident.is_reportable && <Badge variant="destructive">NDIS Reportable</Badge>}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <h3 className="font-semibold">{incident.title}</h3>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of Incident" value={incident.date_of_incident ? format(new Date(incident.date_of_incident), "PP") : "—"} />
            <Field label="Time" value={incident.time_of_incident ?? "—"} />
            <Field label="Location" value={incident.incident_location} />
            <Field label="Environment" value={incident.environment} />
            <Field label="Type" value={incident.incident_type} />
            <Field label="Category" value={incident.incident_category} />
            <Field label="Severity" value={incident.severity} />
            <Field label="Reportable Reason" value={incident.reportable_reason} />
          </div>

          <Separator />
          <h4 className="text-sm font-semibold">Harm & Emergency</h4>
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
              <h4 className="text-sm font-semibold">Immediate Action</h4>
              <p className="text-sm whitespace-pre-wrap">{incident.immediate_action_taken}</p>
            </>
          )}

          {/* Investigation Section — editable when status is investigating or later */}
          {isInvestigating && (
            <>
              <Separator />
              <h4 className="text-sm font-semibold">Investigation</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Root Cause</Label>
                  {isEditable ? (
                    <Textarea
                      value={getField("root_cause")}
                      onChange={e => setEdit("root_cause", e.target.value)}
                      onBlur={() => editFields.root_cause !== undefined && saveMutation.mutate({ root_cause: editFields.root_cause })}
                      rows={2}
                      placeholder="What was the root cause?"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{incident.root_cause ?? "—"}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contributing Factors</Label>
                  {isEditable ? (
                    <Textarea
                      value={getField("contributing_factors")}
                      onChange={e => setEdit("contributing_factors", e.target.value)}
                      onBlur={() => editFields.contributing_factors !== undefined && saveMutation.mutate({ contributing_factors: editFields.contributing_factors })}
                      rows={2}
                      placeholder="What factors contributed?"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{incident.contributing_factors ?? "—"}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Corrective Actions</Label>
                  {isEditable ? (
                    <Textarea
                      value={getField("corrective_actions")}
                      onChange={e => setEdit("corrective_actions", e.target.value)}
                      onBlur={() => editFields.corrective_actions !== undefined && saveMutation.mutate({ corrective_actions: editFields.corrective_actions })}
                      rows={2}
                      placeholder="What corrective actions were taken?"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{incident.corrective_actions ?? "—"}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preventive Actions</Label>
                  {isEditable ? (
                    <Textarea
                      value={getField("preventive_actions")}
                      onChange={e => setEdit("preventive_actions", e.target.value)}
                      onBlur={() => editFields.preventive_actions !== undefined && saveMutation.mutate({ preventive_actions: editFields.preventive_actions })}
                      rows={2}
                      placeholder="What will prevent recurrence?"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{incident.preventive_actions ?? "—"}</p>
                  )}
                </div>
              </div>
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
          <h4 className="text-sm font-semibold">Workflow History</h4>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No status changes yet</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="capitalize text-xs">{(h.from_status ?? "new").replace(/_/g, " ")}</Badge>
                  <span>→</span>
                  <Badge variant="outline" className="capitalize text-xs">{h.to_status.replace(/_/g, " ")}</Badge>
                  <span className="text-muted-foreground text-xs">{format(new Date(h.created_at), "PPp")}</span>
                </div>
              ))}
            </div>
          )}

          {nextStatus && (
            <div className="pt-2">
              <Button
                className="w-full"
                disabled={!canAdvance || advanceMutation.isPending}
                onClick={() => advanceMutation.mutate()}
              >
                {canAdvance
                  ? `Advance to ${nextStatus.replace(/_/g, " ")}`
                  : `Requires ${STATUS_ROLE_GATE[nextStatus]?.join(", ")} role`}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
