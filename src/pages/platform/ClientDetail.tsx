import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, StatusPill } from "@/components/compliance/GateUI";
import { formatAbn } from "@/lib/abn";
import { daysUntil, expiryTone, formatMoney, maskSensitive } from "@/lib/platform";
import { callPlatformAdmin } from "@/lib/platformApi";

export default function ClientDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [extraDays, setExtraDays] = useState("14");
  const [packageId, setPackageId] = useState("");

  const client = useQuery({
    queryKey: ["platform-client", id],
    enabled: !!id,
    queryFn: async () => {
      const [org, sub, onb, users, docs, income, events, sessions, invites, answers, packages, tasks] = await Promise.all([
        supabase.from("organisations" as any).select("*").eq("id", id).maybeSingle(),
        supabase.from("tenant_subscriptions" as any).select("*, subscription_packages(name, code, monthly_price)").eq("organisation_id", id).maybeSingle(),
        supabase.from("organisation_onboarding" as any).select("*").eq("organisation_id", id).maybeSingle(),
        supabase.from("user_profiles" as any).select("id, full_name, email").eq("organisation_id", id),
        supabase.from("organisation_documents" as any).select("*").eq("organisation_id", id).order("created_at", { ascending: false }),
        supabase.from("platform_income_records" as any).select("*").eq("organisation_id", id).order("issued_date", { ascending: false }),
        supabase.from("platform_activity_events" as any).select("*").eq("organisation_id", id).order("created_at", { ascending: false }).limit(50),
        supabase.from("platform_support_sessions" as any).select("*").eq("organisation_id", id).order("started_at", { ascending: false }),
        supabase.from("organisation_invitations" as any).select("*").eq("organisation_id", id).order("created_at", { ascending: false }),
        supabase.from("onboarding_answers" as any).select("*").eq("organisation_id", id),
        supabase.from("subscription_packages" as any).select("*").eq("is_active", true).order("monthly_price"),
        supabase.from("platform_tasks" as any).select("*").eq("organisation_id", id).order("due_date"),
      ]);
      if (org.error) throw org.error;
      return {
        org: org.data as any,
        sub: sub.data as any,
        onb: onb.data as any,
        users: (users.data ?? []) as any[],
        docs: (docs.data ?? []) as any[],
        income: (income.data ?? []) as any[],
        events: (events.data ?? []) as any[],
        sessions: (sessions.data ?? []) as any[],
        invites: (invites.data ?? []) as any[],
        answers: (answers.data ?? []) as any[],
        packages: (packages.data ?? []) as any[],
        tasks: (tasks.data ?? []) as any[],
      };

    },
  });

  const act = useMutation({
    mutationFn: async (body: Record<string, unknown>) => callPlatformAdmin({ organisation_id: id, ...body }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["platform-client", id] });
      qc.invalidateQueries({ queryKey: ["platform-clients"] });
      qc.invalidateQueries({ queryKey: ["platform-summary"] });
      setReason("");
      toast({
        title: "Done",
        description: data?.temp_password ? `Temporary password: ${data.temp_password}` : "The change was recorded and audit logged.",
      });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Action failed", description: e.message }),
  });

  if (client.isLoading) return <div className="p-6"><LoadingState rows={5} /></div>;
  if (client.error) return <div className="p-6"><ErrorState error={client.error} /></div>;
  const d = client.data;
  if (!d?.org) return <div className="p-6"><EmptyState title="Client not found" description="This organisation may have been removed or you followed an outdated link." /></div>;

  const suspended = d.org.account_status === "suspended";

  return (
    <div className="space-y-6 p-6">
      <PageHeading
        title={d.org.legal_name ?? d.org.name}
        description={`${d.org.abn ? `ABN ${formatAbn(d.org.abn)} · ` : ""}${d.org.primary_contact_name ?? "No contact"} · ${d.org.primary_contact_email ?? ""}`}
        actions={<StatusPill tone={suspended ? "bad" : d.org.account_status === "active" ? "ok" : "warn"}>{d.org.account_status}</StatusPill>}
      />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="subscription">Package</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="tasks">Compliance tasks</TabsTrigger>
          <TabsTrigger value="support">Support access</TabsTrigger>

        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Package</CardTitle></CardHeader>
              <CardContent><p className="text-lg font-semibold">{d.sub?.subscription_packages?.name ?? "None"}</p><p className="text-xs text-muted-foreground">{d.sub?.status ?? "—"}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Onboarding</CardTitle></CardHeader>
              <CardContent><p className="text-lg font-semibold">{d.onb?.progress_pct ?? 0}%</p><p className="text-xs text-muted-foreground">{d.onb?.status ?? "not started"}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Users</CardTitle></CardHeader>
              <CardContent><p className="text-lg font-semibold">{d.users.length}</p><p className="text-xs text-muted-foreground">{d.sub?.unlimited_users ? "Unlimited seats" : `${d.sub?.seats_included ?? 0} seats included`}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Account status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="status-reason">Reason (required, recorded in the audit log)</Label>
                <Textarea id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant={suspended ? "default" : "destructive"} className="min-h-[44px]" disabled={act.isPending}
                  onClick={() => act.mutate({ action: suspended ? "reactivate" : "suspend", reason })}>
                  {suspended ? "Reactivate account" : "Suspend account"}
                </Button>
              </div>
              {d.org.suspended_reason && <p className="text-sm text-muted-foreground">Suspension reason on file: {d.org.suspended_reason}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4 pt-4">
          <HumanReviewNotice>
            Onboarding answers are evidence supplied by the client. Approving them records that you have reviewed the material — it does not certify the provider or confirm NDIS registration.
          </HumanReviewNotice>
          {d.answers.length === 0 ? (
            <EmptyState title="No answers submitted yet" description="The tenant admin completes the onboarding wizard after their first sign-in." />
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Submitted answers</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {d.answers.map((a) => (
                  <div key={a.id} className="flex justify-between gap-4 border-b py-1">
                    <span className="text-muted-foreground">{a.requirement_key}</span>
                    <span className="text-right font-medium">
                      {a.is_masked
                        ? maskSensitive(a.value_text ?? a.value_date ?? "", "sensitive")
                        : (a.value_text ?? a.value_date ?? (a.value_number != null ? String(a.value_number) : null) ?? (typeof a.value_bool === "boolean" ? String(a.value_bool) : "—"))}
                    </span>

                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {d.invites.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Invitations</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {d.invites.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">{inv.role} · {inv.status} · {inv.send_attempts} sends {inv.failure_reason ? `· ${inv.failure_reason}` : ""}</p>
                    </div>
                    <Button variant="outline" className="min-h-[44px]" disabled={act.isPending || inv.status === "accepted"}
                      onClick={() => act.mutate({ action: "resend_invite", invitation_id: inv.id })}>
                      Resend invite
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="users" className="pt-4">
          {d.users.length === 0 ? (
            <EmptyState title="No users yet" description="Users appear once the tenant admin accepts their invitation and enrols staff." />
          ) : (
            <Card><CardContent className="space-y-2 py-4 text-sm">
              {d.users.map((u) => (
                <div key={u.id} className="flex justify-between gap-4 border-b py-1">
                  <span>{u.full_name}</span>
                  <span className="text-muted-foreground">{u.email}</span>
                </div>
              ))}
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="subscription" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Change package</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="pkg">Package</Label>
                <select id="pkg" className="min-h-[44px] w-full rounded-md border bg-background px-3 text-sm" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                  <option value="">Select a package</option>
                  {d.packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.monthly_price)}/mo</option>)}
                </select>
              </div>
              <Button className="min-h-[44px]" disabled={!packageId || act.isPending} onClick={() => act.mutate({ action: "change_package", package_id: packageId })}>
                Apply package change
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Trial</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Current trial ends {d.sub?.trial_end_date ?? "—"}.</p>
              <div className="space-y-1">
                <Label htmlFor="extra-days">Extend by (days)</Label>
                <Input id="extra-days" type="number" value={extraDays} onChange={(e) => setExtraDays(e.target.value)} className="min-h-[44px] max-w-[160px]" />
              </div>
              <Button variant="outline" className="min-h-[44px]" disabled={act.isPending} onClick={() => act.mutate({ action: "extend_trial", extra_days: Number(extraDays) })}>
                Extend trial
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          {d.docs.length === 0 ? (
            <EmptyState title="No documents uploaded" description="Licences, insurance certificates and screening evidence uploaded during onboarding appear here. Files stay in private storage and open through short-lived signed links." />
          ) : (
            <Card><CardContent className="space-y-2 py-4">
              {d.docs.map((doc) => {
                const days = daysUntil(doc.expiry_date);
                return (
                  <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">{doc.requirement_key} · v{doc.version} · {doc.verification_status}</p>
                    </div>
                    <StatusPill tone={expiryTone(days)}>{doc.expiry_date ? (days! < 0 ? "Expired" : `${days} days`) : "No expiry"}</StatusPill>
                  </div>
                );
              })}
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          {d.events.length === 0 ? (
            <EmptyState title="No recorded activity" description="Platform actions on this client are logged here." />
          ) : (
            <Card><CardContent className="space-y-2 py-4">
              {d.events.map((e) => (
                <div key={e.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="neutral">{e.event_type}</StatusPill>
                    <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1">{e.summary}</p>
                </div>
              ))}
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="income" className="pt-4">
          {d.income.length === 0 ? (
            <EmptyState title="No income recorded" description="Record manual invoices and payments from the Income page. Card details are never stored." />
          ) : (
            <Card><CardContent className="space-y-2 py-4 text-sm">
              {d.income.map((r) => (
                <div key={r.id} className="flex justify-between gap-4 border-b py-1">
                  <span>{r.record_type} · {r.reference ?? "—"}</span>
                  <span className="font-medium">{formatMoney(r.amount)} · {r.status}</span>
                </div>
              ))}
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="support" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Start a time-limited support session</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Support access is read-only, expires after two hours and is visible to the client. There is no silent impersonation.
              </p>
              <div className="space-y-1">
                <Label htmlFor="support-reason">Reason (min 10 characters)</Label>
                <Textarea id="support-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <Button className="min-h-[44px]" disabled={act.isPending} onClick={() => act.mutate({ action: "start_support_session", reason })}>
                Start support session
              </Button>
            </CardContent>
          </Card>
          {d.sessions.length > 0 && (
            <Card><CardContent className="space-y-2 py-4 text-sm">
              {d.sessions.map((s) => (
                <div key={s.id} className="rounded-md border p-3">
                  <p className="font-medium">{s.scope} · started {new Date(s.started_at).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Expires {new Date(s.expires_at).toLocaleString()} — {s.reason}</p>
                </div>
              ))}
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
