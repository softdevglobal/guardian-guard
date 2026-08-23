import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  activeModules, applicableQuestions, applicableRequirements,
  type BusinessCategory, type NdisFundingStatus, type QuestionRule, type RequirementRule,
  type ServiceSelection, type ServiceType,
} from "@/lib/serviceSelection";

export const SERVICE_SELECTION_KEYS = {
  config: ["service-config"] as const,
  selections: (orgId: string | null) => ["service-selections", orgId] as const,
};

/** Global configuration maintained by the platform owner. */
export function useServiceConfig() {
  return useQuery({
    queryKey: SERVICE_SELECTION_KEYS.config,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [cats, types, rules, questions] = await Promise.all([
        supabase.from("business_categories" as any).select("*").eq("active", true).order("display_order"),
        supabase.from("service_types" as any).select("*").eq("active", true).order("display_order"),
        supabase.from("compliance_requirement_rules" as any).select("*").eq("active", true),
        supabase.from("onboarding_pathway_rules" as any).select("*").eq("active", true).order("display_order"),
      ]);
      const firstError = cats.error ?? types.error ?? rules.error ?? questions.error;
      if (firstError) throw firstError;
      return {
        categories: ((cats.data ?? []) as unknown) as BusinessCategory[],
        serviceTypes: ((types.data ?? []) as unknown) as ServiceType[],
        rules: ((rules.data ?? []) as unknown) as RequirementRule[],
        questions: ((questions.data ?? []) as unknown) as QuestionRule[],
      };
    },
  });
}

export interface StoredSelection extends ServiceSelection {
  id: string;
  organisation_id: string;
  confirmed_at: string | null;
}

export function useOrgServiceSelections() {
  const { user } = useAuth();
  const orgId = user?.organisation_id ?? null;
  return useQuery({
    queryKey: SERVICE_SELECTION_KEYS.selections(orgId),
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organisation_service_selections" as any)
        .select("*")
        .eq("organisation_id", orgId!)
        .eq("is_archived", false);
      if (error) throw error;
      return ((data ?? []) as unknown) as StoredSelection[];
    },
  });
}

/**
 * Everything the app needs to know about what a provider sells:
 * active modules, applicable requirements and applicable onboarding questions.
 */
export function useProviderPathway(ndisStatus?: NdisFundingStatus | null, extras?: {
  photoConsent?: boolean; locationConsent?: boolean;
  declaresRestrictivePractices?: boolean; silScopeConfirmed?: boolean;
}) {
  const config = useServiceConfig();
  const selections = useOrgServiceSelections();

  return useMemo(() => {
    const categories = config.data?.categories ?? [];
    const serviceTypes = config.data?.serviceTypes ?? [];
    const rules = config.data?.rules ?? [];
    const questions = config.data?.questions ?? [];
    // An empty result stays empty — never substituted with defaults or recommendations.
    const sels = Array.isArray(selections.data) ? (selections.data as StoredSelection[]) : [];
    const live = sels.filter((s) => !s.is_archived);
    // Requirements, licences and modules derive exclusively from CONFIRMED services.
    const confirmed = confirmedSelections(sels) as ServiceSelection[];
    const servicesConfirmed = confirmed.length > 0;
    return {
      isLoading: config.isLoading || selections.isLoading,
      error: config.error ?? selections.error ?? null,
      categories,
      serviceTypes,
      rules,
      questions,
      /** Draft + confirmed rows, for the selection screen only. */
      selections: live as ServiceSelection[],
      confirmedSelections: confirmed,
      servicesConfirmed,
      modules: activeModules({ selections: confirmed, categories, serviceTypes, rules, ...extras }),
      requirements: applicableRequirements(confirmed, rules, ndisStatus),
      applicableQuestions: applicableQuestions(confirmed, questions),
    };
  }, [config.data, config.isLoading, config.error, selections.data, selections.isLoading, selections.error, ndisStatus, extras]);
}

/** Replaces the provider's selection set. Removed rows are archived, never deleted. */
export function useSaveSelections() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = user?.organisation_id ?? null;

  return useMutation({
    mutationFn: async (next: { business_category_id: string; service_type_id: string | null; ndis_funded: boolean }[]) => {
      if (!orgId) throw new Error("No organisation linked to your account.");
      const { data: existing, error: readErr } = await supabase
        .from("organisation_service_selections" as any)
        .select("id, business_category_id, service_type_id, is_archived")
        .eq("organisation_id", orgId);
      if (readErr) throw readErr;

      const key = (c: string, t: string | null) => `${c}:${t ?? ""}`;
      const wanted = new Set(next.map((n) => key(n.business_category_id, n.service_type_id)));
      const existingRows = ((existing ?? []) as any[]);

      const toArchive = existingRows.filter((r) => !r.is_archived && !wanted.has(key(r.business_category_id, r.service_type_id)));
      if (toArchive.length > 0) {
        const { error } = await supabase
          .from("organisation_service_selections" as any)
          .update({ is_archived: true })
          .in("id", toArchive.map((r) => r.id));
        if (error) throw error;
      }

      const existingKeys = new Map(existingRows.map((r) => [key(r.business_category_id, r.service_type_id), r]));
      const toInsert = next.filter((n) => !existingKeys.has(key(n.business_category_id, n.service_type_id)));
      const toRevive = next
        .map((n) => existingKeys.get(key(n.business_category_id, n.service_type_id)))
        .filter((r): r is any => !!r && r.is_archived);

      if (toRevive.length > 0) {
        const { error } = await supabase
          .from("organisation_service_selections" as any)
          .update({ is_archived: false })
          .in("id", toRevive.map((r) => r.id));
        if (error) throw error;
      }
      if (toInsert.length > 0) {
        const { error } = await supabase.from("organisation_service_selections" as any).insert(
          toInsert.map((n) => ({ ...n, organisation_id: orgId, delivery_status: "planned" })),
        );
        if (error) throw error;
      }
      return { archived: toArchive.length, added: toInsert.length, restored: toRevive.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SERVICE_SELECTION_KEYS.selections(orgId) });
      qc.invalidateQueries({ queryKey: ["tenant-onboarding", orgId] });
    },
  });
}

/** Confirms the selection, generates draft policies and unlocks the rest of onboarding. */
export function useConfirmSelections() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = user?.organisation_id ?? null;

  return useMutation({
    mutationFn: async (ndisStatus: NdisFundingStatus) => {
      if (!orgId) throw new Error("No organisation linked to your account.");
      const { data, error } = await supabase.rpc("confirm_service_selections" as any, {
        _org: orgId,
        _ndis_funding_status: ndisStatus,
      });
      if (error) throw error;
      return data as { selections: number; policies_created: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SERVICE_SELECTION_KEYS.selections(orgId) });
      qc.invalidateQueries({ queryKey: ["tenant-onboarding", orgId] });
      qc.invalidateQueries({ queryKey: ["policies"] });
    },
  });
}
