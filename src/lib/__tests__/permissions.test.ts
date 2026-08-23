import { describe, expect, it } from "vitest";
import { can, isPlatformRole, permittedRoles, tenantRoleOptions, accessRestrictedCopy } from "@/lib/permissions";

describe("tenant admin authorisation", () => {
  const admin = ["tenant_admin"] as const;

  it("permits participant management", () => {
    expect(can([...admin], "participants.create")).toBe(true);
    expect(can([...admin], "consents.manage")).toBe(true);
  });

  it("permits staff enrolment and role assignment", () => {
    expect(can([...admin], "staff.enrol")).toBe(true);
    expect(can([...admin], "staff.assign_role")).toBe(true);
  });

  it("permits service operations", () => {
    expect(can([...admin], "service_locations.create")).toBe(true);
    expect(can([...admin], "task_templates.create")).toBe(true);
    expect(can([...admin], "shifts.schedule")).toBe(true);
    expect(can([...admin], "shifts.assign_worker")).toBe(true);
  });

  it("permits governance, registration groups and evidence", () => {
    expect(can([...admin], "governance.meetings.create")).toBe(true);
    expect(can([...admin], "governance.internal_audits.create")).toBe(true);
    expect(can([...admin], "governance.declarations.create")).toBe(true);
    expect(can([...admin], "registration_groups.confirm")).toBe(true);
    expect(can([...admin], "evidence_requirements.manage")).toBe(true);
    expect(can([...admin], "auditor.invite")).toBe(true);
    expect(can([...admin], "audit_logs.view")).toBe(true);
    expect(can([...admin], "policies.create")).toBe(true);
    expect(can([...admin], "organisation.settings.manage")).toBe(true);
  });

  it("never permits platform actions", () => {
    expect(can([...admin], "platform.roles.assign")).toBe(false);
    expect(can([...admin], "platform.console")).toBe(false);
  });

  it("denies operational creation to support workers", () => {
    expect(can(["support_worker"], "participants.create")).toBe(false);
    expect(can(["support_worker"], "policies.create")).toBe(false);
    expect(can(["support_worker"], "staff.enrol")).toBe(false);
  });
});

describe("tenant role selectors", () => {
  it("excludes every platform role", () => {
    expect(tenantRoleOptions().some(isPlatformRole)).toBe(false);
    expect(tenantRoleOptions()).not.toContain("platform_super_admin");
  });

  it("offers the provider roles", () => {
    expect(tenantRoleOptions()).toEqual(
      expect.arrayContaining(["support_worker", "supervisor", "compliance_officer", "hr_admin", "tenant_admin"]),
    );
  });
});

describe("access restricted copy", () => {
  it("names the current role and who can grant access without exposing platform roles", () => {
    const copy = accessRestrictedCopy("policies.create", ["support_worker"]);
    expect(copy.currentRole).toBe("Support Worker");
    expect(copy.grantedBy).toContain("Tenant Admin");
    expect(copy.nextAction.length).toBeGreaterThan(0);
  });

  it("hides platform roles from the granting list", () => {
    expect(accessRestrictedCopy("platform.console", ["tenant_admin"]).grantedBy).toBe("Platform administrator");
    expect(permittedRoles("platform.console")).toEqual(["platform_super_admin"]);
  });
});
