import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { BlockerAlert, EmptyState, ErrorState, LoadingState, PageHeading, StatusPill } from "@/components/compliance/GateUI";
import { formatMoney } from "@/lib/platform";

const emptyForm = () => ({
  code: "",
  name: "",
  description: "",
  monthly_price: "0",
  included_users: "1",
  unlimited_users: false,
  trial_days: "14",
  module_entitlements: "dashboard, incidents, participants",
});

export default function PlatformPackages() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm());

  const packages = useQuery({
    queryKey: ["platform-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_packages" as any)
        .select("*")
        .order("monthly_price");
      if (error) throw error;
      return data as any[];
    },
  });

  const blockers: string[] = [];
  if (form.code.trim().length < 2) blockers.push("A short code is required.");
  if (form.name.trim().length < 2) blockers.push("A package name is required.");
  if (Number(form.monthly_price) < 0) blockers.push("Monthly price cannot be negative.");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subscription_packages" as any).insert({
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
        description: form.description || null,
        monthly_price: Number(form.monthly_price),
        included_users: Number(form.included_users),
        unlimited_users: form.unlimited_users,
        trial_days: Number(form.trial_days),
        module_entitlements: form.module_entitlements.split(",").map((s) => s.trim()).filter(Boolean),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["platform-packages"] });
      toast({ title: "Package created", description: "Existing subscriptions stay on their current package version until you migrate them." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not save package", description: e.message }),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("subscription_packages" as any)
        .update({ is_active: false, archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-packages"] });
      toast({ title: "Package archived", description: "It is hidden from new clients. Current subscribers are unaffected." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not archive", description: e.message }),
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Packages"
        description="Configure the offers shown when you provision a client. Pricing, seat limits and module access are all editable — nothing is hard-coded."
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Create a package version</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="pk-code">Code</Label>
            <Input id="pk-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pk-name">Name</Label>
            <Input id="pk-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pk-price">Monthly price (AUD)</Label>
            <Input id="pk-price" type="number" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pk-users">Included users</Label>
            <Input id="pk-users" type="number" value={form.included_users} onChange={(e) => setForm({ ...form, included_users: e.target.value })} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pk-trial">Trial days</Label>
            <Input id="pk-trial" type="number" value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: e.target.value })} className="min-h-[44px]" />
          </div>
          <div className="flex items-end">
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input type="checkbox" checked={form.unlimited_users} onChange={(e) => setForm({ ...form, unlimited_users: e.target.checked })} />
              Unlimited users
            </label>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="pk-modules">Module entitlements (comma separated)</Label>
            <Input id="pk-modules" value={form.module_entitlements} onChange={(e) => setForm({ ...form, module_entitlements: e.target.value })} className="min-h-[44px]" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="pk-desc">Description</Label>
            <Textarea id="pk-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2 space-y-3">
            <BlockerAlert blockers={blockers} title="Package incomplete" />
            <Button className="min-h-[44px]" disabled={blockers.length > 0 || save.isPending} onClick={() => save.mutate()}>
              Save package
            </Button>
          </div>
        </CardContent>
      </Card>

      {packages.isLoading && <LoadingState rows={3} />}
      {packages.error && <ErrorState error={packages.error} />}
      {!packages.isLoading && (packages.data ?? []).length === 0 && (
        <EmptyState title="No packages yet" description="Create at least one package before provisioning clients." />
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {(packages.data ?? []).map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                {p.name}
                <StatusPill tone={p.is_active ? "ok" : "neutral"}>{p.is_active ? "Active" : "Archived"}</StatusPill>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-xl font-bold">{formatMoney(p.monthly_price)}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
              <p className="text-muted-foreground">{p.unlimited_users ? "Unlimited users" : `Up to ${p.included_users} users`} · v{p.version}</p>
              <p className="text-muted-foreground">{p.description}</p>
              <p className="text-xs text-muted-foreground">{(p.module_entitlements ?? []).join(", ")}</p>
              {p.is_active && (
                <Button variant="outline" className="min-h-[44px]" onClick={() => archive.mutate(p.id)}>Archive</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
