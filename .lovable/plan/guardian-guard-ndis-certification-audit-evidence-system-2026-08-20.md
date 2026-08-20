# Guardian Guard — NDIS Certification-Audit Evidence System

This is a large build. It is phased so each phase ships working, testable functionality on top of the existing RBAC, RLS, audit-log and archive-not-delete foundations. Nothing existing is removed.

## Ground rules applied everywhere
- Language: "Audit readiness", "Evidence status", "Requires human review". Never "NDIS compliant", "certified", "registration approved".
- Every new table: organisation-scoped RLS, GRANTs, created_at/updated_at, archive-not-delete (record_status + delete-prevention trigger), audit-log trigger.
- Every new screen: loading / empty / error states, role guards, keyboard + screen-reader accessible, no colour-only status.
- AI never approves, authorises or determines reportable status or restrictive practices.

---

## Phase 1 — Practice Standards Evidence Matrix (foundation)
**Migration A**
- `standard_modules` (core, medication, waste, SIL) and extend `practice_standards` with module, outcome reference, applicable registration groups.
- `registration_groups` — 0107, 0108, 0109, 0111, 0115, 0117, 0120, 0124, 0133, 0137, 0138 with an `is_confirmed` flag set only by an authorised administrator (gates the SIL module).
- `evidence_requirements` — requirement per outcome: required evidence type, linked policy + version, owner, review date, status (missing/in_progress/ready/overdue), auditor notes, include_in_export.
- `evidence_requirement_links` — links a requirement to concrete records (incident, policy, training, plan…) to produce the linked record count.
- Trigger: a requirement cannot move to `ready` unless its mandatory evidence checks pass (linked policy present, at least one linked record, review date not past).
- Seed the 22 core outcomes plus Medication (4.3), Waste (4.5) and SIL outcomes.

**UI**
- Rework `ControlsMatrix` page into the Evidence Matrix: filter by module / outcome / status / owner, inline auditor notes, owner + review date editing, status badges with icon + text.
- Evidence Pack export filtered by module/outcome — CSV plus auditor-friendly PDF (reuses `auditPdfExport.ts`).

## Phase 2 — Participant onboarding, consent, service agreements
**Migration B**
- `participant_consents` — purpose of collection/use/disclosure, information-sharing parties, communication preferences, accessible format, nominee/advocate details, status, version, date.
- `service_agreements` — status draft → participant_review → signed → active → ended/archived, signature/acceptance method, signed copy URL, support items, price/rate, start/end, cancellation terms, emergency continuity, complaints path, advocate rights, privacy acknowledgement.
- `service_delivery_records` — cannot be finalised without an active agreement; exception requires authorised role + reason, logged.
- Trigger enforcing the agreement gate and the workflow order.

**UI**
- Participant intake wizard (consent step), Service Agreement tab on the participant sheet with the workflow bar.
- Participant-role view: only their own approved info, agreement, plan, complaint route, accessible documents.

## Phase 3 — Support planning, participant risk, continuity
**Migration C**
- `support_plans` + `support_plan_versions` — goals, strengths, preferences, culture/values/beliefs, communication method, decision-making supports, support network permissions, health/emergency contacts, daily support needs, community participation, review due date.
- `participant_risk_assessments` — likelihood, consequence, controls, escalation, review, person consulted, linked support plan.
- `participant_continuity_plans` — critical supports, alternative worker/provider, contacts, evacuation/communication requirements, test/review record.
- `worker_assignments` with a trigger blocking assignment unless plan briefing is acknowledged and applicable competency/training is current (extends `evaluate_staff_eligibility`).

## Phase 4 — Medication module
**Migration D**
- `medication_profiles` — participant identification, name/form/dose/timing/route, prescriber/pharmacy, consent, storage location, start/end/review, authoritative record upload.
- `medication_administration_records` — due/recorded time, worker, result (administered/refused/withheld/missed), reason, witness, escalation, double-check flag.
- `medication_storage_checks`.
- Alerts to supervisor/compliance on overdue/missed/refused/withheld via existing notification functions.
- Medication incidents route into the existing incident workflow (incident_category link).
- UI carries a persistent banner: follow the authorised medication record and escalation protocol; the system gives no clinical advice.

