import { supabase } from "@/integrations/supabase/client";

export interface EligibilityResult {
  staff_id: string;
  is_eligible: boolean;
  eligibility_status: string;
  reasons: string[];
}

/**
 * Evaluate staff eligibility by calling the DB function.
 * This is the single source of truth — all logic lives in the DB.
 */
export async function evaluateStaffEligibility(staffId: string): Promise<EligibilityResult> {
  const { data, error } = await supabase.rpc("evaluate_staff_eligibility", {
    _staff_id: staffId,
  });
  if (error) throw error;
  return data as unknown as EligibilityResult;
}

/**
 * Check if a staff member can be assigned before attempting assignment.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export async function checkAssignmentEligible(staffId: string): Promise<{ allowed: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc("check_staff_assignment_eligible", {
    _staff_id: staffId,
  });
  if (error) {
    // The DB function raises an exception with the reason
    return { allowed: false, reason: error.message };
  }
  return { allowed: true };
}

export const ELIGIBILITY_BADGE_MAP: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  compliant: { label: "Compliant", variant: "default" },
  expiring_soon: { label: "Expiring Soon", variant: "outline" },
  non_compliant: { label: "Non-Compliant", variant: "destructive" },
  suspended: { label: "Suspended", variant: "destructive" },
};

export const RECORD_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  missing: { label: "Missing", className: "bg-muted text-muted-foreground" },
  pending_review: { label: "Pending Review", className: "bg-warning text-warning-foreground" },
  verified: { label: "Verified", className: "bg-success text-success-foreground" },
  expiring_soon: { label: "Expiring Soon", className: "bg-warning text-warning-foreground" },
  expired: { label: "Expired", className: "bg-destructive text-destructive-foreground" },
  rejected: { label: "Rejected", className: "bg-destructive text-destructive-foreground" },
};
