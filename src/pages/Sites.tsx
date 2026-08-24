import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { withOrg } from "@/hooks/useComplianceLookups";
import { BlockerAlert, EmptyState, ErrorState, LoadingState, PageHeading, ReadOnlyNotice } from "@/components/compliance/GateUI";
import { SITE_TYPES, siteBlockers } from "@/lib/workforce";
import { toSafeError } from "@/lib/userFacingError";

const EMPTY = { geofence_radius_metres: 150 } as Record<string, any>;

export default function Sites() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canManage = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer", "supervisor"]);
  const [form, setForm] = useState<Record<string, any>>(EMPTY);
  const [blockers, setBlockers] = useState<string[]>([]);

  const { data: sites = [], isLoading, error, refetch } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sites" as any).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const createSite = useMutation({
    mutationFn: async () => {
      const found = siteBlockers(form);
      setBlockers(found);
      if (found.length) throw new Error(found[0]);
      const payload = withOrg(
        {
          name: form.name?.trim(),
          site_type: form.site_type,
          address_line1: form.address_line1 ?? null,
          suburb: form.suburb ?? null,
          state: form.state ?? null,
          postcode: form.postcode ?? null,
          latitude: form.latitude === "" || form.latitude == null ? null : Number(form.latitude),
          longitude: form.longitude === "" || form.longitude == null ? null : Number(form.longitude),
          geofence_radius_metres: Number(form.geofence_radius_metres),
          notes: form.notes ?? null,
          active: true,
        },
        user?.organisation_id,
        user?.id
      );
      const { data, error } = await supabase.from("sites" as any).insert(payload).select("id").single();
      if (error) throw error;
      await logAudit({ action: "site_created", module: "sites", record_id: (data as any)?.id, details: { name: payload.name } });
      return data;
    },
    onSuccess: () => {
      toast({ title: "Site added", description: "The site is now available for rostering and geofencing." });
      setForm(EMPTY);
      setBlockers([]);
      qc.invalidateQueries({ queryKey: ["sites"] });
    },
    onError: (e) => {
      const safe = toSafeError(e, "create this site");
      toast({ title: safe.title, description: safe.description, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (site: any) => {
      const { error } = await supabase.from("sites" as any).update({ active: !site.active }).eq("id", site.id);
      if (error) throw error;
      await logAudit({ action: site.active ? "site_deactivated" : "site_reactivated", module: "sites", record_id: site.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
    onError: (e) => {
      const safe = toSafeError(e, "update this site");
      toast({ title: safe.title, description: safe.description, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeading
        title="Sites"
        description="Service locations used for rostering, geofenced check-in and evidence provenance. Sites are archived by deactivation — records are never deleted."
      />

      {!canManage && (
        <ReadOnlyNotice reason={isMockAudit ? "Mock audit mode is on — editing is disabled." : "Your role can view sites but not change them."} />
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add a site</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BlockerAlert blockers={blockers} title="Fix before saving" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="site-name">Site name</Label>
                <Input id="site-name" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-type">Site type</Label>
                <select
                  id="site-type"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.site_type ?? ""}
                  onChange={(e) => setForm({ ...form, site_type: e.target.value })}
                >
                  <option value="">Select a type</option>
                  {SITE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-address">Street address</Label>
                <Input id="site-address" value={form.address_line1 ?? ""} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-suburb">Suburb</Label>
                <Input id="site-suburb" value={form.suburb ?? ""} onChange={(e) => setForm({ ...form, suburb: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-state">State</Label>
                <Input id="site-state" value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-postcode">Postcode</Label>
                <Input id="site-postcode" inputMode="numeric" value={form.postcode ?? ""} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-lat">Latitude (optional)</Label>
                <Input id="site-lat" value={form.latitude ?? ""} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-lng">Longitude (optional)</Label>
                <Input id="site-lng" value={form.longitude ?? ""} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-radius">Geofence radius (metres)</Label>
                <Input
                  id="site-radius"
                  inputMode="numeric"
                  value={form.geofence_radius_metres ?? ""}
                  onChange={(e) => setForm({ ...form, geofence_radius_metres: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="site-notes">Access notes</Label>
                <Textarea id="site-notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <Button onClick={() => createSite.mutate()} disabled={createSite.isPending}>
              {createSite.isPending ? "Saving..." : "Add site"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Site register ({sites.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} scope="sites" />
          ) : sites.length === 0 ? (
            <EmptyState title="No sites yet" description="Add the locations your teams work from so shifts can be geofenced and evidence can be traced to a place." />
          ) : (
            <ul className="divide-y">
              {sites.map((site) => (
                <li key={site.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{site.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[SITE_TYPES.find((t) => t.value === site.site_type)?.label, site.suburb, site.state, site.postcode].filter(Boolean).join(" · ")}
                      {" · "}
                      {site.geofence_radius_metres}m geofence
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={site.active ? "secondary" : "outline"}>{site.active ? "Active" : "Inactive"}</Badge>
                    {canManage && (
                      <Button size="sm" variant="outline" onClick={() => toggleActive.mutate(site)}>
                        {site.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
