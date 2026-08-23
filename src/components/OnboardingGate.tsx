import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Keeps a brand-new tenant admin on /onboarding until their pack is submitted or approved.
 * Established organisations (no onboarding record, or an approved/submitted one) are never locked out.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, hasRole } = useAuth();
  const location = useLocation();
  const orgId = user?.organisation_id ?? null;
  const applies = hasRole("tenant_admin") && !!orgId;

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-gate", orgId],
    enabled: applies,
    queryFn: async () => {
      const { data: row } = await supabase
        .from("organisation_onboarding" as any)
        .select("status")
        .eq("organisation_id", orgId)
        .maybeSingle();
      return (row as any) ?? null;
    },
  });

  if (!applies || isLoading) return <>{children}</>;
  const status = data?.status as string | undefined;
  const mustFinish = status === "not_started" || status === "in_progress" || status === "returned" || status === "changes_requested" || status === "ready_for_review";
  if (mustFinish && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
