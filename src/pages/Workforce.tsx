import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { useStaff, withOrg } from "@/hooks/useComplianceLookups";
import { BlockerAlert, EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, ReadOnlyNotice } from "@/components/compliance/GateUI";
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  SCREENING_STATUSES,
  WEEKDAYS,
  summariseAvailability,
  workerBlockers,
  workerPayload,
  workerSchedulingBlockers,
  type Availability,
} from "@/lib/workforce";
import { toSafeError } from "@/lib/userFacingError";

const EMPTY = { employment_type: "casual", employment_status: "active", screening_status: "pending", availability: {} as Availability };

export default function Workforce() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canManage = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer", "hr_admin"]);
  const [form, setForm] = useState<Record<string, any>>(EMPTY);
  const [blockers, setBlockers] = useState<string[]>([]);
  const { data: staff = [] } = useStaff();

  const { data: workers = [], isLoading, error, refetch } = useQuery({
    queryKey: ["worker-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("worker_profiles" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sites" as any).select("id, name, active").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const staffName = (id: string) => staff.find((s: any) => s.id === id)?.full_name ?? staff.find((s: any) => s.id === id)?.email ?? "Unknown staff account";
  const siteName = (id: string | null) => sites.find((s: any) => s.id === id)?.name ?? "No primary site";

  const saveWorker = useMutation({
    mutationFn: async () => {
      const found = workerBlockers(form);
      setBlockers(found);
      if (found.length) throw new Error(found[0]);
      const payload = withOrg(workerPayload(form as any), user?.organisation_id);
      const { data, error } = await supabase.from("worker_profiles" as any).insert(payload).select("id").single();
      if (error) throw error;
      await logAudit({ action: "worker_profile_created", module: "workforce", record_id: (data as any)?.id, details: { user_id: form.user_id } });
      return data;
    },
    onSuccess: () => {
      toast({ title: "Worker record saved", description: "Employment details are recorded. Screening and training remain governed by Staff Compliance." });
      setForm(EMPTY);
      setBlockers([]);
      qc.invalidateQueries({ queryKey: ["worker-profiles"] });
    },
    onError: (e) => {
      const safe = toSafeError(e, "save this worker record");
      toast({ title: safe.title, description: safe.description, variant: "destructive" });
    },
  });

  const toggleDay = (day: string) =>
    setForm((f) => ({ ...f, availability: { ...(f.availability ?? {}), [day]: !(f.availability ?? {})[day] } }));

  return (
    <div className="space-y-6">
      <PageHeading
        title="Workforce"
        description="Employment, availability and skills for the people who deliver services. This record supports rostering — it does not replace worker screening or training verification."
      />
      <HumanReviewNotice>
        Screening status recorded here is an administrative note. Assignment eligibility is still decided by verified compliance and training records, and requires human review.
      </HumanReviewNotice>

      {!canManage && (
        <ReadOnlyNotice reason={isMockAudit ? "Mock audit mode is on — editing is disabled." : "Your role can view the workforce register but not change it."} />
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add a worker record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BlockerAlert blockers={blockers} title="Fix before saving" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="worker-user">Staff account</Label>
                <select
                  id="worker-user"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.user_id ?? ""}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                >
                  <option value="">Select a staff account</option>
                  {staff.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                  ))}
                </select>
                {staff.length === 0 && <p className="text-xs text-muted-foreground">Enrol staff first in Staff Enrollment.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-position">Position</Label>
                <Input id="worker-position" value={form.position ?? ""} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-employment">Employment type</Label>
                <select
                  id="worker-employment"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.employment_type ?? ""}
                  onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-status">Employment status</Label>
                <select
                  id="worker-status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.employment_status ?? ""}
                  onChange={(e) => setForm({ ...form, employment_status: e.target.value })}
                >
                  {EMPLOYMENT_STATUSES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-screening">Screening status</Label>
                <select
                  id="worker-screening"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.screening_status ?? ""}
                  onChange={(e) => setForm({ ...form, screening_status: e.target.value })}
                >
                  {SCREENING_STATUSES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-site">Primary site</Label>
                <select
                  id="worker-site"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.primary_site_id ?? ""}
                  onChange={(e) => setForm({ ...form, primary_site_id: e.target.value })}
                >
                  <option value="">No primary site</option>
                  {sites.filter((s: any) => s.active).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-award">Award classification</Label>
                <Input id="worker-award" value={form.award_classification ?? ""} onChange={(e) => setForm({ ...form, award_classification: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-rate">Base pay rate (AUD per hour)</Label>
                <Input id="worker-rate" inputMode="decimal" value={form.pay_rate ?? ""} onChange={(e) => setForm({ ...form, pay_rate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-start">Start date</Label>
                <Input id="worker-start" type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-end">End date (optional)</Label>
                <Input id="worker-end" type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-skills">Skills (comma separated)</Label>
                <Input id="worker-skills" value={form.skills ?? ""} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="worker-quals">Qualifications (comma separated)</Label>
                <Input id="worker-quals" value={form.qualifications ?? ""} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
              </div>
              <fieldset className="space-y-2 md:col-span-2">
                <legend className="text-sm font-medium">Weekly availability</legend>
                <div className="flex flex-wrap gap-4">
                  {WEEKDAYS.map((day) => (
                    <label key={day} className="flex items-center gap-2 text-sm capitalize">
                      <Checkbox checked={!!(form.availability ?? {})[day]} onCheckedChange={() => toggleDay(day)} aria-label={day} />
                      {day}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="worker-notes">Notes</Label>
                <Textarea id="worker-notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <Button onClick={() => saveWorker.mutate()} disabled={saveWorker.isPending}>
              {saveWorker.isPending ? "Saving..." : "Save worker record"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Workforce register ({workers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} scope="worker-profiles" />
          ) : workers.length === 0 ? (
            <EmptyState title="No worker records yet" description="Add employment details for your staff so shifts can be rostered against real availability and positions." />
          ) : (
            <ul className="divide-y">
              {workers.map((w) => {
                const issues = workerSchedulingBlockers(w);
                return (
                  <li key={w.id} className="space-y-1 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{staffName(w.user_id)}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{EMPLOYMENT_TYPES.find((t) => t.value === w.employment_type)?.label ?? w.employment_type}</Badge>
                        <Badge variant={issues.length ? "destructive" : "secondary"}>
                          {issues.length ? "Not schedulable" : "Schedulable"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[w.position, siteName(w.primary_site_id), `Available: ${summariseAvailability(w.availability)}`].filter(Boolean).join(" · ")}
                    </p>
                    {issues.length > 0 && <p className="text-sm text-destructive">{issues.join(" ")}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
