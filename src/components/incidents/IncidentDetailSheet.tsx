import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
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
  submitted: ["super_admin", "compliance_officer", "supervisor"],
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

  const advanceMutation = useMutation({
    mutationFn: async () => {
      if (!incident || !user) return;
      const nextStatus = STATUS_FLOW[incident.status];
      if (!nextStatus) throw new Error("No next status available");

      const { error: updateErr } = await supabase
        .from("incidents")
        .update({ status: nextStatus as any })
        .eq("id", incident.id);
      if (updateErr) throw updateErr;

      await supabase.from("incident_workflow_history").insert({
        incident_id: incident.id,
        from_status: incident.status,
        to_status: nextStatus as any,
        changed_by: user.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["incident-workflow", incident?.id] });
      toast({ title: "Status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!incident) return null;

  const nextStatus = STATUS_FLOW[incident.status];
  const canAdvance = nextStatus && user && STATUS_ROLE_GATE[nextStatus]?.includes(user.role);

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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of Incident" value={incident.date_of_incident ? format(new Date(incident.date_of_incident), "PP") : incident.created_at ? format(new Date(incident.created_at), "PP") : null} />
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

          {(incident.root_cause || incident.outcome_summary) && (
            <>
              <Separator />
              <h4 className="text-sm font-semibold">Investigation & Closure</h4>
              <div className="grid grid-cols-1 gap-2">
                <Field label="Root Cause" value={incident.root_cause} />
                <Field label="Outcome Summary" value={incident.outcome_summary} />
                <Field label="Follow-up Completed" value={incident.participant_followup_completed ? "Yes" : "No"} />
              </div>
            </>
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
