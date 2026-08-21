import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, LogIn, LogOut, MapPin, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { BlockerAlert, ErrorState, HumanReviewNotice, LoadingState, PageHeading, ReadOnlyNotice, StatusPill } from "@/components/compliance/GateUI";
import { TaskEvidenceCapture } from "@/components/service/TaskEvidenceCapture";
import { requestLocationOnce, readShiftDraft, saveShiftDraft, clearShiftDraft } from "@/lib/taskEvidence";
import {
  SHIFT_STATUS_LABEL, WORKFLOW_STEPS, evaluateGeofence, formatDuration, shiftCompletionBlockers,
  shiftDurationMinutes, workflowStepIndex, type ShiftStatus,
} from "@/lib/serviceShifts";

export default function MyShiftDetail() {
  const { id = "" } = useParams();
  const { user, isMockAudit } = useAuth();
  const qc = useQueryClient();

  const [notes, setNotes] = useState("");
  const [hazards, setHazards] = useState("");
  const [kilometres, setKilometres] = useState("");
  const [locationReason, setLocationReason] = useState("");
  const [evidenceExceptionReason, setEvidenceExceptionReason] = useState("");
  const [confirmMethod, setConfirmMethod] = useState<"confirmed" | "declined" | "not_practicable">("confirmed");
  const [confirmName, setConfirmName] = useState("");
  const [confirmReason, setConfirmReason] = useState("");
  const [geoStatus, setGeoStatus] = useState("");

  const shiftQuery = useQuery({
    queryKey: ["shift", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("service_shifts" as any).select("*").eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });
  const shift = shiftQuery.data;

  const { data: tasks = [] } = useQuery({
    queryKey: ["shift-tasks", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_shift_tasks" as any).select("*, service_task_templates(participant_confirmation_required, allow_gallery_upload)")
        .eq("shift_id", id).eq("record_status", "active").order("sequence");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: evidence = [] } = useQuery({
    queryKey: ["shift-evidence", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("task_evidence" as any).select("*").eq("shift_id", id).order("server_created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["shift-attendance", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance_events" as any).select("*").eq("shift_id", id).order("server_created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: confirmations = [] } = useQuery({
    queryKey: ["shift-confirmations", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("shift_completion_confirmations" as any).select("*").eq("shift_id", id);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: prefs = null } = useQuery({
    queryKey: ["evidence-prefs", shift?.participant_id],
    enabled: !!shift?.participant_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_evidence_preferences" as any).select("*").eq("participant_id", shift.participant_id).maybeSingle();
      return (data as any) ?? null;
    },
  });

  // Offline-safe draft restore
  useEffect(() => {
    if (!shift) return;
    const draft = readShiftDraft(shift.id);
    setNotes(draft?.notes ?? shift.service_notes ?? "");
    setHazards(draft?.hazards ?? shift.hazards_observed ?? "");
    setKilometres(draft?.kilometres ?? (shift.transport_kilometres != null ? String(shift.transport_kilometres) : ""));
  }, [shift?.id]);

  useEffect(() => {
    if (shift?.id) saveShiftDraft(shift.id, { notes, hazards, kilometres });
  }, [shift?.id, notes, hazards, kilometres]);

  const readOnly = isMockAudit || !shift || ["submitted", "approved", "cancelled"].includes(shift.status);

  const blockers = useMemo(() => {
    if (!shift) return [];
    return shiftCompletionBlockers({
      shift: {
        actual_start: shift.actual_start, actual_end: shift.actual_end,
        evidence_exception: shift.evidence_exception, evidence_exception_reason: shift.evidence_exception_reason,
      },
      tasks: tasks.map((t) => ({
        id: t.id, status: t.status, requires_before_photo: t.requires_before_photo,
        requires_after_photo: t.requires_after_photo, exception_reason: t.exception_reason,
        participant_confirmation_required: t.service_task_templates?.participant_confirmation_required ?? false,
      })),
      evidence,
      preferences: prefs,
      confirmationRecorded: confirmations.length > 0,
    });
  }, [shift, tasks, evidence, prefs, confirmations]);

  const attend = useMutation({
    mutationFn: async (eventType: "check_in" | "check_out") => {
      setGeoStatus("Requesting your location once for this action…");
      const geo = await requestLocationOnce();
      const fenceEval = evaluateGeofence({
        captured: geo,
        fence: {
          latitude: shift.geofence_latitude, longitude: shift.geofence_longitude,
          radius_metres: shift.geofence_radius_metres,
        },
      });
      setGeoStatus(
        fenceEval.result === "inside"
          ? `Location confirmed at the service address (accuracy ${geo.accuracy_metres ?? "unknown"} m).`
          : `Location ${fenceEval.result}. A reason is required and your supervisor will review it.`
      );
      if (fenceEval.result !== "inside" && !locationReason.trim()) {
        throw new Error("Your location could not be confirmed at the service address. Enter a reason before continuing.");
      }
      const { error } = await supabase.from("attendance_events" as any).insert({
        organisation_id: shift.organisation_id,
        shift_id: shift.id,
        worker_id: user!.id,
        event_type: eventType,
        device_capture_at: new Date().toISOString(),
        latitude: geo.latitude, longitude: geo.longitude, accuracy_metres: geo.accuracy_metres,
        exception_reason: fenceEval.result === "inside" ? null : locationReason,
        synced_at: new Date().toISOString(),
      });
      if (error) throw error;
      await logAudit({ action: eventType, module: "attendance_events", record_id: shift.id });
    },
    onSuccess: () => {
      setLocationReason("");
      qc.invalidateQueries({ queryKey: ["shift", id] });
      qc.invalidateQueries({ queryKey: ["shift-attendance", id] });
      toast({ title: "Attendance recorded", description: "The server time is the official record." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Not recorded", description: e.message }),
  });

  const updateShift = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { error } = await supabase.from("service_shifts" as any).update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift", id] });
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked by the compliance engine", description: e.message }),
  });

  const completeTask = useMutation({
    mutationFn: async ({ taskId, status, notes: n, exception }: { taskId: string; status: string; notes?: string; exception?: string }) => {
      const { error } = await supabase.from("service_shift_tasks" as any).update({
        status, completion_notes: n ?? null, exception_reason: exception ?? null,
        completed_by: user!.id, completed_at: new Date().toISOString(),
      }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift-tasks", id] }),
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked", description: e.message }),
  });

  const recordConfirmation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shift_completion_confirmations" as any).insert({
        organisation_id: shift.organisation_id,
        shift_id: shift.id,
        confirmation_method: confirmMethod,
        confirmed_by_name: confirmMethod === "confirmed" ? confirmName : null,
        declined: confirmMethod === "declined",
        declined_reason: confirmMethod === "declined" ? confirmReason : null,
        not_practicable_reason: confirmMethod === "not_practicable" ? confirmReason : null,
        confirmed_at: new Date().toISOString(),
        recorded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-confirmations", id] });
      toast({ title: "Participant confirmation recorded" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked", description: e.message }),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_shifts" as any).update({
        status: "submitted",
        service_notes: notes,
        hazards_observed: hazards || null,
        transport_kilometres: kilometres ? Number(kilometres) : null,
      }).eq("id", id);
      if (error) throw error;
      await logAudit({ action: "submitted_for_approval", module: "service_shifts", record_id: id });
    },
    onSuccess: () => {
      clearShiftDraft(id);
      qc.invalidateQueries({ queryKey: ["shift", id] });
      toast({ title: "Submitted", description: "Your supervisor has been notified for approval." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Cannot submit yet", description: e.message }),
  });

  if (shiftQuery.isLoading) return <LoadingState />;
  if (shiftQuery.error) return <ErrorState error={shiftQuery.error} />;
  if (!shift) return <ErrorState error={new Error("This shift is not available to you.")} />;

  const step = workflowStepIndex({
    status: shift.status as ShiftStatus,
    actual_start: shift.actual_start,
    actual_end: shift.actual_end,
    tasksPending: tasks.filter((t) => t.status === "pending").length,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button asChild variant="ghost" className="min-h-[44px] px-2">
        <Link to="/my-shifts"><ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />Back to my shifts</Link>
      </Button>

      <PageHeading
        title="Service delivery"
        description="Follow each step in order. Your notes are saved on this device as you type, in case you lose signal."
        actions={<StatusPill tone={shift.status === "correction_required" ? "bad" : "neutral"}>{SHIFT_STATUS_LABEL[shift.status as ShiftStatus]}</StatusPill>}
      />

      <ol className="flex flex-wrap gap-2" aria-label="Service workflow progress">
        {WORKFLOW_STEPS.map((label, i) => (
          <li key={label}>
            <Badge variant={i <= step ? "default" : "outline"} aria-current={i === step ? "step" : undefined}>
              {label}
            </Badge>
          </li>
        ))}
      </ol>

      {readOnly && <ReadOnlyNotice reason={isMockAudit ? "Mock audit mode is active." : "This service has been submitted and can no longer be edited."} />}

      {shift.status === "correction_required" && (
        <Alert variant="destructive">
          <AlertTitle>Correction requested</AlertTitle>
          <AlertDescription>{shift.correction_reason}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Attendance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p aria-live="polite" className="text-sm text-muted-foreground">{geoStatus || "Your location is requested only when you tap check in or check out."}</p>
          <ul className="space-y-1 text-sm">
            {attendance.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span>{a.event_type === "check_in" ? "Checked in" : "Checked out"} {new Date(a.server_created_at).toLocaleString()}</span>
                <StatusPill tone={a.geofence_result === "inside" ? "ok" : "warn"}>
                  {a.geofence_result}{a.distance_metres != null ? ` · ${a.distance_metres} m` : ""}
                  {a.accuracy_metres != null ? ` · ±${a.accuracy_metres} m` : ""}
                </StatusPill>
              </li>
            ))}
            {attendance.length === 0 && <li className="text-muted-foreground">No attendance recorded yet.</li>}
          </ul>

          {!readOnly && (
            <>
              <div className="space-y-1">
                <Label htmlFor="loc-reason">Reason if your location cannot be confirmed</Label>
                <Input id="loc-reason" className="min-h-[44px]" value={locationReason} onChange={(e) => setLocationReason(e.target.value)} placeholder="For example: no signal inside the building" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-[44px]" disabled={!!shift.actual_start || attend.isPending} onClick={() => attend.mutate("check_in")}>
                  <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />Check in
                </Button>
                <Button variant="outline" className="min-h-[44px]" disabled={!shift.actual_start || !!shift.actual_end || attend.isPending} onClick={() => attend.mutate("check_out")}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />Check out
                </Button>
                {shift.status === "checked_in" && (
                  <Button variant="secondary" className="min-h-[44px]" onClick={() => updateShift.mutate({ status: "in_progress" })}>
                    Start service
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tasks agreed with the participant</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks have been added to this shift.</p>}
          {tasks.map((t) => (
            <section key={t.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{t.sequence}. {t.title}</h3>
                <StatusPill tone={t.status === "completed" ? "ok" : t.status === "pending" ? "neutral" : "warn"}>{t.status.replace("_", " ")}</StatusPill>
              </div>
              {t.participant_instructions && <p className="text-sm text-muted-foreground">{t.participant_instructions}</p>}
              {(t.requires_before_photo || t.requires_after_photo) && (
                <p className="text-xs text-muted-foreground">
                  Photo evidence requested by your organisation: {[t.requires_before_photo && "before", t.requires_after_photo && "after"].filter(Boolean).join(" and ")}.
                </p>
              )}

              {!readOnly && (
                <TaskEvidenceCapture
                  organisationId={shift.organisation_id}
                  workerId={user!.id}
                  shiftId={shift.id}
                  shiftTaskId={t.id}
                  participantId={shift.participant_id}
                  preferences={prefs}
                  allowGalleryUpload={!!t.service_task_templates?.allow_gallery_upload}
                  fence={{ latitude: shift.geofence_latitude, longitude: shift.geofence_longitude, radius_metres: shift.geofence_radius_metres }}
                  existing={evidence.filter((e) => e.shift_task_id === t.id)}
                  onUploaded={() => qc.invalidateQueries({ queryKey: ["shift-evidence", id] })}
                />
              )}

              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="min-h-[44px]" onClick={() => completeTask.mutate({ taskId: t.id, status: "completed" })}>
                    <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden="true" />Mark done
                  </Button>
                  <Button
                    size="sm" variant="outline" className="min-h-[44px]"
                    onClick={() => {
                      const reason = window.prompt("Why was this task not completed?");
                      if (reason?.trim()) completeTask.mutate({ taskId: t.id, status: "not_completed", exception: reason });
                    }}
                  >
                    Not completed — record reason
                  </Button>
                </div>
              )}
            </section>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Service notes, hazards and travel</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="notes">Service notes (also used as written evidence when photos are not permitted)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} disabled={readOnly} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hazards">Hazards observed</Label>
            <Textarea id="hazards" value={hazards} onChange={(e) => setHazards(e.target.value)} rows={2} disabled={readOnly} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="km">Transport kilometres</Label>
            <Input id="km" className="min-h-[44px]" inputMode="decimal" value={kilometres} onChange={(e) => setKilometres(e.target.value)} disabled={readOnly} />
          </div>
          <p className="text-sm text-muted-foreground">
            Something went wrong? <Link className="underline" to="/incidents">Report an incident</Link> — incidents are assessed by a person, never by this app.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Participant confirmation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {confirmations.map((c) => (
            <p key={c.id} className="text-sm">
              {c.confirmation_method === "confirmed" ? `Confirmed by ${c.confirmed_by_name}` : c.confirmation_method === "declined" ? `Declined: ${c.declined_reason}` : `Not practicable: ${c.not_practicable_reason}`}
            </p>
          ))}
          {!readOnly && (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">How was the service confirmed?</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Confirmation method">
                  {([["confirmed", "Participant confirmed"], ["declined", "Participant declined"], ["not_practicable", "Not practicable"]] as const).map(([v, label]) => (
                    <Button key={v} type="button" role="radio" aria-checked={confirmMethod === v} variant={confirmMethod === v ? "default" : "outline"} className="min-h-[44px]" onClick={() => setConfirmMethod(v)}>
                      {label}
                    </Button>
                  ))}
                </div>
              </fieldset>
              {confirmMethod === "confirmed" ? (
                <div className="space-y-1">
                  <Label htmlFor="cname">Name of the participant or nominee</Label>
                  <Input id="cname" className="min-h-[44px]" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="creason">Reason</Label>
                  <Input id="creason" className="min-h-[44px]" value={confirmReason} onChange={(e) => setConfirmReason(e.target.value)} />
                </div>
              )}
              <Button variant="secondary" className="min-h-[44px]" onClick={() => recordConfirmation.mutate()}>Record confirmation</Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Review and submit</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">Recorded duration: <strong>{formatDuration(shiftDurationMinutes(shift))}</strong> · Kilometres: <strong>{kilometres || "0"}</strong></p>
          <BlockerAlert blockers={blockers} title="Before you can submit" />
          {!readOnly && blockers.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="ev-exception">Authorised evidence exception reason (sent to your supervisor)</Label>
              <Input id="ev-exception" className="min-h-[44px]" value={evidenceExceptionReason} onChange={(e) => setEvidenceExceptionReason(e.target.value)} />
              <Button
                variant="outline" className="min-h-[44px]"
                disabled={!evidenceExceptionReason.trim()}
                onClick={() => updateShift.mutate({ evidence_exception: true, evidence_exception_reason: evidenceExceptionReason })}
              >
                Record evidence exception
              </Button>
            </div>
          )}
          {!readOnly && (
            <Button className="min-h-[44px] w-full" disabled={submit.isPending || blockers.length > 0} onClick={() => submit.mutate()}>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />Submit for supervisor approval
            </Button>
          )}
        </CardContent>
      </Card>

      <HumanReviewNotice>
        This record documents what happened during the service. It does not assess clinical or safeguarding risk —
        a supervisor reviews every submission before it is approved.
      </HumanReviewNotice>
    </div>
  );
}
