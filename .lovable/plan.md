
# Full Relational Integrity Refactor

## Current State (Already Built)
✅ FK constraints on incidents→participants, risks→participants/incidents/complaints, safeguarding→participants/incidents/risks/complaints
✅ Audit trail triggers on all major tables (audit_trail_trigger)
✅ Workflow enforcement (incident + complaint status machines)
✅ Soft delete with `record_status` + `prevent_record_deletion` triggers
✅ Severity downgrade prevention
✅ Incident versioning + workflow history
✅ Risk mitigation enforcement before closure
✅ Training completions with score, verified_by, assessment_passed
✅ Staff eligibility auto-evaluation

## What Needs Building

### Phase 1: Schema Gaps (Migration)
1. Add `linked_incident_id` to `training_completions` — links training to skill-gap incidents
2. Add `linked_staff_id` FK to `complaints` — tracks staff involved in complaint
3. Ensure all existing demo data has proper cross-links (no orphan records)

### Phase 2: Participant Compliance Timeline (New Component)
- New page/component: `/participants/:id/timeline`
- Unified chronological view merging:
  - Risks (date_identified)
  - Incidents (date_of_incident)
  - Complaints (created_at)
  - Safeguarding concerns (date_raised)
  - Training completions (for assigned staff)
  - Audit log entries
- Filterable by module type
- Shows linked entities inline

### Phase 3: Linked Records UI
- Add "Linked Records" card to:
  - Incident detail → shows linked participant, risk, staff, complaints
  - Risk detail → shows linked participant, incidents, complaints, staff
  - Complaint detail → shows linked participant, staff, incidents
- Clickable links to navigate between records

### Phase 4: Evidence Chain Export
- Participant-centric export: for a given participant, gather ALL linked records
- Incident-centric export: already partially built, extend with training + staff compliance
- Export as CSV (structured) with all linked entity IDs and details
- PDF generation (formatted audit-ready report)

### Phase 5: Seed Interconnected Demo Data (Data Insert)
- Ensure 10 participants each have at least 1 risk + 1 incident linked
- Link complaints to participants and involved staff
- Link training completions to incidents (skill-gap scenarios)
- Link risks to incidents that triggered them
- Result: zero orphan records, full traceability chains

### Phase 6: Compliance Chain Visualization
- Simple visual on participant detail showing:
  `Participant → Risks → Incidents → Actions → Training`
- Uses existing data relationships, rendered as a flow diagram

## Technical Approach
- Phase 1: Single migration for schema changes
- Phases 2-4: New React components + lib functions
- Phase 5: Supabase insert tool for data
- Phase 6: Simple React component with lines/connections
