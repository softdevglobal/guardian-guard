

# Audit-Grade Policy Enforcement Implementation

This plan bridges the gap between the expanded policy documents and the current system. The core issue: forms capture data but modules lack **edit capabilities**, **closure validation**, **workflow enforcement**, **cross-module linking**, and **mandatory field enforcement**.

---

## What Needs to Change

### 1. Incident Detail Sheet — Full Edit + Closure Enforcement
**Current**: Read-only detail view with a single "advance status" button.
**Required**: Editable sections that unlock based on workflow stage.

- Add "People Involved" section with participant/staff pickers (linked records)
- Add editable Investigation section (root cause, contributing factors, corrective/preventive actions) — only visible and editable when status = `investigating` or later
- Add editable Closure section (outcome summary, follow-up completed, closure recommendation)
- **Closure validation**: Block advancement to `closed` unless:
  - All corrective actions recorded
  - Participant follow-up marked complete
  - Investigation fields filled (root cause, contributing factors)
  - Description is non-empty
- Show validation errors when closure criteria are not met
- Add `logAudit()` calls on every status change and field edit

### 2. Incident Form — People Involved Section
- Add Section 2 accordion: "People Involved"
  - Participant picker (existing query)
  - Staff picker (from user_profiles)
  - Witnesses text/jsonb field
  - Other persons involved text/jsonb field
- Save `participant_id`, `linked_staff_id`, `witnesses`, `other_persons_involved` on create

### 3. Risk Detail Sheet — Editable + Workflow Buttons
**Current**: Read-only detail sheet.
**Required**: Status workflow buttons + editable mitigation fields.

- Add status advancement: Open → Assessed → Mitigating → Monitoring → Closed
- Role gates: only compliance_officer/super_admin can close
- Add linked record display (participant, staff, incident, complaint)
- Add linked record pickers in the create form
- Add editable mitigation actions section
- **Escalation enforcement**: If score >= 7 (spec threshold), require review_date within 7 days and mitigation owner

### 4. Complaint Detail Sheet — Workflow + Acknowledgement
**Current**: Read-only detail sheet, no workflow.
**Required**: Full workflow with acknowledgement tracking.

- Add workflow buttons: Received → Acknowledged → Under Review → Investigating → Resolved → Closed
- Auto-set `acknowledgement_date` when advanced to "acknowledged"
- Role gates on transitions
- Add editable fields: investigation_summary, resolution_actions, final_outcome, outcome_communicated_date
- **Safeguarding crossover**: When complaint category is "safeguarding", show a warning and a "Create Safeguarding Concern" button that pre-fills a linked concern
- **Closure enforcement**: Require resolution_actions and outcome_communicated_date before closing

### 5. Safeguarding Detail Sheet — Workflow + Linked Records
**Current**: Read-only detail sheet.
**Required**: Full workflow with linked record display.

- Add workflow buttons: Raised → Screened → Action Required → Monitoring → Resolved → Closed
- Display linked incident, complaint, risk records
- Add editable: review_notes, support_actions, outcome
- **Linkage enforcement**: If linked to complaint or incident, prevent closure until linked record is reviewed
- Show repeat concern banner if same participant has 2+ concerns

### 6. Privacy Detail Sheet — Workflow + Data Types
**Current**: Read-only detail sheet.
**Required**: Workflow + data type selection.

- Add workflow buttons: Detected → Contained → Assessed → Actioned → Closed
- Add data_type_involved multi-select checkboxes (personal_info, sensitive_info, participant_notes, staff_records, ai_logs, uploaded_files)
- Add access_source selector (office_device, remote_device, unknown_device)
- Add editable corrective_action field
- Add notification_completed_date field

### 7. Staff Compliance — Clearance Date Editing + Conduct Breach
**Current**: Can toggle training switches and change status dropdowns.
**Required**: Date fields for clearance issue/expiry.

- Add editable date fields: police_check_date, police_check_expiry, wwcc_expiry, worker_screening_expiry
- Add WWCC number field
- Show conduct breach linkage: if complaints or incidents reference this staff member, display them in the detail sheet

### 8. Cross-Module Triggers (Client-Side)
Since database triggers are limited, implement these as client-side logic in mutation handlers:

- **Complaint → Safeguarding**: When a complaint with category "safeguarding" is created, prompt to create a linked safeguarding concern
- **Incident closure → Risk prompt**: When closing an incident with root cause indicating system weakness, show "Create linked risk?" dialog
- **Staff conduct complaint**: When complaint category is "staff_conduct", show link to staff compliance record

### 9. Audit Trail Integration
- Add `logAudit()` to every status change across all modules (currently only in Policies and StaffCompliance)
- Log field-level changes for severity, classification, and outcome fields in incidents
- Log every workflow advancement in complaints, safeguarding, privacy

### 10. Compliance Automation Edge Function — Add Missing Triggers
Current function handles: staff expiry, stale incidents, complaint ack overdue, policy review overdue.
**Add**:
- Safeguarding urgent response check: if immediate_safety_risk = true and no action within 24 hours, create alert
- Risk review overdue: if review_date passed and status not closed, create alert
- Repeat complaint detection: if same participant has 3+ complaints, create trend alert

---

## Files to Create/Edit

| File | Action |
|---|---|
| `src/components/incidents/IncidentDetailSheet.tsx` | Major rewrite: add editable sections, closure validation, audit logging |
| `src/components/incidents/IncidentFormDialog.tsx` | Add People Involved section |
| `src/pages/Risks.tsx` | Add workflow buttons, linked record pickers, mitigation editing |
| `src/pages/Complaints.tsx` | Add workflow buttons, acknowledgement tracking, safeguarding crossover, editable resolution fields |
| `src/pages/Safeguarding.tsx` | Add workflow buttons, linked records display, repeat concern banner |
| `src/pages/Privacy.tsx` | Add workflow buttons, data type checkboxes, editable fields |
| `src/pages/StaffCompliance.tsx` | Add clearance date fields, conduct breach display |
| `supabase/functions/compliance-automation/index.ts` | Add safeguarding response check, risk review overdue, repeat complaint detection |

No database migrations needed — all required columns already exist from Phase 1.

---

## Implementation Priority

1. Incident detail sheet (highest audit impact — this is the core compliance object)
2. Complaint workflow + safeguarding crossover
3. Safeguarding workflow + linked records
4. Risk workflow + linked records
5. Privacy workflow
6. Staff compliance date editing
7. Automation edge function updates
8. Audit trail wiring across all modules

