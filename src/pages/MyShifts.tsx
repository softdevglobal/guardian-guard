import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronRight, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingState, PageHeading } from "@/components/compliance/GateUI";
import { useParticipants } from "@/hooks/useComplianceLookups";
import { SHIFT_STATUS_LABEL, shiftTab, type ShiftStatus, type ShiftTab } from "@/lib/serviceShifts";

const NEXT_ACTION: Record<ShiftStatus, string> = {
  scheduled: "Check in",
  checked_in: "Start service",
  in_progress: "Complete tasks",
  correction_required: "Fix and resubmit",
  submitted: "View submitted service",
  approved: "View approved record",
  cancelled: "View cancelled shift",
};

export default function MyShifts() {
  const { user } = useAuth();
  const { data: participants = [] } = useParticipants();

  const { data: shifts = [], isLoading, error } = useQuery({
    queryKey: ["my-shifts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("service_shifts" as any)
        .select("*")
        .eq("worker_id", user!.id)
        .eq("record_status", "active")
        .order("scheduled_start", { ascending: true });
      if (err) throw err;
      return data as any[];
    },
  });

  const participantName = (id: string) => participants.find((p) => p.id === id)?.full_name ?? "Participant";

  const grouped = useMemo(() => {
    const g: Record<ShiftTab, any[]> = { today: [], upcoming: [], completed: [] };
    shifts.forEach((s) => g[shiftTab(s)].push(s));
    return g;
  }, [shifts]);

  function ShiftCard({ shift }: { shift: any }) {
    const start = new Date(shift.scheduled_start);
    const end = new Date(shift.scheduled_end);
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{participantName(shift.participant_id)}</h3>
              <p className="text-sm text-muted-foreground">{shift.service_type || shift.support_item || "Support service"}</p>
            </div>
            <Badge variant={shift.status === "correction_required" ? "destructive" : "secondary"}>
              {SHIFT_STATUS_LABEL[shift.status as ShiftStatus]}
            </Badge>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <dt className="sr-only">Scheduled time</dt>
              <dd>
                {start.toLocaleDateString()} · {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <dt className="sr-only">Location</dt>
              <dd>{shift.address_label || "Location provided at check in"}</dd>
            </div>
          </dl>
          <Button asChild className="min-h-[44px] w-full">
            <Link to={`/my-shifts/${shift.id}`}>
              {NEXT_ACTION[shift.status as ShiftStatus]}
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeading
        title="My shifts"
        description="Only the shifts assigned to you appear here. Check in, complete the agreed tasks, record your notes and submit the service for supervisor approval."
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <Tabs defaultValue="today">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="today" className="min-h-[44px]">Today ({grouped.today.length})</TabsTrigger>
            <TabsTrigger value="upcoming" className="min-h-[44px]">Upcoming ({grouped.upcoming.length})</TabsTrigger>
            <TabsTrigger value="completed" className="min-h-[44px]">Completed ({grouped.completed.length})</TabsTrigger>
          </TabsList>
          {(["today", "upcoming", "completed"] as ShiftTab[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-3">
              {grouped[tab].length === 0 ? (
                <EmptyState
                  title="No shifts to show"
                  description={
                    tab === "today"
                      ? "You have no shifts scheduled for today. Check the upcoming tab."
                      : tab === "upcoming"
                        ? "No future shifts have been assigned to you yet."
                        : "Completed and submitted services will appear here."
                  }
                />
              ) : (
                grouped[tab].map((s) => <ShiftCard key={s.id} shift={s} />)
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
