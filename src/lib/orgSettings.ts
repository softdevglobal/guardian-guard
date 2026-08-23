/** Pure validation for organisation settings so the save path can be tested without a database. */
import { isValidAbn } from "@/lib/abn";

export interface OrgSettingsForm {
  name: string;
  abn: string;
  ndis_registration: string;
  primary_contact_email: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER = /^(test|demo|sample|placeholder|xxx+|000+|n\/?a)$/i;

export function trimOrgSettings(form: OrgSettingsForm): OrgSettingsForm {
  return {
    name: form.name.trim(),
    abn: form.abn.replace(/\s/g, "").trim(),
    ndis_registration: form.ndis_registration.trim(),
    primary_contact_email: form.primary_contact_email.trim().toLowerCase(),
  };
}

export function orgSettingsErrors(input: OrgSettingsForm): string[] {
  const form = trimOrgSettings(input);
  const errors: string[] = [];
  if (form.name.length < 2) errors.push("Organisation name is required.");
  if (form.abn && !isValidAbn(form.abn)) errors.push("ABN must be 11 digits and pass the ABN checksum.");
  if (form.primary_contact_email && !EMAIL.test(form.primary_contact_email)) {
    errors.push("Primary contact email is not a valid email address.");
  }
  if (form.ndis_registration && PLACEHOLDER.test(form.ndis_registration)) {
    errors.push("NDIS registration number looks like a placeholder — enter the real registration number or leave it blank.");
  }
  return errors;
}

/** True when what came back from the database matches what we asked it to store. */
export function persistedMatches(saved: Partial<OrgSettingsForm> | null, submitted: OrgSettingsForm): boolean {
  if (!saved) return false;
  const want = trimOrgSettings(submitted);
  return (
    (saved.name ?? "") === want.name &&
    (saved.abn ?? "") === want.abn &&
    (saved.ndis_registration ?? "") === want.ndis_registration &&
    (saved.primary_contact_email ?? "") === want.primary_contact_email
  );
}
