

# Compliance Engine V2 — Implementation Plan

## Status of Existing Features (will NOT rebuild)
- Evidence chain with deep audit-log aggregation ✓
- Workflow completeness computation ✓
- Controls Matrix page ✓
- Evidence Room with CSV packs ✓
- Mock Audit Mode (read-only) ✓
- Incident closure enforcement (root_cause, corrective_actions, contributing_factors) ✓

## What's New

### Database Migration (1 migration)

**Alter `incident_actions`** — add 6 CAPA columns:
- `root_cause TEXT`, `corrective_action TEXT`, `preventive_action TEXT`
- `effectiveness_review TEXT`, `closed_at TIMESTAMPTZ`, `capa_type TEXT DEFAULT 'corrective'`

**New table: `incident_training_links`**
- Maps incidents to staff training assignments
- Columns: id, incident_id, staff_id, training_code, status, assigned_by, assigned_at, completed_at, organisation_id
- RLS: org-scoped select, insert by assigner, update by admins/compliance/supervisors

**New table: `approvals`**
- Generic approval records for incidents, complaints, policies
- Columns: id, record_type, record_id, required_role, approved_by, approved_at, status, notes, organisation_id
- RLS: org-scoped select, insert/update by admins/compliance/supervisors
- Deletion prevention triggers on both new tables

### New Files

**`src/lib/evidenceScore.ts`**
- `computeIncidentEvidenceScore(incident, actions, approvals, trainingLinks)` — 10 weighted checks (participant linked, staff assigned, root cause, actions completed, approvals granted, training assigned, etc.) → score 0-100
- `computeComplaintEvidenceScore(complaint, approvals)` — 8 weighted checks
- `computeAggregateScore(scores[])` — average across records
- Status thresholds: ≥80 = complete, ≥50 = warning, <50 = non-compliant
- Color constants for UI badges

**`src/lib/auditPdfExport.ts`**
- Uses `jspdf` + `jspdf-autotable` (install via npm)
- `generateParticipantAuditPDF(participantId)` — calls existing `fetchParticipantEvidenceChain`, renders structured PDF with sections: Overview, Timeline, Incidents, Risks, Complaints, Safeguarding, Staff, Audit Logs
- `generateIncidentPDF(incidentId)` — single incident with details, actions, workflow history, staff, audit trail
- Each section rendered as auto-table with headers

**`src/components/incidents/IncidentTrainingLinks.tsx`**
- Shows training assignments linked to this incident from `incident_training_links`
- "Assign Training" button opens inline form: select staff + training module
- Each link shows staff name, training code, status badge (assigned/completed), completion date
- Queries `training_requirements` for module dropdown

**`src/components/incidents/ApprovalStatus.tsx`**
- Queries `approvals` table filtered by record_type + record_id
- Shows approval cards: "Awaiting Supervisor Approval" or "Approved by X at Y"
- Action buttons for authorized roles to approve/reject with notes
- Creates pending approval records automatically when incidents reach review stages

**`src/components/incidents/EvidenceScoreBadge.tsx`**
- Small badge component showing "Audit Readiness: 82%" with color-coded status
- Used in incident cards and detail view

### Modified Files

**`src/components/incidents/IncidentDetailSheet.tsx`**
- Add CAPA fields (root_cause, corrective_action, preventive_action, effectiveness_review) to the action creation form
- Add `<IncidentTrainingLinks>` component after corrective actions section
- Add `<ApprovalStatus>` component before advance button
- Add `<EvidenceScoreBadge>` in the header area
- Advance button blocked if required approvals are pending (client-side gate)

**`src/pages/EvidenceRoom.tsx`**
- Add PDF export button alongside existing CSV export for each module
- "Download PDF Pack" button per module card

**`src/components/incidents/IncidentExportButtons.tsx`**
- Add "Export PDF" option alongside existing CSV export

**`src/pages/Dashboard.tsx`**
- Add aggregate "Audit Readiness" card showing average evidence score across open incidents

**`src/pages/Incidents.tsx`**
- Show small evidence score badge on each incident card in the list view

### npm dependency
- `jspdf` + `jspdf-autotable` for client-side PDF generation

### Files Summary

| File | Action |
|------|--------|
| Migration SQL | Alter incident_actions, create 2 tables |
| `src/lib/evidenceScore.ts` | New |
| `src/lib/auditPdfExport.ts` | New |
| `src/components/incidents/IncidentTrainingLinks.tsx` | New |
| `src/components/incidents/ApprovalStatus.tsx` | New |
| `src/components/incidents/EvidenceScoreBadge.tsx` | New |
| `src/components/incidents/IncidentDetailSheet.tsx` | Extend |
| `src/components/incidents/IncidentExportButtons.tsx` | Extend |
| `src/pages/EvidenceRoom.tsx` | Extend |
| `src/pages/Dashboard.tsx` | Extend |
| `src/pages/Incidents.tsx` | Extend |

