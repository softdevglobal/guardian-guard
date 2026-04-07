

# Full Compliance System Build Plan

This plan transforms the current basic CRUD scaffolding into the complete NDIS audit-proof compliance operating system described in the specification. Given the massive scope (~53 non-functional items + 15 new specification sections), implementation is split into 5 phases.

---

## Phase 1 — Database Schema Expansion

Add missing tables, columns, and enums to support all 15 specification sections.

**New tables (5):**
- `safeguarding_concerns` — full form fields per spec (concern_type, source, escalation_level, linked records, etc.)
- `privacy_incidents` — breach tracking (incident_type, data_type_involved, containment_action, notification fields, etc.)
- `policy_acknowledgements` — staff acknowledgement tracking (policy_id, user_id, acknowledged_at, due_date)
- `tasks` — cross-module task system (title, task_type, source_module, source_record_id, assigned_to, due_date, status)
- `incident_actions` — corrective/preventive actions linked to incidents

**Expanded columns on existing tables:**

`incidents` — add: date_of_incident, time_of_incident, date_reported, reporter_role, incident_location, environment_type, incident_category, sub_category, participant_harmed, staff_harmed, medical_attention_required, emergency_service_contacted, immediate_action_taken, current_participant_condition, ai_suggested_classification, supervisor_classification, reportable_reason, investigation_required, assigned_investigator, root_cause, contributing_factors, corrective_actions, preventive_actions, participant_followup_completed, outcome_summary, closure_recommendation, witnesses (jsonb), other_persons_involved (jsonb)

`risks` — add: date_identified, linked_participant_id, linked_staff_id, linked_incident_id, linked_complaint_id, likelihood_score (int 1-5), impact_score (int 1-5), risk_score (int computed), risk_level, existing_controls, review_date, escalation_required, residual_risk_score

`complaints` — add: complaint_source, submission_channel, complainant_name, anonymous, complaint_category, requested_outcome, immediate_risk_identified, escalation_required, assigned_handler, acknowledgement_date, investigation_summary, resolution_actions, outcome_communicated_date, final_outcome

`staff_compliance` — add: identity_verification, mandatory_induction, worker_orientation, cyber_safety_completed, incident_mgmt_training, safeguarding_training, code_of_conduct_acknowledged, code_of_conduct_date, restrictions_notes, eligible_for_assignment, start_date, ndis_screening_required

`policies` — add: category, effective_date, policy_text, linked_training_module_id, staff_acknowledgement_required, acknowledgement_due_date

**Expanded enums:**
- `incident_status` → draft, submitted, supervisor_review, compliance_review, investigating, actioned, closed
- New: `risk_status` (open, assessed, mitigating, monitoring, closed)
- New: `safeguarding_status` (raised, screened, action_required, monitoring, resolved, closed)
- New: `privacy_incident_status` (detected, contained, assessed, actioned, closed)
- New: `complaint_category`, `safeguarding_concern_type`, `privacy_incident_type`

**RLS policies** for all new tables following existing pattern (org-scoped for admins/compliance, team-scoped for supervisors, self-scoped for staff).

**Audit trail triggers** — create DB trigger function that auto-inserts into `audit_logs` on INSERT/UPDATE for: incidents, risks, complaints, safeguarding_concerns, privacy_incidents, policies, staff_compliance, participants.

---

## Phase 2 — Enhanced Module Forms (Incidents, Risks, Complaints)

Rebuild the three highest-priority module forms with all specification fields.

**Incidents page rewrite:**
- Multi-section accordion form: Basics, People Involved (participant/staff picker), Type & Classification, Description, Investigation, Closure
- Smart classification: auto-set reportable if injury + participant harm or abuse/neglect selected
- Incident detail view (sheet/drawer) with full read view + status workflow panel
- Status transition buttons with role gates (only supervisor can advance past supervisor_review, etc.)
- Workflow history timeline showing all status changes

**Risks page rewrite:**
- Full form with linked record pickers (participant, staff, incident, complaint)
- Auto-calculated risk_score = likelihood_score x impact_score
- Risk level auto-assignment (1-4 Low, 5-9 Medium, 10-15 High, 16-25 Critical)
- Detail view with mitigation actions list
- Status workflow: Open → Assessed → Mitigating → Monitoring → Closed

