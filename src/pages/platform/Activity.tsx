import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState, PageHeading, StatusPill } from "@/components/compliance/GateUI";

export default function PlatformActivity() {
  const [tenant, setTenant] = useState("");
  const [eventType, setEventType] = useState("");
  const [fromDate, setFromDate] = useState("");

  const data = useQuery({
    queryKey: ["platform-activity-all"],
    queryFn: async () => {
      const [events, orgs] = await Promise.all([
        supabase.from("platform_activity_events" as any).select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("organisations" as any).select("id, legal_name, name"),
      ]);
      if (events.error) throw events.error;
      return { events: (events.data ?? []) as any[], orgs: (orgs.data ?? []) as any[] };
    },
  });

  const rows = useMemo(() => {
    return (data.data?.events ?? []).filter((e) => {
      if (tenant && e.organisation_id !== tenant) return false;
      if (eventType && !(e.event_type ?? "").includes(eventType)) return false;
      if (fromDate && new Date(e.created_at) < new Date(fromDate)) return false;
      return true;
    });
  }, [data.data, tenant, eventType, fromDate]);

  const orgName = (id: string) => {
    const o = (data.data?.orgs ?? []).find((x) => x.id === id);
    return o?.legal_name ?? o?.name ?? "Platform";
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Platform activity"
        description="Append-only record of cross-tenant platform actions: provisioning, package changes, suspensions, invitations and support sessions."
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="act-tenant">Tenant</Label>
            <select id="act-tenant" className="min-h-[44px] w-full rounded-md border bg-background px-3 text-sm" value={tenant} onChange={(e) => setTenant(e.target.value)}>
              <option value="">All tenants</option>
              {(data.data?.orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.legal_name ?? o.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="act-type">Event type contains</Label>
            <Input id="act-type" value={eventType} onChange={(e) => setEventType(e.target.value)} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="act-from">From date</Label>
            <Input id="act-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="min-h-[44px]" />
          </div>
        </CardContent>
      </Card>

      {data.isLoading && <LoadingState rows={5} />}
      {data.error && <ErrorState error={data.error} />}
      {!data.isLoading && rows.length === 0 && (
        <EmptyState title="No matching activity" description="Widen your filters, or check back after you provision or change a client." />
      )}

      <div className="space-y-2">
        {rows.map((e) => (
          <Card key={e.id}>
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="neutral">{e.event_type}</StatusPill>
                <span className="text-sm font-medium">{orgName(e.organisation_id)}</span>
                <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()} · {e.actor_label ?? "system"}</span>
              </div>
              <p className="mt-1 text-sm">{e.summary}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
