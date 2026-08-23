import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import {
  BlockerAlert, EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill,
} from "@/components/compliance/GateUI";
import { EvidenceThumb } from "@/components/service/EvidenceThumb";
import { useParticipants, useStaff } from "@/hooks/useComplianceLookups";
import { approvalDecisionBlockers, billingSummary, formatDuration, shiftDurationMinutes } from "@/lib/serviceShifts";

export default function ServiceApprovals() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const { data: participants = [] } = useParticipants();
  const { data: staff = [] } = useStaff();

  const [fromDate, setFromDate] = useState("");
  const [worker, setWorker] = useState("");
  const [participant, setParticipant] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [geofenceOnly, setGeofenceOnly] = useState(false);
  const [evidenceOnly, setEvidenceOnly] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const { data: shifts = [], isLoading, error } = useQuery({
    queryKey: ["approval-queue"],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("service_shifts" as any).select("*").eq("status", "submitted").eq("record_status", "active")
        .order("submitted_at", { ascending: true });
      if (err) throw err;
      return data as any[];
    },
  });

  const ids = shifts.map((s) => s.id);

  const { data: detail = { tasks: [], evidence: [], attendance: [] } } = useQuery({
    queryKey: ["approval-detail", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [tasks, evidence, attendance] = await Promise.all([
        supabase.from("service_shift_tasks" as any).select("*").in("shift_id", ids),
        supabase.from("task_evidence" as any).select("*").in("shift_id", ids),
        supabase.from("attendance_events" as any).select("*").in("shift_id", ids).order("server_created_at"),
      ]);
      return { tasks: (tasks.data ?? []) as any[], evidence: (evidence.data ?? []) as any[], attendance: (attendance.data ?? []) as any[] };
    },
  });

  const filtered = useMemo(
    () =>
      shifts.filter((s) => {
        if (fromDate && new Date(s.scheduled_start) < new Date(fromDate)) return false;
        if (worker && s.worker_id !== worker) return false;
        if (participant && s.participant_id !== participant) return false;
        if (serviceType && !(s.service_type ?? "").toLowerCase().includes(serviceType.toLowerCase())) return false;
        if (geofenceOnly && !s.geofence_exception) return false;
        if (evidenceOnly && !s.evidence_exception) return false;
        return true;
      }),
    [shifts, fromDate, worker, participant, serviceType, geofenceOnly, evidenceOnly]
  );

  const decide = useMutation({
    mutationFn: async ({ shift, decision }: { shift: any; decision: "approve" | "request_correction" }) => {
      const reason = reasons[shift.id] ?? "";
      const b = approvalDecisionBlockers({ role: user?.role, decision, reason });
      if (b.length > 0) throw new Error(b.join(" "));
      const values =
        decision === "approve"
          ? { status: "approved", approval_notes: reason || null }
          : { status: "correction_required", correction_reason: reason };
      const { error: err } = await supabase.from("service_shifts" as any).update(values).eq("id", shift.id);
      if (err) throw err;
      await logAudit({
        action: decision === "approve" ? "service_approved" : "correction_requested",
        module: "service_shifts", record_id: shift.id, severity: "elevated", details: { reason },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval-queue"] });
      toast({ title: "Decision recorded", description: "The outcome is written to the append-only audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked", description: e.message }),
  });

  const canDecide = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer", "supervisor"]);
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.full_name ?? "Participant";
  const workerOf = (id: string) => staff.find((s) => s.id === id)?.full_name ?? "Worker";
  const totals = billingSummary(filtered);

  return (
    <div className="space-y-4">
      <PageHeading
        title="Service approvals"
        description="Review each submitted service against its attendance, tasks and evidence, then approve it or send it back with a written reason. Approved records become read-only."
      />

      <HumanReviewNotice>
        Duration and kilometre totals are prepared for a future timesheet or invoice process. This system does not
        connect to any NDIA system and makes no payment or eligibility determination.
      </HumanReviewNotice>

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="from">From date</Label>
            <Input id="from" type="date" className="min-h-[44px]" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="worker">Worker</Label>
            <select id="worker" className="h-11 w-full rounded-md border bg-background px-3" value={worker} onChange={(e) => setWorker(e.target.value)}>
              <option value="">All workers</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="participant">Participant</Label>
            <select id="participant" className="h-11 w-full rounded-md border bg-background px-3" value={participant} onChange={(e) => setParticipant(e.target.value)}>
              <option value="">All participants</option>
              {participants.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="stype">Service type</Label>
            <Input id="stype" className="min-h-[44px]" value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox id="geo" checked={geofenceOnly} onCheckedChange={(v) => setGeofenceOnly(!!v)} />
            <Label htmlFor="geo">Location exceptions only</Label>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox id="ev" checked={evidenceOnly} onCheckedChange={(v) => setEvidenceOnly(!!v)} />
            <Label htmlFor="ev">Evidence exceptions only</Label>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {filtered.length} submitted service(s) · {formatDuration(totals.minutes)} total · {totals.kilometres} km
      </p>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing awaiting approval" description="Submitted services will appear here for review." />
      ) : (
        filtered.map((s) => {
          const tasks = detail.tasks.filter((t) => t.shift_id === s.id);
          const evidence = detail.evidence.filter((e) => e.shift_id === s.id && e.record_status === "active");
          const events = detail.attendance.filter((a) => a.shift_id === s.id);
          return (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>{nameOf(s.participant_id)} · {workerOf(s.worker_id)}</span>
                  <span className="flex gap-2">
                    {s.geofence_exception && <Badge variant="destructive">Location exception</Badge>}
                    {s.evidence_exception && <Badge variant="destructive">Evidence exception</Badge>}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <p>Scheduled: {new Date(s.scheduled_start).toLocaleString()} – {new Date(s.scheduled_end).toLocaleTimeString()}</p>
                  <p>Actual: {s.actual_start ? new Date(s.actual_start).toLocaleString() : "—"} – {s.actual_end ? new Date(s.actual_end).toLocaleTimeString() : "—"}</p>
                  <p>Duration: {formatDuration(shiftDurationMinutes(s))}</p>
                  <p>Kilometres: {s.transport_kilometres ?? 0}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Attendance</h3>
                  <ul className="space-y-1 text-sm">
                    {events.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-2">
                        <span>{a.event_type === "check_in" ? "Check in" : "Check out"} {new Date(a.server_created_at).toLocaleString()}</span>
                        <StatusPill tone={a.geofence_result === "inside" ? "ok" : "warn"}>{a.geofence_result}{a.distance_metres != null ? ` · ${a.distance_metres} m` : ""}</StatusPill>
                        {a.exception_reason && <span className="text-muted-foreground">Reason: {a.exception_reason}</span>}
                        {a.offline_capture && <Badge variant="outline">Offline capture</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium">Tasks</h3>
                  <ul className="space-y-1 text-sm">
                    {tasks.map((t) => (
                      <li key={t.id}>
                        {t.sequence}. {t.title} — {t.status.replace("_", " ")}
                        {t.exception_reason ? ` (reason: ${t.exception_reason})` : ""}
                      </li>
                    ))}
                    {tasks.length === 0 && <li className="text-muted-foreground">No tasks recorded.</li>}
                  </ul>
                </div>

                {evidence.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium">Evidence</h3>
                    <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      {evidence.map((e) => (
                        <li key={e.id} className="space-y-1">
                          <EvidenceThumb evidence={{ id: e.id, storage_path: e.storage_path, shift_id: s.id }} />
                          <p className="text-xs text-muted-foreground">{e.evidence_type} · {e.source} · {e.sha256_hash.slice(0, 10)}…</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {s.service_notes && <p className="text-sm"><strong>Notes:</strong> {s.service_notes}</p>}
                {s.evidence_exception_reason && <p className="text-sm"><strong>Evidence exception:</strong> {s.evidence_exception_reason}</p>}

                {canDecide ? (
                  <div className="space-y-2">
                    <Label htmlFor={`reason-${s.id}`}>Decision reason (required to request a correction)</Label>
                    <Input
                      id={`reason-${s.id}`} className="min-h-[44px]"
                      value={reasons[s.id] ?? ""}
                      onChange={(e) => setReasons((r) => ({ ...r, [s.id]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button className="min-h-[44px]" onClick={() => decide.mutate({ shift: s, decision: "approve" })}>Approve</Button>
                      <Button variant="outline" className="min-h-[44px]" onClick={() => decide.mutate({ shift: s, decision: "request_correction" })}>
                        Request correction
                      </Button>
                    </div>
                    <BlockerAlert blockers={approvalDecisionBlockers({ role: user?.role, decision: "request_correction", reason: reasons[s.id] })} title="Needed before requesting a correction" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">You have view-only access to this queue.</p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
