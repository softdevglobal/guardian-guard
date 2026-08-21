# Worker Service Task Completion and Evidence

This module records what actually happened during a service: attendance, tasks, evidence,
service notes, transport kilometres and supervisor approval. It supports compliance and
audit readiness. It does not determine compliance with the NDIS Practice Standards, and it
makes no clinical or safeguarding decision — a person must review every record.

## Privacy and consent

- Photography is **off by default**. A participant only has photo evidence captured when
  `participant_evidence_preferences.photography_consent_status = 'granted'`, and only for the
  evidence types listed in `allowed_evidence_types`.
- Restrictions (private areas, whether the participant may appear, accessible explanation
  provided, consent version, reviewer and review date) are shown to the worker **before** the
  camera opens.
- **NDIS rules do not universally require before/after photographs.** Photos are an optional
  organisational evidence practice. A participant declining photography must never delay,
  reduce or block their service. When photography is not permitted, the worker records
  written service notes as the alternative evidence, and completion is not blocked.
- Evidence files live in a **private** Storage bucket (`task-evidence`). Public URLs are never
  used. Every view issues a short-lived signed URL (120 seconds) and writes an audit entry.
- Access instructions for a participant's home are restricted to the assigned worker and
  oversight roles.

## GPS limitations

- Location is requested **once, at the moment the worker taps check in or check out**. The app
  never tracks a worker continuously and never runs a background location watcher.
- Device coordinates and accuracy are stored as *reported by the device*. They are advisory
  only: GPS accuracy varies with buildings, weather and device hardware.
- The **server timestamp is authoritative**. Device capture time is stored alongside it for
  comparison, never in place of it.
- If location is unavailable, inaccurate (> 250 m reported accuracy) or outside the geofence,
  the worker must enter a reason. Coordinates are never fabricated or inferred. The shift is
  flagged `requires_supervisor_review` for human assessment.

## Offline capture

- Photos and notes taken during a connectivity loss are held in a local device queue with the
  device capture time. When connectivity returns they are uploaded, the server records
  `synced_at`, and both times appear on the supervisor timeline.
- Queued items are drafts only. Nothing counts as evidence until it is stored server-side with
  its SHA-256 hash.

## Evidence integrity and retention

- Each file's SHA-256 hash is computed in the browser from the original bytes before upload.
  The original image is preserved — it is never resized, cropped or re-encoded.
- Evidence is append-only. Workers cannot delete or overwrite an item. An incorrect item is
  superseded by a new upload with a written reason; the original is retained with
  `record_status = 'archived'` and the replacement links back via `supersedes_evidence_id`.
- Database triggers reject any change to `storage_path`, `sha256_hash`, `evidence_type`,
  `shift_id` or `server_created_at`, and hard deletion is blocked on every table in this module.
- Retention follows the organisation's NDIS record-keeping schedule. Nothing in this module
  deletes records; archival and disposal are governed decisions made outside the app.

## Workflow gates

| Gate | Enforcement |
| --- | --- |
| Worker sees only their own assigned shifts | RLS on `service_shifts` |
| Check in blocked when the worker is ineligible | `check_staff_assignment_eligible` in the attendance trigger |
| Submitted shifts cannot be silently edited | `enforce_shift_workflow` |
| Approval limited to supervisor / compliance / admin | `enforce_shift_workflow` |
| Submission blocked when tasks or required evidence are missing | `shift_submission_blockers` |
| Authorised exception with written reason overrides the evidence gate | `evidence_exception` + reason |
| Approved records read-only | `enforce_shift_workflow` |

Duration and kilometre summaries are prepared for **future** timesheet and invoice generation.
There is no NDIA API integration and none is claimed.
