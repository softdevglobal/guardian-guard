import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { useParticipants, withOrg } from "@/hooks/useComplianceLookups";
import { BlockerAlert, EmptyState, ErrorState, HumanReviewNotice, LoadingState, PageHeading, ReadOnlyNotice } from "@/components/compliance/GateUI";
import {
  FUNDING_FLAG_COPY,
  SUPPORT_CATEGORIES,
  formatCurrency,
  fundingBlockers,
  fundingFlag,
  remainingBudget,
  utilisationPercent,
} from "@/lib/funding";
import { toSafeError } from "@/lib/userFacingError";

export default function ParticipantFunding() {
  const { user, hasRole, isMockAudit } = useAuth();
  const qc = useQueryClient();
  const canManage = !isMockAudit && hasRole(["tenant_admin", "super_admin", "compliance_officer"]);
  const [form, setForm] = useState<Record<string, any>>({});
  const [blockers, setBlockers] = useState<string[]>([]);
  const { data: participants = [] } = useParticipants();

  const { data: funding = [], isLoading, error, refetch } = useQuery({
    queryKey: ["participant-funding"],
    queryFn: async () => {
      const { data, error } = await supabase.from("participant_funding" as any).select("*").order("plan_end_date");
      if (error) throw error;
      return data as any[];
    },
  });

  const participantName = (id: string) => participants.find((p: any) => p.id === id)?.full_name ?? "Participant";

  const saveFunding = useMutation({
    mutationFn: async () => {
      const found = fundingBlockers(form);
      setBlockers(found);
      if (found.length) throw new Error(found[0]);
      const payload = withOrg(
        {
          participant_id: form.participant_id,
          support_category: form.support_category,
          allocated_budget: Number(form.allocated_budget),
          committed_budget: Number(form.committed_budget || 0),
          claimed_amount: Number(form.claimed_amount || 0),
          service_rate: form.service_rate ? Number(form.service_rate) : null,
          plan_start_date: form.plan_start_date,
          plan_end_date: form.plan_end_date,
        },
        user?.organisation_id
      );
      const { data, error } = await supabase.from("participant_funding" as any).insert(payload).select("id").single();
      if (error) throw error;
      await logAudit({
        action: "participant_funding_recorded",
        module: "funding",
        record_id: (data as any)?.id,
        details: { participant_id: form.participant_id, support_category: form.support_category },
      });
      return data;
    },
    onSuccess: () => {
      toast({ title: "Funding recorded", description: "Budget tracking is now available for this support category." });
      setForm({});
      setBlockers([]);
      qc.invalidateQueries({ queryKey: ["participant-funding"] });
    },
    onError: (e) => {
      const safe = toSafeError(e, "record this funding");
      toast({ title: safe.title, description: safe.description, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeading
        title="Participant funding"
        description="Provider-side view of each participant's plan budget by support category, used to track committed and claimed amounts."
      />
      <HumanReviewNotice>
        These figures are the provider's own record of plan budgets. They are not an authoritative plan balance and must be reconciled against plan statements by an authorised person.
      </HumanReviewNotice>

      {!canManage && (
        <ReadOnlyNotice reason={isMockAudit ? "Mock audit mode is on — editing is disabled." : "Your role can view funding but not change it."} />
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Record a funding allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BlockerAlert blockers={blockers} title="Fix before saving" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fund-participant">Participant</Label>
                <select
                  id="fund-participant"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.participant_id ?? ""}
                  onChange={(e) => setForm({ ...form, participant_id: e.target.value })}
                >
                  <option value="">Select a participant</option>
                  {participants.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
                {participants.length === 0 && <p className="text-xs text-muted-foreground">Add participants first in the Participant register.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-category">Support category</Label>
                <select
                  id="fund-category"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.support_category ?? ""}
                  onChange={(e) => setForm({ ...form, support_category: e.target.value })}
                >
                  <option value="">Select a category</option>
                  {SUPPORT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-allocated">Allocated budget (AUD)</Label>
                <Input id="fund-allocated" inputMode="decimal" value={form.allocated_budget ?? ""} onChange={(e) => setForm({ ...form, allocated_budget: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-committed">Committed budget (AUD)</Label>
                <Input id="fund-committed" inputMode="decimal" value={form.committed_budget ?? ""} onChange={(e) => setForm({ ...form, committed_budget: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-claimed">Claimed to date (AUD)</Label>
                <Input id="fund-claimed" inputMode="decimal" value={form.claimed_amount ?? ""} onChange={(e) => setForm({ ...form, claimed_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-rate">Service rate (AUD per hour)</Label>
                <Input id="fund-rate" inputMode="decimal" value={form.service_rate ?? ""} onChange={(e) => setForm({ ...form, service_rate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-start">Plan start date</Label>
                <Input id="fund-start" type="date" value={form.plan_start_date ?? ""} onChange={(e) => setForm({ ...form, plan_start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-end">Plan end date</Label>
                <Input id="fund-end" type="date" value={form.plan_end_date ?? ""} onChange={(e) => setForm({ ...form, plan_end_date: e.target.value })} />
              </div>
            </div>
            <Button onClick={() => saveFunding.mutate()} disabled={saveFunding.isPending}>
              {saveFunding.isPending ? "Saving..." : "Record funding"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Funding register ({funding.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} scope="participant-funding" />
          ) : funding.length === 0 ? (
            <EmptyState title="No funding recorded" description="Record each participant's plan budget by support category to track commitments against the plan period." />
          ) : (
            <ul className="space-y-4">
              {funding.map((row) => {
                const flag = fundingFlag(row);
                const percent = utilisationPercent(row);
                return (
                  <li key={row.id} className="space-y-2 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{participantName(row.participant_id)}</p>
                        <p className="text-sm text-muted-foreground">
                          {SUPPORT_CATEGORIES.find((c) => c.value === row.support_category)?.label ?? row.support_category}
                          {row.plan_start_date && row.plan_end_date ? ` · ${row.plan_start_date} to ${row.plan_end_date}` : ""}
                        </p>
                      </div>
                      <Badge variant={flag === "on_track" ? "secondary" : "destructive"}>{FUNDING_FLAG_COPY[flag]}</Badge>
                    </div>
                    <Progress value={percent} aria-label={`${percent}% of allocated budget used`} />
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(row.allocated_budget)} allocated · {formatCurrency(row.committed_budget)} committed ·{" "}
                      {formatCurrency(row.claimed_amount)} claimed · {formatCurrency(remainingBudget(row))} remaining
                    </p>
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
