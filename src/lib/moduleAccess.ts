/**
 * Service-driven module access.
 *
 * Two independent gates decide whether a person may open a module:
 *  1. Role permission (what the person is allowed to do), and
 *  2. Service applicability (what the organisation actually sells, derived from
 *     its confirmed service selections by `organisation_active_modules`).
 *
 * Only modules in SERVICE_GATED_MODULES are subject to gate 2 — core modules
 * (dashboard, policies, incidents, staff...) are always available so a provider
 * can never be locked out of governance while onboarding is in progress.
 */

/** Modules that only exist when a matching service is confirmed. */
export const SERVICE_GATED_MODULES = [
  "participants",
  "participant_care",
  "medication",
  "mealtime",
  "sil",
  "restrictive_practices",
  "safe_environment",
  "waste_register",
  "trade_compliance",
  "service_operations",
  "service_approvals",
  "rostering",
  "service_delivery",
  "photo_evidence",
  "geolocation",
] as const;

/** Some app modules are switched on by a differently named engine module. */
const ENGINE_ALIAS: Record<string, string> = {
  service_approvals: "service_operations",
  service_delivery: "service_operations",
  rostering: "service_operations",
};

const GATED = new Set<string>(SERVICE_GATED_MODULES);

export function isServiceGated(module: string): boolean {
  return GATED.has(module);
}

/**
 * `orgModules === null` means the activation set has not loaded (or the caller is
 * a platform user with no tenant); in that case service gating is not applied.
 */
export function moduleAllowed(
  module: string,
  roleAllows: boolean,
  orgModules: string[] | null,
): boolean {
  if (!roleAllows) return false;
  if (!isServiceGated(module) || orgModules === null) return true;
  const engineModule = ENGINE_ALIAS[module] ?? module;
  return orgModules.includes(engineModule);
}

/** Route path (exact, or prefix before the first dynamic segment) to module key. */
export const ROUTE_MODULES: Record<string, string> = {
  "/": "dashboard",
  "/incidents": "incidents",
  "/risks": "risks",
  "/complaints": "complaints",
  "/policies": "policies",
  "/participants": "participants",
  "/participant-care": "participant_care",
  "/medication": "medication",
  "/staff": "staff",
  "/staff-enrollment": "staff_enrollment",
  "/training": "training",
  "/audit": "audit",
  "/heartbeat": "dashboard",
  "/safeguarding": "safeguarding",
  "/privacy": "privacy",
  "/notifications": "dashboard",
  "/settings": "settings",
  "/controls": "controls",
  "/evidence-matrix": "controls",
  "/competency-vault": "competency",
  "/evidence-room": "evidence_room",
  "/safe-environment": "safe_environment",
  "/sil": "sil",
  "/restrictive-practices": "restrictive_practices",
  "/governance": "governance",
  "/my-shifts": "service_delivery",
  "/service-approvals": "service_approvals",
  "/service-operations": "service_operations",
  "/roster": "rostering",
  "/sites": "sites",
  "/workforce": "workforce",
  "/participant-funding": "funding",
};

export function moduleForPath(pathname: string): string | null {
  if (ROUTE_MODULES[pathname]) return ROUTE_MODULES[pathname];
  const base = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  return ROUTE_MODULES[base] ?? null;
}
