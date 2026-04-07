---
name: NDIS Compliance System
description: Practice Standards mapping, incident versioning, export system, and timeline tracking
type: feature
---
- `practice_standards` table holds all 14 NDIS Practice Standards (PS1-PS14)
- Every incident MUST map to a practice_standard_id before submission
- Incident timeline merges versions, workflow history, and audit logs into a single chronological view
- CSV export available per-incident (with full timeline) and bulk (register-level)
- Editing is locked after closure (enforced by DB triggers + UI `isEditable` check)
- Version history stored in `incident_versions` table
- Workflow enforced by `enforce_incident_workflow()` trigger — sequential status only
