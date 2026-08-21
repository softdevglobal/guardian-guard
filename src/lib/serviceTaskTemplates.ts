/**
 * Pure helpers for service task templates so validation and availability rules can be
 * tested without a browser or database round trip.
 */

export interface TaskTemplateForm {
  id?: string;
  name?: string | null;
  service_type?: string | null;
  description?: string | null;
  requires_before_photo?: boolean;
  requires_after_photo?: boolean;
  participant_confirmation_required?: boolean;
  allow_gallery_upload?: boolean;
  is_active?: boolean;
}

/** Human-readable reasons a template cannot be saved. Empty array means the form is valid. */
export function templateBlockers(form: TaskTemplateForm): string[] {
  const blockers: string[] = [];
  if (!String(form.name ?? "").trim()) blockers.push("Give the task template a name workers will recognise.");
  if (!String(form.service_type ?? "").trim()) blockers.push("Record the service type this template belongs to.");
  return blockers;
}

/** Values sent to the database. Active defaults to true so a new template is immediately usable. */
export function templatePayload(form: TaskTemplateForm) {
  return {
    ...form,
    name: String(form.name ?? "").trim(),
    service_type: String(form.service_type ?? "").trim(),
    is_active: form.is_active !== false,
  };
}

/** The empty form a successful save resets to. */
export function emptyTemplateForm(): TaskTemplateForm {
  return { is_active: true };
}

/** Only active templates may be attached to a new shift; the list view shows all of them. */
export function selectableTemplates<T extends { is_active?: boolean | null }>(templates: T[]): T[] {
  return templates.filter((t) => t.is_active !== false);
}
