import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GETTING_STARTED_STEPS } from "@/lib/platform";

/**
 * Tenant-facing compliance checklist. Every step is a registration or evidence
 * obligation — daily operational setup lives in BMS Pro Trade, not here.
 */
export function GettingStarted() {
  const { user } = useAuth();
  const orgId = user?.organisation_id ?? null;

  const { data } = useQuery({
    queryKey: ["getting-started", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [onb, groups, docs, personnel, workerRecords, policies, governance, capa, evidence] = await Promise.all([
        supabase.from("organisation_onboarding" as any).select("status, progress_pct").eq("organisation_id", orgId).maybeSingle(),
        supabase.from("registration_groups" as any).select("id").eq("organisation_id", orgId).eq("is_confirmed", true).limit(1),
        supabase.from("organisation_documents" as any).select("id").eq("organisation_id", orgId).limit(1),
        supabase.from("key_personnel" as any).select("id").eq("organisation_id", orgId).limit(1),
        supabase.from("staff_compliance_records" as any).select("id").eq("organisation_id", orgId).limit(1),
        supabase.from("policy_acknowledgements" as any).select("id").limit(1),
        supabase.from("governance_meetings" as any).select("id").eq("organisation_id", orgId).limit(1),
        supabase.from("corrective_actions" as any).select("id").eq("organisation_id", orgId).not("status", "in", "(closed,verified,completed)").limit(1),
        supabase.from("evidence_requirements" as any).select("id").eq("organisation_id", orgId).eq("status", "ready").limit(1),
      ]);
      const any = (r: { data: unknown }) => ((r.data ?? []) as unknown[]).length > 0;
      return {
        profile: (onb.data as any)?.status === "approved" || ((onb.data as any)?.progress_pct ?? 0) >= 100,
        registration_groups: any(groups),
        registration_info: (onb.data as any)?.status === "approved",
        documents: any(docs),
        key_personnel: any(personnel),
        worker_compliance: any(workerRecords),
        policies: any(policies),
        governance: any(governance),
        corrective_actions: !any(capa),
        evidence_pack: any(evidence),
      } as Record<string, boolean>;
    },
  });

  if (!orgId) return null;

  const done = GETTING_STARTED_STEPS.filter((s) => data?.[s.key]).length;
  const pct = Math.round((done / GETTING_STARTED_STEPS.length) * 100);
  if (pct === 100) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Getting started</CardTitle>
        <p className="text-sm text-muted-foreground">
          Work through these steps to make your evidence audit-ready. Guardian Guard records your evidence — it does not certify compliance.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={pct} aria-label="Getting started progress" />
        <ul className="space-y-1">
          {GETTING_STARTED_STEPS.map((s) => {
            const complete = Boolean(data?.[s.key]);
            return (
              <li key={s.key}>
                <Link to={s.to} className="flex min-h-[44px] items-center gap-2 rounded-md px-2 text-sm hover:bg-accent">
                  {complete ? (
                    <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className={complete ? "text-muted-foreground line-through" : ""}>{s.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
