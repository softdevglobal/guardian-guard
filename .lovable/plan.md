# Guardian Guard cleanup: compliance operating system

Refocus Guardian Guard on NDIS registration, governance, compliance, evidence and audit readiness. All rostering, scheduling, shift, timesheet and site/workforce-operations functionality is removed — those belong to BMS Pro Trade.

## 1. Remove operational modules (UI and data)

Delete pages, routes, nav entries, module keys, libraries and tests for:

- Roster, My Shifts, Service Operations, Service Approvals, Service Task Templates
- Sites, Workforce (worker rostering profiles), Participant Funding

Then drop the backing tables in a migration: `service_shifts`, `service_shift_tasks`, `service_task_templates`, `service_delivery_records`, `shift_completion_confirmations`, `attendance_events`, `task_evidence`, `sites`, `worker_profiles`, `worker_assignments`, `participant_funding`, plus their triggers, functions (`can_access_shift`, `can_edit_shift`, `shift_submission_blockers`, geofence helpers) and the `task-evidence` storage bucket.

Compliance-relevant data is preserved: participants, staff compliance, training, incidents, risks, complaints, policies, evidence, audit logs, onboarding, governance.

Staff-side compliance evidence (photos attached to compliance records) is unaffected — only shift/task evidence goes.

## 2. Corrective Action register (central CAPA)

New `corrective_actions` table: action, source type (audit / incident / complaint / risk / policy review / management review / super admin), source record id, owner, priority, due date, evidence required, evidence links, status (Open, In Progress, Awaiting Evidence, Awaiting Approval, Complete, Overdue), closure notes.

- New `/corrective-actions` page: filterable register, create/edit sheet, evidence upload, approval step, overdue highlighting.
- "Raise corrective action" action on incident, complaint, risk and audit-finding detail sheets, pre-linked to the source.
- Existing `incident_actions` and `governance_actions` records are surfaced in the register through a read-only union view so nothing is lost.

## 3. NDIS Registration Centre

- New `/registration` page with the section checklist (Organisation, Key Personnel, Registration Groups, Services, Governance, Risk, Incidents, Complaints, HR, Emergency, Information Management, Safeguarding, Policies, Evidence), each showing Complete / Incomplete / Needs Review / Approved / Not Applicable derived from existing evidence requirements.
- Registration status workflow on the organisation: Not Started → Preparing Application → Submitted → Audit Required → Audit Booked → Audit Completed → Awaiting Commission → Registered → Renewal Due → Expired.
- New `key_personnel` table (name, position, contact, date appointed, screening, police check, qualifications, declarations, evidence uploads) with its own register UI, tenant-scoped.

## 4. Compliance calendar and expiry engine

- New `/calendar` page (month / week / agenda) aggregating policy reviews, licence and insurance expiries, staff screening and training expiries, participant reviews, corrective action due dates and registration renewal.
- Shared expiry service computing 90/60/30/14/7-day and expired buckets across staff checks, qualifications, training, organisation documents, policies, participant documents and registration.
- Scheduled edge function extends the existing automation to write deduplicated notifications at each threshold and to flag staff NON-COMPLIANT on expiry.

## 5. Super Admin Provider Control Centre

Rebuild `/platform/clients/:id` as a tabbed console: Overview, Business Details, NDIS Registration, Registration Groups, Key Personnel, Staff, Participants, Policies, Evidence, Risks, Incidents, Complaints, Audits, Corrective Actions, Tasks, Documents, Module Access, Subscription, Activity Log.

- Read/act on tenant data without impersonation, through the existing `platform-admin` edge function (service-role, fully audit-logged).
- Evidence review actions: Approve / Reject / Request replacement with notes.
- Super Admin task assignment to a provider (`platform_tasks`), visible immediately in the provider's dashboard actions.
- Module Access tab: per-provider overrides on top of the automatic registration-group activation.
- Platform dashboard metrics extended: providers by stage, audit readiness, expiring documents, open incidents/complaints/corrective actions, last activity.

## 6. Trust / compliance portal

- New `provider_trust_portals` table: slug, enabled flag, per-field visibility toggles, published snapshot.
- Provider-side `/trust-portal` settings page to choose what is shared and copy the public link.
- Public route `/p/:slug` rendering only the approved summary (registration status, insurance verified, worker screening percentage, policies current, audit readiness). No participant or staff personal data is ever exposed. This is app-owned content, attributed to the provider — separate from Lovable's own Trust Center at `/.well-known/trust.html`.

## 7. Navigation, dashboards and states

Provider nav becomes: Dashboard, NDIS Registration, Compliance, Governance, Policies, Staff, Participants, Risk, Incidents, Complaints, Audits, Corrective Actions, Documents, Calendar, Trust Portal, Reports, Settings.

Super Admin nav: Dashboard, Providers, Registration Applications, Compliance Library, Policy Library, Registration Groups, Requirements Engine, Audit Reviews, Tasks, Subscriptions, Users, Platform Settings, Activity Logs.

- Provider dashboard: audit readiness, registration status, compliance issues, expiring documents, non-compliant staff, participant reviews, corrective actions, open incidents — every tile links to a real action. No dead widgets.
- Staff dashboard: own checks, training and assigned compliance tasks only.
- Every screen keeps loading skeleton, empty-with-CTA, error-with-retry, permission-denied and expired/non-compliant states.
- Language stays truthful: "audit readiness", "evidence status", "requires human review" — never "NDIS compliant" or "certified".

## Technical notes

- All new tables: `tenant_id`/`organisation_id`, `created_at`, `updated_at`, `created_by`; explicit GRANTs, RLS enabled, policies scoped through `get_user_organisation_id` / `has_role`, with `platform_super_admin` cross-tenant read via `is_platform_admin`.
- Audit logging extended to every new write path (previous value / new value), append-only and not editable by provider users.
- Role model unchanged (`tenant_admin`, `compliance_officer`, `supervisor`, `hr_admin`, `executive`, `support_worker`, `participant`, `platform_super_admin`); permissions added to `src/lib/permissions.ts` for corrective actions, key personnel, registration and trust portal.
- BMS Pro Trade readiness: a read-only compliance status endpoint (`GET /staff/:id/compliance` style edge function) returning status + reason, so the external system can block assignment. No operational features re-created here.
- Migrations are staged: drops first, then new tables, then data backfill for the corrective action union.
- Delivery order: (1) removals, (2) corrective actions, (3) registration centre, (4) calendar/expiry, (5) platform control centre, (6) trust portal, (7) nav/dashboard cleanup. Tests updated at each stage.
