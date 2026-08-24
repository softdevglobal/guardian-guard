import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { BlockerAlert, EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, ReadOnlyNotice } from "@/components/compliance/GateUI";
import { useParticipants, useStaff } from "@/hooks/useComplianceLookups";
import { SHIFT_STATUS_LABEL, type ShiftStatus } from "@/lib/serviceShifts";
import { checkAssignmentEligible } from "@/lib/staffEligibility";
import {
  UNASSIGNED,
  addDays,
  clashesForWorker,
  conflictingShiftIds,
  formatTimeRange,
  isInWeek,
  reassignBlockers,
  rosterCoverage,
  rosterRows,
  startOfWeek,
  weekDays,
  weekLabel,
  type RosterShift,
} from "@/lib/roster";

const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Roster() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const { data: participants = [] } = useParticipants();
  const { data: staff = [] } = useStaff();

  const canRoster = hasRole(["tenant_admin", "super_admin", "compliance_officer", "supervisor"]);
  const canEdit = canRoster && !isMockAudit;

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [participantFilter, setParticipantFilter] = useState("all");
  const [assignTarget, setAssignTarget] = useState<RosterShift | null>(null);
  const [assignWorker, setAssignWorker] = useState("");
  const [blockers, setBlockers] = useState<string[]>([]);

  const rangeStart = addDays(weekStart, -1).toISOString();
  const rangeEnd = addDays(weekStart, 8).toISOString();

  const { data: shifts = [], isLoading, error, refetch } = useQuery({
    queryKey: ["roster-shifts", rangeStart],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("service_shifts" as any)
        .select("*")
        .eq("record_status", "active")
        .gte("scheduled_start", rangeStart)
        .lt("scheduled_start", rangeEnd)
        .order("scheduled_start", { ascending: true });
      if (err) throw err;
      return data as any[];
    },
  });

  const filtered = useMemo(
    () => shifts.filter((s) => participantFilter === "all" || s.participant_id === participantFilter),
    [shifts, participantFilter]
  );
  const weekShifts = useMemo(() => filtered.filter((s) => isInWeek(s, weekStart)), [filtered, weekStart]);
  const rows = useMemo(() => rosterRows(filtered, weekStart, staff.map((s: any) => s.id)), [filtered, weekStart, staff]);
  const conflicts = useMemo(() => conflictingShiftIds(weekShifts), [weekShifts]);
  const coverage = useMemo(() => rosterCoverage(weekShifts), [weekShifts]);

  const workerName = (id: string) =>
    id === UNASSIGNED ? "Unfilled shifts" : (staff.find((s: any) => s.id === id)?.full_name ?? "Worker");
  const participantName = (id: string | null | undefined) =>
    participants.find((p: any) => p.id === id)?.full_name ?? "Participant";

  const assign = useMutation({
    mutationFn: async () => {
      if (!assignTarget) return;
      const eligibility = await checkAssignmentEligible(assignWorker);
      const found = reassignBlockers({
        shift: assignTarget,
        workerId: assignWorker || null,
        workerEligible: eligibility.allowed,
        workerEligibilityReason: eligibility.reason,
        clashes: clashesForWorker(filtered, assignWorker, assignTarget),
      });
      setBlockers(found);
      if (found.length > 0) throw new Error(found.join(" "));

      const { error: err } = await supabase
        .from("service_shifts" as any)
        .update({ worker_id: assignWorker })
        .eq("id", assignTarget.id);
      if (err) throw err;
      await logAudit({ action: "shift_reassigned", module: "service_shifts", record_id: assignTarget.id, details: { worker_id: assignWorker } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roster-shifts"] });
      qc.invalidateQueries({ queryKey: ["my-shifts"] });
      qc.invalidateQueries({ queryKey: ["scheduled-shifts"] });
      setAssignTarget(null);
      setAssignWorker("");
      setBlockers([]);
      toast({ title: "Worker assigned" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Blocked", description: e.message }),
  });

  function openAssign(shift: RosterShift) {
    setAssignTarget(shift);
    setAssignWorker(shift.worker_id ?? "");
    setBlockers([]);
  }

  if (!canRoster) {
    return <EmptyState title="Roster not available" description="You need supervisor, compliance or administrator access to view the roster." />;
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Roster"
        description="Weekly view of every scheduled service. Fill unassigned shifts, spot double bookings and track scheduled against delivered hours."
      />
      <HumanReviewNotice>
        Coverage figures and clash warnings support your rostering decision. An authorised person remains responsible
        for who attends each service.
      </HumanReviewNotice>
      {isMockAudit && <ReadOnlyNotice reason="Mock audit mode is active — the roster is read only." />}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Previous week
        </Button>
        <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          This week
        </Button>
        <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Next week <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
        </Button>
        <p className="font-medium" aria-live="polite">{weekLabel(weekStart)}</p>
        <div className="ml-auto w-full sm:w-64">
          <Label htmlFor="roster-participant" className="sr-only">Filter by participant</Label>
          <Select value={participantFilter} onValueChange={setParticipantFilter}>
            <SelectTrigger id="roster-participant" className="min-h-[44px]">
              <SelectValue placeholder="All participants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All participants</SelectItem>
              {participants.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Shifts this week", value: coverage.total },
          { label: "Unfilled", value: coverage.unfilled },
          { label: "Scheduled hours", value: coverage.scheduledHours },
          { label: "Delivered hours", value: coverage.deliveredHours },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {coverage.conflicts > 0 && (
        <BlockerAlert
          title="Double bookings detected"
          blockers={[`${coverage.conflicts} shift(s) overlap for the same worker this week. Reassign or reschedule them.`]}
        />
      )}

      {isLoading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No shifts this week"
          description="Schedule services in Service operations, then return here to review coverage."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Week roster</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <caption className="sr-only">Shifts by worker for {weekLabel(weekStart)}</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="p-2 text-left">Worker</th>
                  {weekDays(weekStart).map((d, i) => (
                    <th key={d.toISOString()} scope="col" className="p-2 text-left">
                      {DAY_LABEL[i]} {d.getDate()}/{d.getMonth() + 1}
                    </th>
                  ))}
                  <th scope="col" className="p-2 text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.workerId} className="border-b align-top">
                    <th scope="row" className="p-2 text-left font-medium">
                      {row.workerId === UNASSIGNED ? (
                        <span className="text-destructive">Unfilled shifts</span>
                      ) : (
                        workerName(row.workerId)
                      )}
                    </th>
                    {row.days.map((day, i) => (
                      <td key={i} className="p-2">
                        <div className="space-y-1">
                          {day.map((s) => (
                            <div
                              key={s.id}
                              className={`rounded-md border p-2 ${conflicts.has(s.id) ? "border-destructive" : "border-border"}`}
                            >
                              <p className="font-medium">{formatTimeRange(s)}</p>
                              <p className="text-xs text-muted-foreground">{participantName(s.participant_id)}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  {SHIFT_STATUS_LABEL[(s.status ?? "scheduled") as ShiftStatus] ?? s.status}
                                </Badge>
                                {conflicts.has(s.id) && (
                                  <Badge variant="destructive" className="text-xs">
                                    <TriangleAlert className="mr-1 h-3 w-3" aria-hidden="true" /> Clash
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {canEdit && (
                                  <Button variant="outline" size="sm" className="min-h-[36px]" onClick={() => openAssign(s)}>
                                    {row.workerId === UNASSIGNED ? "Assign" : "Reassign"}
                                  </Button>
                                )}
                                <Button asChild variant="ghost" size="sm" className="min-h-[36px]">
                                  <Link to={`/my-shifts/${s.id}`}>Open</Link>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    ))}
                    <td className="p-2 text-right font-medium">{Math.round(row.hours * 100) / 100}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign a worker</DialogTitle>
          </DialogHeader>
          {assignTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {participantName(assignTarget.participant_id)} · {new Date(assignTarget.scheduled_start).toLocaleDateString()}{" "}
                {formatTimeRange(assignTarget)}
              </p>
              <div className="space-y-1">
                <Label htmlFor="assign-worker">Worker</Label>
                <Select value={assignWorker} onValueChange={setAssignWorker}>
                  <SelectTrigger id="assign-worker" className="min-h-[44px]">
                    <SelectValue placeholder="Select a worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {blockers.length > 0 && <BlockerAlert blockers={blockers} />}
              <Button className="min-h-[44px] w-full" disabled={assign.isPending} onClick={() => assign.mutate()}>
                {assign.isPending ? "Checking eligibility…" : "Assign worker"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