## Phase 5 — Mealtime, waste, infection prevention, safe environment
**Migration E**
- `mealtime_profiles` (conditional) — practitioner plan upload, texture/fluid instructions, allergies/risks, seating/positioning, choking response, required worker competency, review date; roster gate on competency.
- `waste_register` — hazardous/infectious waste, disposal contractor/method, spill incident linkage, emergency plan, worker training records.
- `environment_checks` + `check_templates` — recurring PPE/cleaning/environment checks with failure escalation.

## Phase 6 — SIL tenancy and shared-home controls
**Migration F**
- Whole module gated: unavailable until registration group 0138 `is_confirmed` by an authorised administrator; the UI states this plainly.
- `sil_homes`, `tenancy_agreements` (kept strictly separate from `service_agreements` — neither is contingent on the other), `tenancy_acknowledgements`, `house_preferences` (keys/private space, visitors), `co_tenant_consultations`, `shared_space_decisions`, `vacancy_consultations`, `house_emergency_plans` + `drill_log`, `participant_concerns` (no-retaliation flag, advocacy/complaints routing).

## Phase 7 — Incidents, complaints, restrictive practices
**Migration G**
- `reportable_assessments` — checklist items, evidence field, time-critical due-date calculator, human Compliance Officer decision + decider + timestamp.
- Change incident logic: remove the "injury = yes ⇒ reportable" force. `is_reportable` stays null/unconfirmed and shows "Requires human confirmation" until a Compliance Officer records the decision.
- Enforce immediate safety action, affected-person support, root cause, corrective/preventive action, effectiveness review, participant communication on closure (extends the existing closure trigger).
- `restrictive_practices` register — activated only for authorised cases; requires behaviour support plan / authorisation evidence, least-restrictive review, reporting/review actions. No AI approval path exists in code.
- Complaints: anonymous/advocate-assisted entry, NDIS Commission external option shown, procedural-fairness fields, anti-retaliation flag, outcome/review/learning fields.

## Phase 8 — Governance, quality, workforce
**Migration H**
- `governance_meetings` + `meeting_actions`, `conflict_of_interest_declarations`, internal audit program (`internal_audits`), CAPA register (extend `incident_actions` usage into a general `capa_register`), management review dashboard.
- `position_requirements`; extend staff records with NDIS Worker Orientation, worker screening, qualifications, secondary employment/conflict declaration, induction, supervision, emergency capability, workforce-disruption backup.
- Mandatory training matrix seeded: NDIS orientation, Code of Conduct, incidents/complaints, privacy, infection prevention/PPE, cultural safety, trauma-informed practice, supported decision-making, positive behaviour support, plus conditional medication/mealtime/waste.

## Phase 9 — Accessibility and privacy hardening
- Skip links, semantic heading order, visible focus, labelled forms, error summaries on every new form, live-region announcements, accessible document-format choice.
- Role-gate all exports; sensitive reveal requires reason + expiry and is logged (extends `access_reveal_logs`).
- RLS review pass over all new tables: participants see only their own records, staff limited to assigned participants, compliance/super-admin access logged.

## Phase 10 — Verification and documentation
- Vitest suites: RLS/role guards, no service delivery without agreement, worker competency gate, medication alert logic, reportable-incident human-decision gate, immutability/no-delete, tenancy vs service agreement separation, participant data isolation.
- README: "What this system supports" and "What still requires human implementation and audit evidence".
- No deployment. Final summary lists migrations, tests run and manual configuration steps (registration group confirmation, storage buckets, notification recipients).

---

## Technical notes
- Ten migrations, applied one phase at a time so each is reviewable.
- New shared helpers: `src/lib/evidenceMatrix.ts`, `src/lib/medicationAlerts.ts`, `src/lib/agreementGate.ts`.
- New pages: Evidence Matrix (replaces Controls Matrix), Service Agreements, Support Plans, Medication, Environment & Waste, SIL Homes, Restrictive Practices, Governance.
- Existing tables are extended, never dropped; existing data is preserved.

## Suggested delivery order
Phases 1–3 first (they unblock everything else), then 4–7, then 8–10. Tell me if you would rather I run all phases straight through in one long build.