**Complaints page rewrite:**
- Full intake form per spec (source, channel, anonymous flag, category, requested outcome)
- Workflow: Received → Acknowledged → Under Review → Investigating → Resolved → Closed
- Acknowledgement tracking with deadline display

---

## Phase 3 — New Modules (Safeguarding, Privacy) + Participant & Staff Enhancement

**New Safeguarding page:**
- Concern form with all spec fields
- Linked record display (incident, complaint, risk)
- Escalation level badges
- Workflow: Raised → Screened → Action Required → Monitoring → Resolved → Closed

**New Privacy Incidents page:**
- Breach/privacy incident form
- Data type classification
- Containment tracking
- Workflow: Detected → Contained → Assessed → Actioned → Closed

**Participant profile enhancement:**
- Detail view with tabs: Profile, Goals, Progress, Safeguarding Concerns, Incidents, Risk Score
- Safeguarding banner if 2+ concerns

**Staff Compliance enhancement:**
- Full compliance record form with all clearance fields
- Training completion status
- Eligible-for-assignment indicator
- Expiry warning badges

**Policy enhancement:**
- Full form with category, text editor, linked training module
- Version history view
- Staff acknowledgement tracking table
- Review date warnings

---

## Phase 4 — Automation, Cross-Module Triggers & Compliance Pulse

**Database triggers / edge functions for automation:**
- Incident submitted → create audit log, check reportable rules, create NDIS deadline task
- Serious incident → create alert for supervisor + compliance
- Stale investigation (5+ days) → create reminder alert
- Complaint acknowledgement overdue (2 days) → create reminder
- Safeguarding crossover (complaint category = safeguarding) → auto-create safeguarding concern
- Staff clearance expiry (60 days) → create notification
- Staff expired → auto-suspend, remove assignment eligibility
- Policy review due (30 days) → create alert
- Risk score threshold → create escalation alert
- Incident → Risk linking (prompt on closure if root cause = system weakness)

**Cross-module event triggers:**
- Complaint mentioning harm → auto-create safeguarding review
- Safeguarding escalation → require linked incident
- Staff conduct complaint → create conduct review task
- Policy update → assign acknowledgement tasks
- AI alert → supervisor review queue

**Compliance Pulse Engine:**
- Edge function or computed view that calculates scores across 4 categories
- Governance & Operational Management (policy currency, screening, audit completeness)
- Provision of Supports (progress notes, complaint response time, incident response)
- Support Environment (safeguarding response, privacy controls)
- AI Oversight (AI interventions, unresolved alerts, human review rate)
- Dashboard gauge updates from real computed scores

---

## Phase 5 — Notification System, Global Search, AI Heartbeat

**Notification system:**
- Bell dropdown in header showing real notifications from `notifications` table
- Real-time subscription via Supabase channels
- Mark as read, link to source record
- Notification matrix: real-time for critical, daily digest for medium, escalation reminders

**Global search (Ctrl+K):**
- Command palette searching across incidents, risks, complaints, participants, policies
- Result navigation to record detail

**AI Heartbeat edge function:**
- Lovable AI integration for sentiment analysis
- Processes training session notes for distress markers
- Auto-creates draft safeguarding concerns
- Risk score recalculation

**Audit log wiring:**
- Utility function `logAudit()` called on every create/update/status-change across all modules
- Field-level change tracking for classification, severity, outcome changes

---

## Technical Notes

- All new tables follow the existing pattern: RLS enabled, org-scoped policies using `has_role()` / `has_any_role()` / `get_user_organisation_id()` security definer functions
- No hard deletes — all records use `record_status` enum (active/archived/deleted)
- New routes added to App.tsx: `/safeguarding`, `/privacy`
- New sidebar entries for Safeguarding and Privacy modules
- ROLE_MODULES in AuthContext updated for new modules
- All forms use the existing shadcn/ui component library
- Status enums that need expanding will use ALTER TYPE ... ADD VALUE (non-breaking)

---

## Implementation Order

Phase 1 is the foundation — everything else depends on the schema being correct. Phases 2-3 can partially overlap. Phase 4 requires phases 2-3 complete. Phase 5 is independent polish.

Given the scope, I recommend implementing **Phase 1 (schema) + Phase 2 (Incidents, Risks, Complaints forms)** first, then continuing with subsequent phases.

