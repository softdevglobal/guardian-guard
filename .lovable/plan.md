

# Controls Matrix, Document Register, Competency Vault, Evidence Room, Mock Audit Mode

Five new features that close the remaining audit-readiness gaps.

---

## Step 1: Database Changes (1 migration)

**New table: `controls_matrix`**
Maps Practice Standards → Quality Indicators → Policies → Workflow rules → Evidence records.

```
id, practice_standard_id (FK), quality_indicator text, linked_policy_id (FK nullable),
workflow_module text, evidence_table text, evidence_description text,
organisation_id, created_by, created_at, updated_at, record_status
```
RLS: admins/compliance read+write, others read-only within org.

**Alter `certifications` table**: add `qualification_type` (enum: qualification, licence, induction, certification), `role_requirement` (jsonb, maps to roles), `organisation_id`, `verified_by`, `verified_at`.

**Alter `policies` table**: add `linked_standard_id` (FK to practice_standards, nullable) for document control register linkage.

---

## Step 2: Controls Matrix Page

**New file: `src/pages/ControlsMatrix.tsx`**
- Route: `/controls` in App.tsx, sidebar label "Controls Matrix"
- Table view: Practice Standard Code | Standard Name | Quality Indicator | Linked Policy | Workflow Module | Evidence Record | Status
- Pre-seeded from `practice_standards` (PS1-PS14) with editable quality indicators
- Filter by standard category (Core/Supplementary)
- Admin can add/edit rows linking a standard → policy → evidence source
- Click a row to see the full chain: Standard → Policy (with version/approval date) → Workflow status → Evidence count

---

## Step 3: Document Control Register (enhance Policies page)

**Modified file: `src/pages/Policies.tsx`**
- Add a "Document Control" tab alongside existing tabs
- Shows: Policy Title | Owner (from `owner_id` join) | Version | Approval Date | Next Review Date | Linked Standard | Status
- Sortable by next review date to surface overdue reviews
- Filter by linked practice standard
- Export to CSV button

---

## Step 4: Staff Competency Vault

**New file: `src/pages/CompetencyVault.tsx`**
- Route: `/competency-vault`, sidebar label "Competency Vault"
- Unified view merging: `certifications` + `training_completions` + `staff_compliance_records`
- Columns: Staff Name | Qualification/Cert | Type (qualification/licence/induction/refresher) | Issuer | Issue Date | Expiry Date | Status | Role Mapping
- Filter by: staff member, type, expiry status (current/expiring/expired)
- Role-to-competency matrix view: rows = roles, columns = required qualifications, cells = count of staff meeting each
- Bulk expiry alerts highlighted

---

## Step 5: Audit Evidence Room

**New file: `src/pages/EvidenceRoom.tsx`**
- Route: `/evidence-room`, sidebar label "Evidence Room"
- Module selector cards: Incidents, Complaints, Risks, Governance (policies), HR (staff compliance), Training, Safeguarding
- Click a module → generates a one-click evidence pack:
  - Queries all active records for that module
  - Pulls linked audit logs, workflow history, versions
  - Generates a downloadable ZIP-like CSV bundle (one CSV per section)
  - Shows summary stats: total records, complete workflows, gaps found
- "Full Pack" button: generates evidence across ALL modules in one export
- Uses existing `exportEvidenceChainCSV` and `exportBulkIncidentsCSV` functions, plus new module-specific exporters

---

## Step 6: Mock Audit Mode

**Modified files: `src/contexts/AuthContext.tsx`, `src/components/AppHeader.tsx`, multiple pages**

- Add `isMockAudit` boolean to AuthContext
- Toggle in header: "Enter Mock Audit" button (visible to super_admin, compliance_officer)
- When active:
  - Purple banner across top: "MOCK AUDIT MODE — Read-Only View"
  - All create/edit/delete buttons hidden via a `useAuth().isMockAudit` check
  - All mutation calls blocked (early return with toast "Read-only in mock audit mode")
  - Navigation fully functional — auditor can browse every module
  - Evidence Room and Controls Matrix remain fully accessible
  - Audit log records the mock audit session start/end
- Exit via banner "Exit Mock Audit" button

---

## Step 7: Routing and Sidebar Updates

**Modified: `src/App.tsx`** — Add routes for `/controls`, `/competency-vault`, `/evidence-room`

**Modified: `src/components/AppSidebar.tsx`** — Add nav items under a new "Governance" group:
- Controls Matrix (Grid3x3 icon)
- Competency Vault (Award icon)  
- Evidence Room (Archive icon)

**Modified: `src/contexts/AuthContext.tsx`** — Add `controls`, `competency`, `evidence_room` to ROLE_MODULES for super_admin, compliance_officer, executive (read-only for executive)

---

## Files Changed/Created

| File | Action |
|------|--------|
| 1 migration SQL | New `controls_matrix` table, alter `certifications`, alter `policies` |
| `src/pages/ControlsMatrix.tsx` | New |
| `src/pages/CompetencyVault.tsx` | New |
| `src/pages/EvidenceRoom.tsx` | New |
| `src/pages/Policies.tsx` | Add Document Control tab |
| `src/contexts/AuthContext.tsx` | Add `isMockAudit`, new modules |
| `src/components/AppHeader.tsx` | Mock audit toggle button |
| `src/components/AppSidebar.tsx` | New nav items |
| `src/App.tsx` | New routes |

