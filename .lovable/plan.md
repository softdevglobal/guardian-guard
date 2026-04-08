
# Guardian Guard — Compliance Engine V2

## What Already Exists (will NOT rebuild)
- Evidence chain with deep audit-log aggregation across linked records ✓
- Workflow completeness computation ✓
- Controls Matrix page with Standard → Policy → Evidence chain ✓
- Evidence Room with one-click CSV packs ✓
- Mock Audit Mode (read-only) ✓
- Incident actions (basic corrective actions) ✓
- Incident closure enforcement (root_cause, corrective_actions, contributing_factors, participant_followup) ✓

## What's New (6 changes)

### 1. Database Migration (single migration)

**New columns on `incident_actions`:**
- `root_cause TEXT`
- `corrective_action TEXT`
- `preventive_action TEXT`
- `effectiveness_review TEXT`
- `closed_at TIMESTAMPTZ`
- `capa_type TEXT DEFAULT 'corrective'` (corrective, preventive, containment)

**New table: `incident_training_links`**
- id, incident_id, staff_id, training_code, status (assigned/completed), assigned_by, assigned_at, completed_at, organisation_id
- RLS: org-scoped read for admins/compliance, insert by authenticated within org

**New table: `approvals`**
- id, record_type (incident/complaint/policy), record_id, required_role, approved_by, approved_at, status (pending/approved/rejected), notes, organisation_id
- RLS: org-scoped read, insert/update by users with matching role

### 2. CAPA System — Extend Incident Detail Sheet
- Add root_cause, corrective_action, preventive_action, effectiveness_review fields to action form
- Add "CAPA" tab in incident detail showing full corrective/preventive action lifecycle
- Show CAPA completion status badge on each action card

### 3. PDF Audit Packs
- Install `jspdf` + `jspdf-autotable`
- New file: `src/lib/auditPdfExport.ts`
  - `generateParticipantAuditPDF(participantId)` — uses existing `fetchParticipantEvidenceChain`, renders structured PDF with sections: Overview, Timeline, Incidents, Risks, Complaints, Audit Logs
  - `generateIncidentPDF(incidentId)` — single incident with actions, workflow, staff
- Add PDF export buttons alongside existing CSV buttons in Evidence Room and Incident Detail

### 4. Training Linkage
- In incident detail, add "Assign Training" button
- Select staff member + training module → inserts into `incident_training_links`
- Show linked training in incident detail with completion status
- Include training links in evidence chain export (CSV + PDF)

### 5. Approval System
- Auto-create pending approval records when incidents/complaints reach review stages
- Show "Awaiting Supervisor Approval" / "Approved by X at Y" in incident detail
- Add approval action buttons for authorized roles
- **Enforcement**: Cannot advance past supervisor_review without supervisor approval, cannot close without compliance_officer approval

### 6. Evidence Completeness Score
- New utility: `computeEvidenceScore(record)` — checks: linked participant, linked staff, actions present, approvals present, root cause filled, training assigned
- Returns 0-100 score + status (complete/warning/non-compliant)
- Show "Audit Readiness: 82%" badge on incident cards and detail view
- Add aggregate readiness score to Dashboard

## Files Changed/Created

| File | Action |
|------|--------|
| 1 migration SQL | New tables + alter incident_actions |
| `src/lib/auditPdfExport.ts` | New — PDF generation |
| `src/lib/evidenceScore.ts` | New — completeness scoring |
| `src/components/incidents/IncidentDetailSheet.tsx` | Extend — CAPA fields, training links, approvals, score badge |
| `src/components/incidents/IncidentTrainingLinks.tsx` | New — training assignment UI |
| `src/components/incidents/ApprovalStatus.tsx` | New — approval display + action buttons |
| `src/pages/EvidenceRoom.tsx` | Add PDF export buttons |
| `src/components/incidents/IncidentExportButtons.tsx` | Add PDF option |
| `src/pages/Dashboard.tsx` | Add aggregate readiness score |

## Technical Notes
- PDF uses jspdf (no server-side dependency)
- Approvals table uses generic record_type/record_id pattern for reuse across modules
- Evidence score is computed client-side from fetched data, no new DB function needed
- All new tables get RLS policies scoped to organisation_id
- Existing closure enforcement trigger (`enforce_incident_closure`) already blocks closure without root_cause/corrective_actions — the new approval check will be added as an additional client-side gate before allowing the advance mutation
