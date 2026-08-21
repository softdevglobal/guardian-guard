import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LookupOption {
  value: string;
  label: string;
}

export function useParticipants() {
  return useQuery({
    queryKey: ["lookup-participants"],
    queryFn: async () => {
      // The participants table stores first_name/last_name; a display name is derived here
      // so every module shows a consistent, non-sensitive label.
      const { data, error } = await supabase
        .from("participants")
        .select("id, first_name, last_name, ndis_number, consent_status, organisation_id, user_id, assigned_trainer_id")
        .eq("record_status", "active")
        .order("first_name");
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        full_name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Participant",
        participant_code: p.ndis_number ?? null,
      })) as any[];
    },
  });
}


export function useStaff() {
  return useQuery({
    queryKey: ["lookup-staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function toOptions(rows: any[], labelKey = "full_name"): LookupOption[] {
  return rows.map((r) => ({ value: r.id, label: r[labelKey] ?? r.id }));
}

/** Rows are inserted through the Data API, so organisation_id must be supplied explicitly. */
export function withOrg<T extends Record<string, any>>(values: T, organisationId: string | null | undefined, createdBy?: string) {
  const payload: Record<string, any> = { ...values, organisation_id: organisationId };
  if (createdBy && !("created_by" in payload)) payload.created_by = createdBy;
  Object.keys(payload).forEach((k) => {
    if (payload[k] === "" || payload[k] === undefined) payload[k] = null;
  });
  return payload;
}
