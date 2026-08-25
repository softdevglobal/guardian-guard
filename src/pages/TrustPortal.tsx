import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { ErrorState, HumanReviewNotice, LoadingState, PageHeading, ReadOnlyNotice, StatusPill } from "@/components/compliance/GateUI";
import { buildTrustSnapshot, slugify, TRUST_TOGGLES, type TrustPortalRecord } from "@/lib/trustPortal";
import { labelValue } from "@/lib/correctiveActions";

export default function TrustPortal() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canEdit = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer"]);
  const [form, setForm] = useState<TrustPortalRecord | null>(null);

  const org = useQuery({
    queryKey: ["trust-org"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organisations" as any)
        .select("id, name, legal_name, trading_name, registration_status, registration_number, registration_expiry")
        .eq("id", user?.organisation_id ?? "")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.organisation_id,
  });

  const portal = useQuery({
    queryKey: ["trust-portal"],
    queryFn: async () => {
      const { data, error } = await supabase.from("provider_trust_portals" as any).select("*").maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });

  const evidence = useQuery({
    queryKey: ["trust-evidence"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [documents, personnel, policies] = await Promise.all([
        supabase.from("organisation_documents" as any).select("id, expiry_date, is_critical"),
        supabase.from("key_personnel" as any).select("id, worker_screening_expiry").eq("status", "active"),
        supabase.from("policies" as any).select("id, status"),
      ]);
      for (const r of [documents, personnel, policies]) if (r.error) throw r.error;
      const docs = (documents.data as any[]) ?? [];
      const people = (personnel.data as any[]) ?? [];
      const pols = (policies.data as any[]) ?? [];
      return {
        insuranceCurrent: docs.some((d) => d.is_critical && d.expiry_date && d.expiry_date >= today),
        screeningCurrent: people.length > 0 && people.every((p) => p.worker_screening_expiry && p.worker_screening_expiry >= today),
        policiesCurrent: pols.filter((p) => p.status === "approved" || p.status === "published").length,
        policiesTotal: pols.length,
      };
    },
  });

  useEffect(() => {
    if (org.data && !form) {
      setForm(
        portal.data ?? {
          slug: slugify(org.data.trading_name ?? org.data.legal_name ?? org.data.name ?? "provider"),
          is_enabled: false,
          show_registration_status: true,
          show_insurance: true,
          show_worker_screening: true,
          show_policies_current: true,
          show_audit_readiness: true,
          contact_email: "",
          intro_text: "",
        },
      );
    }
  }, [org.data, portal.data, form]);

  const save = useMutation({
    mutationFn: async ({ publish }: { publish: boolean }) => {
      if (!form) return;
      const snapshot = buildTrustSnapshot(form, {
        organisationName: org.data?.trading_name ?? org.data?.legal_name ?? org.data?.name ?? "Provider",
        registrationStatus: org.data?.registration_status,
        registrationNumber: org.data?.registration_number,
        registrationExpiry: org.data?.registration_expiry,
        insuranceCurrent: evidence.data?.insuranceCurrent ?? false,
        screeningCurrent: evidence.data?.screeningCurrent ?? false,
        policiesCurrent: evidence.data?.policiesCurrent ?? 0,
        policiesTotal: evidence.data?.policiesTotal ?? 0,
      });
      const payload = {
        organisation_id: user?.organisation_id,
        slug: form.slug,
        is_enabled: form.is_enabled,
        show_registration_status: form.show_registration_status,
        show_insurance: form.show_insurance,
        show_worker_screening: form.show_worker_screening,
        show_policies_current: form.show_policies_current,
        show_audit_readiness: form.show_audit_readiness,
        contact_email: form.contact_email || null,
        intro_text: form.intro_text || null,
        ...(publish ? { published_snapshot: snapshot, published_at: new Date().toISOString() } : {}),
        created_by: user?.id,
      };
      if (portal.data?.id) {
        const { created_by, organisation_id, ...rest } = payload;
        const { error } = await supabase.from("provider_trust_portals" as any).update(rest).eq("id", portal.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("provider_trust_portals" as any).insert(payload);
        if (error) throw error;
      }
      await logAudit({ action: publish ? "published" : "updated", module: "trust_portal" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trust-portal"] });
      toast({ title: "Saved", description: "Trust portal settings written to the audit trail." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Could not save", description: e.message }),
  });

  if (org.isLoading || portal.isLoading || !form) return <div className="p-6"><LoadingState rows={4} /></div>;
  if (org.error) return <div className="p-6"><ErrorState error={org.error} onRetry={() => org.refetch()} /></div>;

  const publicUrl = `${window.location.origin}/trust/${form.slug}`;

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title="Trust portal"
        description="A shareable, de-identified compliance summary for participants, families and referrers. You choose exactly what is visible. No participant or worker personal information is ever published."
      />

      {isMockAudit && <ReadOnlyNotice reason="Mock audit mode is on — trust portal settings are read only." />}
      <HumanReviewNotice>
        The portal states what evidence your organisation holds and when it was published. It never states that your organisation is NDIS compliant, certified or approved.
      </HumanReviewNotice>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visibility</CardTitle>
          <CardDescription>
            {portal.data?.published_at
              ? `Last published ${new Date(portal.data.published_at).toLocaleString()}`
              : "Not published yet — publish to create the shareable summary."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Portal is live</p>
              <p className="text-xs text-muted-foreground">Anyone with the link can view the published summary.</p>
            </div>
            <Switch
              checked={form.is_enabled}
              disabled={!canEdit}
              onCheckedChange={(v) => setForm({ ...form, is_enabled: v })}
              aria-label="Trust portal is live"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="trust-slug">Portal address</Label>
            <Input
              id="trust-slug"
              value={form.slug}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
              className="min-h-[44px]"
            />
            <p className="text-xs text-muted-foreground">{publicUrl}</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="trust-email">Contact email shown on the portal</Label>
            <Input id="trust-email" type="email" value={form.contact_email ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="min-h-[44px]" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="trust-intro">Introduction</Label>
            <Textarea id="trust-intro" value={form.intro_text ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, intro_text: e.target.value })} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What to include</CardTitle>
          <CardDescription>Each toggle publishes a status only — never underlying records, participants or workers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {TRUST_TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              <Switch
                checked={Boolean((form as any)[t.key])}
                disabled={!canEdit}
                onCheckedChange={(v) => setForm({ ...form, [t.key]: v } as TrustPortalRecord)}
                aria-label={t.label}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {buildTrustSnapshot(form, {
            organisationName: org.data?.trading_name ?? org.data?.legal_name ?? org.data?.name ?? "Provider",
            registrationStatus: org.data?.registration_status,
            registrationNumber: org.data?.registration_number,
            registrationExpiry: org.data?.registration_expiry,
            insuranceCurrent: evidence.data?.insuranceCurrent ?? false,
            screeningCurrent: evidence.data?.screeningCurrent ?? false,
            policiesCurrent: evidence.data?.policiesCurrent ?? 0,
            policiesTotal: evidence.data?.policiesTotal ?? 0,
          }).items.map((item) => (
            <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <span className="text-sm">{item.label}</span>
              <StatusPill tone={item.tone}>{item.value}</StatusPill>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Status: {labelValue(org.data?.registration_status)}</p>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-[44px]" onClick={() => save.mutate({ publish: false })}>Save settings</Button>
          <Button className="min-h-[44px]" onClick={() => save.mutate({ publish: true })}>Publish summary</Button>
        </div>
      )}
    </div>
  );
}
