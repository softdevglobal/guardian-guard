/**
 * Single source of truth for provider (tenant) permissions.
 *
 * Platform roles are deliberately kept out of every tenant role selector, and the
 * matrix below mirrors the database RLS policies so the UI never offers an action
 * the database will reject.
 */
import type { AppRole } from "@/contexts/AuthContext";

export const PLATFORM_ROLES = ["platform_super_admin"] as const;

/** Roles a provider organisation may assign to its own people. */
export const TENANT_ASSIGNABLE_ROLES: AppRole[] = [
  "support_worker",
  "supervisor",
  "trainer",
  "compliance_officer",
  "hr_admin",
  "executive",
  "participant",
  "tenant_admin",
];

export function isPlatformRole(role: string): boolean {
  return (PLATFORM_ROLES as readonly string[]).includes(role);
}

/** Every role option a tenant admin may pick, with platform roles stripped out. */
export function tenantRoleOptions(): AppRole[] {
  return TENANT_ASSIGNABLE_ROLES.filter((r) => !isPlatformRole(r));
}

export type PermissionAction =
  | "participants.create"
  | "participants.manage"
  | "participants.unmask"
  | "consents.manage"
  | "service_agreements.create"
  | "support_plans.create"
  | "service_locations.create"
  | "task_templates.create"
  | "shifts.schedule"
  | "shifts.assign_worker"
  | "policies.create"
  | "governance.meetings.create"
  | "governance.actions.create"
  | "governance.declarations.create"
  | "governance.internal_audits.create"
  | "registration_groups.confirm"
  | "evidence_requirements.manage"
  | "auditor.invite"
  | "audit_logs.view"
  | "organisation.settings.manage"
  | "staff.enrol"
  | "staff.assign_role"
  | "platform.roles.assign"
  | "platform.console";

const ADMIN: AppRole[] = ["tenant_admin", "super_admin"];
const COMPLIANCE: AppRole[] = [...ADMIN, "compliance_officer"];

const MATRIX: Record<PermissionAction, AppRole[]> = {
  "participants.create": COMPLIANCE,
  "participants.manage": COMPLIANCE,
  "participants.unmask": [...COMPLIANCE, "supervisor"],
  "consents.manage": COMPLIANCE,
  "service_agreements.create": COMPLIANCE,
  "support_plans.create": [...COMPLIANCE, "supervisor"],
  "service_locations.create": [...COMPLIANCE, "supervisor"],
  "task_templates.create": [...COMPLIANCE, "supervisor"],
  "shifts.schedule": [...COMPLIANCE, "supervisor"],
  "shifts.assign_worker": [...COMPLIANCE, "supervisor"],
  "policies.create": COMPLIANCE,
  "governance.meetings.create": [...COMPLIANCE, "executive"],
  "governance.actions.create": [...COMPLIANCE, "executive"],
  "governance.declarations.create": [...COMPLIANCE, "executive", "hr_admin"],
  "governance.internal_audits.create": COMPLIANCE,
  "registration_groups.confirm": [...COMPLIANCE, "executive"],
  "evidence_requirements.manage": [...COMPLIANCE, "executive", "supervisor"],
  "auditor.invite": COMPLIANCE,
  "audit_logs.view": [...COMPLIANCE, "executive"],
  "organisation.settings.manage": ADMIN,
  "staff.enrol": [...COMPLIANCE, "hr_admin"],
  "staff.assign_role": [...COMPLIANCE, "hr_admin"],
  // Platform-only — never granted to a provider role.
  "platform.roles.assign": ["platform_super_admin"],
  "platform.console": ["platform_super_admin"],
};

export function permittedRoles(action: PermissionAction): AppRole[] {
  return MATRIX[action] ?? [];
}

export function can(roles: AppRole[] | AppRole | undefined | null, action: PermissionAction): boolean {
  if (!roles) return false;
  const held = Array.isArray(roles) ? roles : [roles];
  return permittedRoles(action).some((r) => held.includes(r));
}

/** Human-readable copy for the shared "access restricted" state. */
export function accessRestrictedCopy(action: PermissionAction, currentRoles: AppRole[]) {
  const allowed = permittedRoles(action).filter((r) => !isPlatformRole(r));
  return {
    currentRole: currentRoles.length ? currentRoles.map(labelRole).join(", ") : "No role assigned",
    requiredPermission: action,
    grantedBy: allowed.length ? allowed.map(labelRole).join(", ") : "Platform administrator",
    nextAction: "Ask an administrator in your organisation to grant this permission, then reload the page.",
  };
}

export function labelRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
