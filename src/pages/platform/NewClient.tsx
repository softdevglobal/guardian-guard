import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { BlockerAlert, PageHeading } from "@/components/compliance/GateUI";
import { formatAbn } from "@/lib/abn";
import { emptyNewClientForm, formatMoney, newClientBlockers, type NewClientForm } from "@/lib/platform";
import { callPlatformAdmin } from "@/lib/platformApi";

export default function NewClient() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<NewClientForm>(emptyNewClientForm());
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const set = (key: keyof NewClientForm, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  const options = useQuery({
    queryKey: ["platform-new-client-options"],
    queryFn: async () => {
      const [pathways, packages] = await Promise.all([
        supabase.from("provider_pathways" as any).select("*").eq("is_active", true).order("name"),
        supabase.from("subscription_packages" as any).select("*").eq("is_active", true).order("monthly_price"),
      ]);
      return { pathways: (pathways.data ?? []) as any[], packages: (packages.data ?? []) as any[] };
    },
  });

  const blockers = newClientBlockers(form);
  const pkg = (options.data?.packages ?? []).find((p) => p.id === form.package_id);
  const pathway = (options.data?.pathways ?? []).find((p) => p.id === form.pathway_id);

  const provision = useMutation({
    mutationFn: async () =>
      callPlatformAdmin({
        action: "provision_client",
        ...form,
        trading_name: form.trading_name || null,
        acn: form.acn || null,
        primary_contact_phone: form.primary_contact_phone || null,
        address_line1: form.address_line1 || null,
        suburb: form.suburb || null,
        state: form.state || null,
        postcode: form.postcode || null,
        trial_days: Number(form.trial_days),
      }),
    onSuccess: (data: any) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["platform-clients"] });
      qc.invalidateQueries({ queryKey: ["platform-summary"] });
      toast({
        title: data.invite_status === "sent" ? "Client created" : "Client created — invitation pending",
        description:
          data.invite_status === "sent"
            ? "The tenant admin can sign in and start onboarding."
            : "The organisation was created but the invitation failed. Resend it from the client page.",
      });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not create client", description: e.message }),
  });

  if (result) {
    return (
      <div className="space-y-6 p-6">
        <PageHeading title="Client created" description="Provisioning finished. Share the sign-in details securely — never by unencrypted channels." />
        <Card>
          <CardContent className="space-y-3 py-6 text-sm">
            <p><strong>{form.legal_name}</strong> is now on the {pkg?.name} package with a {form.trial_days}-day trial.</p>
            <p>Invitation status: <strong>{result.invite_status}</strong>{result.invite_error ? ` — ${result.invite_error}` : ""}</p>
            {result.temp_password && (
              <p className="rounded-md border border-warning p-3">
                Temporary password for {form.admin_email}: <code>{result.temp_password}</code>
                <br />
                <span className="text-xs text-muted-foreground">Shown once. The tenant admin should change it on first login.</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button className="min-h-[44px]" onClick={() => navigate(`/platform/clients/${result.organisation_id}`)}>
                Open client
              </Button>
              <Button variant="outline" className="min-h-[44px]" onClick={() => { setResult(null); setForm(emptyNewClientForm()); setReviewing(false); }}>
                Add another client
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Add client"
        description="Creates the provider organisation, its subscription, onboarding record and first tenant admin invitation in one transaction. You review everything before it is created."
      />

      {!reviewing ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Business identity</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="legal_name" label="Legal entity name" value={form.legal_name} onChange={(v) => set("legal_name", v)} required />
              <Field id="trading_name" label="Trading name" value={form.trading_name} onChange={(v) => set("trading_name", v)} />
              <Field id="abn" label="ABN (11 digits)" value={form.abn} onChange={(v) => set("abn", v)} required hint="Checksum is validated locally; no registry lookup is performed." />
              <Field id="acn" label="ACN (optional)" value={form.acn} onChange={(v) => set("acn", v)} />
              <Field id="address_line1" label="Street address" value={form.address_line1} onChange={(v) => set("address_line1", v)} />
              <Field id="suburb" label="Suburb" value={form.suburb} onChange={(v) => set("suburb", v)} />
              <Field id="state" label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field id="postcode" label="Postcode" value={form.postcode} onChange={(v) => set("postcode", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Primary contact</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="pc_name" label="Contact name" value={form.primary_contact_name} onChange={(v) => set("primary_contact_name", v)} required />
              <Field id="pc_email" label="Contact email" type="email" value={form.primary_contact_email} onChange={(v) => set("primary_contact_email", v)} required />
              <Field id="pc_phone" label="Contact phone" value={form.primary_contact_phone} onChange={(v) => set("primary_contact_phone", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Pathway, package and trial</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pathway">Provider pathway</Label>
                <select id="pathway" className="min-h-[44px] w-full rounded-md border bg-background px-3 text-sm" value={form.pathway_id} onChange={(e) => set("pathway_id", e.target.value)}>
                  <option value="">Select a pathway</option>
                  {(options.data?.pathways ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="package">Subscription package</Label>
                <select id="package" className="min-h-[44px] w-full rounded-md border bg-background px-3 text-sm" value={form.package_id} onChange={(e) => set("package_id", e.target.value)}>
                  <option value="">Select a package</option>
                  {(options.data?.packages ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.monthly_price)}/mo · {p.unlimited_users ? "unlimited users" : `${p.included_users} users`}
                    </option>
                  ))}
                </select>
              </div>
              <Field id="trial_start" label="Trial start date" type="date" value={form.trial_start_date} onChange={(v) => set("trial_start_date", v)} required />
              <Field id="trial_days" label="Trial days" type="number" value={String(form.trial_days)} onChange={(v) => set("trial_days", Number(v))} required />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">First tenant admin</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field id="admin_name" label="Full name" value={form.admin_full_name} onChange={(v) => set("admin_full_name", v)} required />
              <Field id="admin_email" label="Email" type="email" value={form.admin_email} onChange={(v) => set("admin_email", v)} required hint="Single-use invitation; resendable and audit logged." />
            </CardContent>
          </Card>

          <BlockerAlert blockers={blockers} title="Complete these before review" />
          <Button className="min-h-[44px]" disabled={blockers.length > 0} onClick={() => setReviewing(true)}>
            Review before creating
          </Button>
        </>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Review</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Legal entity" value={form.legal_name} />
            <Row label="Trading name" value={form.trading_name || "—"} />
            <Row label="ABN" value={formatAbn(form.abn)} />
            <Row label="Primary contact" value={`${form.primary_contact_name} · ${form.primary_contact_email}`} />
            <Row label="Pathway" value={pathway?.name ?? "—"} />
            <Row label="Package" value={pkg ? `${pkg.name} — ${formatMoney(pkg.monthly_price)}/mo` : "—"} />
            <Row label="Trial" value={`${form.trial_days} days from ${form.trial_start_date}`} />
            <Row label="Tenant admin" value={`${form.admin_full_name} · ${form.admin_email}`} />
            <div className="flex flex-wrap gap-2 pt-4">
              <Button className="min-h-[44px]" disabled={provision.isPending} onClick={() => provision.mutate()}>
                {provision.isPending ? "Creating…" : "Create client"}
              </Button>
              <Button variant="outline" className="min-h-[44px]" onClick={() => setReviewing(false)}>Back to edit</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  id, label, value, onChange, type = "text", required, hint,
}: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[44px]" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
