import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState, PageHeading, StatusPill } from "@/components/compliance/GateUI";
import { daysUntil, expiryTone, formatMoney } from "@/lib/platform";

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

export default function PlatformDashboard() {
  const [fromDate, setFromDate] = useState("");
  const [status, setStatus] = useState("");

  const summary = useQuery({
    queryKey: ["platform-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_dashboard_summary" as any);
      if (error) throw error;
      return data as any;
    },
  });

  const activity = useQuery({
    queryKey: ["platform-activity", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_activity_events" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data as any[];
    },
  });

  const docs = useQuery({
    queryKey: ["platform-expiring-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organisation_documents" as any)
        .select("id, organisation_id, title, expiry_date, is_critical")
        .not("expiry_date", "is", null)
        .order("expiry_date")
        .limit(25);
      if (error) throw error;
      return data as any[];
    },
  });

  const filteredActivity = useMemo(() => {
    return (activity.data ?? []).filter((e) => {
      if (fromDate && new Date(e.created_at) < new Date(fromDate)) return false;
      if (status && !(e.event_type ?? "").includes(status)) return false;
      return true;
    });
  }, [activity.data, fromDate, status]);

  const s = summary.data ?? {};

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Platform dashboard"
        description="Guardian Guard SaaS owner view. Monitors client tenants, trials, manual revenue and onboarding backlog. Figures are operational metrics only — they are not an audit or compliance determination."
        actions={
          <Button asChild className="min-h-[44px]">
            <Link to="/platform/clients/new">Add client</Link>
          </Button>
        }
      />

      {summary.isLoading && <LoadingState rows={2} />}
      {summary.error && <ErrorState error={summary.error} />}
      {summary.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Client tenants" value={String(s.tenants ?? 0)} hint={`${s.demo_tenants ?? 0} demo tenants excluded`} />
          <Metric label="Active trials" value={String(s.trials ?? 0)} />
          <Metric label="Active subscriptions" value={String(s.active ?? 0)} hint={`${s.past_due ?? 0} past due · ${s.suspended ?? 0} suspended`} />
          <Metric label="MRR (contracted)" value={formatMoney(s.mrr)} hint={`${formatMoney(s.income_received)} manually received`} />
          <Metric label="Onboarding backlog" value={String(s.onboarding_backlog ?? 0)} hint="Submitted, awaiting your review" />
          <Metric label="Expiring critical documents" value={String(s.expiring_documents ?? 0)} hint="Within 60 days" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="from-date">Activity from</Label>
            <Input id="from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="event-filter">Event contains</Label>
            <Input id="event-filter" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="e.g. suspended" className="min-h-[44px]" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent platform activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activity.isLoading && <LoadingState rows={3} />}
            {activity.error && <ErrorState error={activity.error} />}
            {!activity.isLoading && filteredActivity.length === 0 && (
              <EmptyState title="No activity yet" description="Client provisioning, package changes and support sessions will appear here." />
            )}
            {filteredActivity.map((e) => (
              <div key={e.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="neutral">{e.event_type}</StatusPill>
                  <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm">{e.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expiring client documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {docs.isLoading && <LoadingState rows={3} />}
            {docs.error && <ErrorState error={docs.error} />}
            {!docs.isLoading && (docs.data ?? []).length === 0 && (
              <EmptyState title="No dated documents" description="Licence and insurance expiries appear once clients upload evidence during onboarding." />
            )}
            {(docs.data ?? []).map((d) => {
              const days = daysUntil(d.expiry_date);
              return (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">Expires {d.expiry_date}</p>
                  </div>
                  <StatusPill tone={expiryTone(days)}>
                    {days === null ? "No date" : days < 0 ? `${Math.abs(days)} days overdue` : `${days} days`}
                  </StatusPill>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
