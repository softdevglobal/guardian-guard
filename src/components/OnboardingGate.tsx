import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/compliance/GateUI";

/**
 * Keeps a brand-new tenant admin on /onboarding until their pack is submitted or approved.
 * Established organisations (no onboarding record, or an approved/submitted one) are never locked out.
 *
 * The gate always changes the URL — it never swaps page content while keeping the old route —
 * and it carries the original route in ?returnTo so the user lands back where they were headed.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, hasRole, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const orgId = user?.organisation_id ?? null;
  const applies = hasRole("tenant_admin") && !!orgId;

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-gate", orgId],
    enabled: applies,
    queryFn: async () => {
      const { data: row } = await supabase
        .from("organisation_onboarding" as any)
        .select("status, pathway_status")
        .eq("organisation_id", orgId)
        .maybeSingle();
      return (row as any) ?? null;
    },
  });

  // Neutral skeleton while auth or the gate query resolves — never a premature "no organisation" message.
  if (authLoading || (applies && isLoading)) {
    return <div className="p-6"><LoadingState rows={5} /></div>;
  }
  if (!applies) return <>{children}</>;

  const status = data?.status as string | undefined;
  const pathwayStatus = data?.pathway_status as string | undefined;
  const mustFinish =
    pathwayStatus === "selection_required" ||
    status === "not_started" || status === "in_progress" || status === "returned" ||
    status === "changes_requested" || status === "ready_for_review";

  if (mustFinish && location.pathname !== "/onboarding") {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <>{children}</>;
}
