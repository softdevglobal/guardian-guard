import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill } from "@/components/compliance/GateUI";
import { buildCalendar, summariseCalendar, urgencyLabel, urgencyTone, type CalendarEvent } from "@/lib/complianceCalendar";
import { labelValue } from "@/lib/correctiveActions";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function ComplianceCalendar() {
  const { user } = useAuth();
  const [band, setBand] = useState("all");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["compliance-calendar"],
    queryFn: async () => {
      const [documents, personnel, policies, capa, tasks, org] = await Promise.all([
        supabase.from("organisation_documents" as any).select("id, title, expiry_date, is_critical").not("expiry_date", "is", null),
        supabase.from("key_personnel" as any).select("id, full_name, worker_screening_expiry, police_check_expiry").eq("status", "active"),
        supabase.from("policies" as any).select("id, title, next_review_date").not("next_review_date", "is", null),
        supabase.from("corrective_actions" as any).select("id, action, due_date, status"),
        supabase.from("platform_tasks" as any).select("id, title, due_date, status"),
        supabase.from("organisations" as any).select("registration_expiry, registration_number").eq("id", user?.organisation_id ?? "").maybeSingle(),
      ]);
      for (const r of [documents, personnel, policies, capa, tasks]) if (r.error) throw r.error;
      return buildCalendar({
        documents: (documents.data as any[]) ?? [],
        personnel: (personnel.data as any[]) ?? [],
        policies: (policies.data as any[]) ?? [],
        correctiveActions: (capa.data as any[]) ?? [],
        platformTasks: (tasks.data as any[]) ?? [],
        registration: org.data ? { expiry: (org.data as any).registration_expiry, number: (org.data as any).registration_number } : null,
      });
    },
  });

  const events: CalendarEvent[] = data ?? [];
  const summary = summariseCalendar(events);
  const filtered = useMemo(() => (band === "all" ? events : events.filter((e) => e.urgency === band)), [events, band]);

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Compliance calendar"
        description="Every dated obligation Guardian Guard holds — document and insurance expiries, key personnel screening, policy reviews, corrective action due dates and registration renewal — in one forward view."
      />

      <HumanReviewNotice>
        Dates come from the records your organisation has entered. An empty calendar means nothing is recorded, not that nothing is due.
      </HumanReviewNotice>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Expired" value={String(summary.expired)} hint="Past the recorded date" />
        <Metric label="Critical (14 days)" value={String(summary.critical)} />
        <Metric label="Due soon (30 days)" value={String(summary.dueSoon)} />
        <Metric label="Upcoming" value={String(summary.upcoming)} hint="Beyond 30 days" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="max-w-sm space-y-1">
          <Label htmlFor="calendar-band">Urgency</Label>
          <Select value={band} onValueChange={setBand}>
            <SelectTrigger id="calendar-band" className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="due_soon">Due soon</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          title="Nothing scheduled"
          description="Expiry dates appear once documents, key personnel screening, policy reviews and corrective actions are recorded."
        />
      )}

      {filtered.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obligation</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Go to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="max-w-sm">
                      <p className="font-medium">{e.title}</p>
                      {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                    </TableCell>
                    <TableCell>{labelValue(e.source)}</TableCell>
                    <TableCell>{e.dueDate}</TableCell>
                    <TableCell>{e.daysUntil < 0 ? `${Math.abs(e.daysUntil)} days ago` : `${e.daysUntil} days`}</TableCell>
                    <TableCell>
                      <StatusPill tone={urgencyTone(e.urgency)}>{urgencyLabel(e.urgency)}</StatusPill>
                    </TableCell>
                    <TableCell className="text-right">
                      {e.link && (
                        <Button asChild variant="outline" size="sm" className="min-h-[36px]">
                          <Link to={e.link}>Open</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
