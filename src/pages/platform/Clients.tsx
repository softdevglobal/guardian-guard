import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState, PageHeading, StatusPill } from "@/components/compliance/GateUI";
import { formatAbn } from "@/lib/abn";
import { formatMoney } from "@/lib/platform";

const STATUS_TONE: Record<string, string> = {
  active: "ok",
  onboarding: "warn",
  suspended: "bad",
  cancelled: "bad",
};

export default function PlatformClients() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [includeDemo, setIncludeDemo] = useState(false);

  const clients = useQuery({
    queryKey: ["platform-clients"],
    queryFn: async () => {
      const [orgs, subs, onboarding, profiles, income] = await Promise.all([
        supabase.from("organisations" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("tenant_subscriptions" as any).select("*, subscription_packages(name, code, monthly_price)"),
        supabase.from("organisation_onboarding" as any).select("organisation_id, status, progress_pct"),
        supabase.from("user_profiles" as any).select("id, organisation_id"),
        supabase.from("platform_income_records" as any).select("organisation_id, amount, status"),
      ]);
      if (orgs.error) throw orgs.error;
      return {
        orgs: (orgs.data ?? []) as any[],
        subs: (subs.data ?? []) as any[],
        onboarding: (onboarding.data ?? []) as any[],
        profiles: (profiles.data ?? []) as any[],
        income: (income.data ?? []) as any[],
      };
    },
  });

  const rows = useMemo(() => {
    const d = clients.data;
    if (!d) return [];
    return d.orgs
      .filter((o) => includeDemo || !o.is_demo)
      .map((o) => {
        const sub = d.subs.find((s) => s.organisation_id === o.id);
        const onb = d.onboarding.find((s) => s.organisation_id === o.id);
        const users = d.profiles.filter((p) => p.organisation_id === o.id).length;
        const revenue = d.income
          .filter((r) => r.organisation_id === o.id && r.status === "received")
          .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
        return { org: o, sub, onb, users, revenue };
      })
      .filter((r) => {
        if (statusFilter && r.org.account_status !== statusFilter) return false;
        if (!search) return true;
        const hay = `${r.org.legal_name ?? ""} ${r.org.trading_name ?? ""} ${r.org.name ?? ""} ${r.org.abn ?? ""}`.toLowerCase();
        return hay.includes(search.toLowerCase());
      });
  }, [clients.data, search, statusFilter, includeDemo]);

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Clients"
        description="Every provider organisation on Guardian Guard. Search, check onboarding progress and open a client to manage its package, documents and account status."
        actions={
          <Button asChild className="min-h-[44px]">
            <Link to="/platform/clients/new">Add client</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find a client</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="client-search">Search name or ABN</Label>
            <Input id="client-search" value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="client-status">Account status</Label>
            <select
              id="client-status"
              className="min-h-[44px] w-full rounded-md border bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
              Show demo / audit tenants
            </label>
          </div>
        </CardContent>
      </Card>

      {clients.isLoading && <LoadingState rows={4} />}
      {clients.error && <ErrorState error={clients.error} />}
      {!clients.isLoading && rows.length === 0 && (
        <EmptyState
          title="No clients match"
          description="Adjust your filters, or use Add client to provision a new provider organisation with a package and trial."
        />
      )}

      <div className="space-y-3">
        {rows.map(({ org, sub, onb, users, revenue }) => (
          <Card key={org.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-[220px]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{org.legal_name ?? org.name}</p>
                  {org.is_demo && <StatusPill tone="neutral">Demo data</StatusPill>}
                  <StatusPill tone={STATUS_TONE[org.account_status] ?? "neutral"}>{org.account_status ?? "unknown"}</StatusPill>
                </div>
                <p className="text-xs text-muted-foreground">
                  {org.abn ? `ABN ${formatAbn(org.abn)}` : "No ABN recorded"} · {org.primary_contact_email ?? "no contact"}
                </p>
              </div>
              <div className="text-sm">
                <p>{sub?.subscription_packages?.name ?? "No package"}</p>
                <p className="text-xs text-muted-foreground">{sub?.status ?? "—"}</p>
              </div>
              <div className="text-sm">
                <p>Onboarding {onb?.progress_pct ?? 0}%</p>
                <p className="text-xs text-muted-foreground">{onb?.status ?? "not started"}</p>
              </div>
              <div className="text-sm">
                <p>{users} users</p>
                <p className="text-xs text-muted-foreground">{formatMoney(revenue)} received</p>
              </div>
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link to={`/platform/clients/${org.id}`}>Manage</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
