

# Strengthen Evidence Completeness, Audit Aggregation, Workflow Proof, and Test Coverage

## Problem Summary

Three gaps remain in the compliance system:

1. **Audit-log aggregation is shallow** — Evidence chain export and timeline only query `audit_logs` by `record_id = participantId`. They miss audit logs for the participant's linked incidents, risks, complaints, and safeguarding records. An auditor exporting a participant's evidence chain gets only direct participant-level audit entries, not the full chain.

2. **End-to-end workflow proof is absent from exports** — The per-incident export includes `incident_workflow_history` and `incident_versions`, but the participant-level evidence chain export does not. Complaint workflow history (`complaint_workflow_history`) is never included in any export. There is no unified "workflow completeness" indicator showing whether each record has a valid start-to-finish status progression.

3. **Automated test coverage is minimal** — Only 3 test files exist: `example.test.ts` (trivial), `notificationRules.test.ts`, and `complianceAutomation.test.ts`. Zero tests cover: evidence chain export logic, CSV formatting, staff eligibility rules, incident export, linked records resolution, or timeline construction.

## Plan

### Step 1: Deep audit-log aggregation in evidence chain

**File: `src/lib/evidenceChainExport.ts`**

Update `fetchParticipantEvidenceChain` to:
- Collect all record IDs (incident IDs, risk IDs, complaint IDs, safeguarding IDs)
- Query `audit_logs` with `record_id IN (all linked record IDs)` instead of just the participant ID
- Also fetch `incident_workflow_history` for all linked incidents
- Also fetch `complaint_workflow_history` for all linked complaints
- Add `incidentWorkflow`, `complaintWorkflow` to `EvidenceChainData` interface

Update `exportEvidenceChainCSV` to include:
- New "INCIDENT WORKFLOW HISTORY" section (from_status, to_status, changed_by, date, notes)
- New "COMPLAINT WORKFLOW HISTORY" section
- Expanded audit log section now covering all linked records, not just the participant

### Step 2: Workflow completeness indicator

**File: `src/lib/evidenceChainExport.ts`**

Add a `computeWorkflowCompleteness` function that, for each incident and complaint:
- Checks whether the workflow history forms a valid chain from initial status to current status
- Flags gaps (e.g., jumped from `submitted` to `investigating` without `supervisor_review`)
- Returns a summary included in the CSV export header

**File: `src/components/compliance/ParticipantTimeline.tsx`**

- Add workflow history entries (status transitions) to the timeline as discrete events with a "Workflow" module type
- Show them inline with other events so auditors see the full progression

### Step 3: Comprehensive unit tests

**File: `src/lib/__tests__/evidenceChainExport.test.ts`** (new)

Test `exportEvidenceChainCSV`:
- Correct CSV headers for each section
- csvSafe escaping (commas, quotes, newlines, nulls)
- Empty data produces section headers with no rows
- Workflow sections included when data present
- Workflow completeness flags gaps correctly

**File: `src/lib/__tests__/incidentExport.test.ts`** (new)

Test `exportIncidentCSV`:
- Correct field ordering
- Boolean rendering (Yes/No)
- Null handling
- Workflow history, versions, audit logs, actions sections
- `exportBulkIncidentsCSV` header count matches row column count

**File: `src/lib/__tests__/staffEligibility.test.ts`** (new)

Test `ELIGIBILITY_BADGE_MAP` and `RECORD_STATUS_BADGE`:
- All expected statuses have entries
- Badge variants are correct
- No missing statuses

### Step 4: Update linked records to include workflow status

**File: `src/components/compliance/LinkedRecords.tsx`**

- For each linked incident, show a small "workflow: 4/6 steps" indicator from `incident_workflow_history` count
- This gives a quick visual proof of how far through the workflow each linked record is

## Technical Details

- All new queries use `.in("record_id", allIds)` with proper chunking if >100 IDs (Supabase has no hard limit on `IN` but we should be practical)
- `EvidenceChainData` interface gets two new fields: `incidentWorkflow: any[]` and `complaintWorkflow: any[]`
- Test files use Vitest with no Supabase mocking — they test pure functions only (CSV formatting, badge maps, workflow validation logic)
- Approximately 5 files changed, 3 new test files, ~60 new test cases

## Expected Outcome

- Participant evidence export includes ALL audit logs across every linked record
- Every status transition is visible in both timeline and CSV export
- Workflow completeness gaps are flagged automatically
- ~60 automated tests covering export logic, CSV safety, eligibility maps, and workflow validation

