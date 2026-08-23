# Production readiness assessment — Guardian Guard

Short answer: not yet. The core is strong (206 unit tests pass, RLS and workflow triggers everywhere), but there is one code defect that breaks a main flow and a set of security gaps that must close before real participant data goes in.

## What I verified just now

- Build: passes.
- Tests: 206/206 pass across 9 suites.
- Typecheck: 1 error — `src/pages/Participants.tsx` line 151 calls `invalidateParticipants(queryClient)` but the import from `@/lib/queryKeys` was never added. Creating a participant throws at runtime.
- Security scan: 1 error-level and 7 warning-level findings (details below).
- Unfinished work from the last audit: `ServiceOperations.tsx` still has its own template validation instead of the shared helpers in `src/lib/serviceTaskTemplates.ts`, and the promised tests for "create participant → appears in scheduling selector" and "save template → appears in both lists" do not exist.

## Blockers to fix before production

1. Missing import in `Participants.tsx` — participant creation is broken.
2. `form-attachments` storage bucket: policies check only `bucket_id`, so any signed-in user can list, download and upload across every organisation. Signed agreements and incident evidence are exposed cross-tenant. Rewrite SELECT/INSERT/DELETE to join path-encoded record IDs back to the owning table, following the `task-evidence` bucket pattern.
3. Six INSERT policies check only `created_by = auth.uid()` with no parent-record ownership check, so a signed-in user can fabricate records against other organisations' data: `incident_versions`, `incident_workflow_history`, `complaint_workflow_history`, `incident_actions`, `risk_mitigations`, `participant_progress`. Add organisation/access checks mirroring each table's SELECT policy. This matters more than usual here because the whole product's value is a trustworthy audit trail.
4. Demo/mock data is live in the production database (demo staff, seeded participants, `SA-AUDIT-0001`, refreshed training records). Needs an archive/cleanup pass, keeping audit evidence intact.

## Should fix, not strictly blocking

- Finish the Service Operations refactor onto `templateBlockers` / `templatePayload` / `emptyTemplateForm` / `selectableTemplates` and `invalidateTaskTemplates`.
- Add the two missing regression tests (participant → scheduling selector, template → both lists).
- Outstanding audit steps 11–14 were never completed: supervisor approval, immutability after approval, empty/error states, cross-organisation and unassigned-worker access checks.
- Known UI defects: worker shift cards show a generic "Participant" name; deep-linking `/my-shifts/:id` sometimes renders blank (likely an auth race).
- Notification engine has no email transport and no digest batching — in-app only.
- Supabase linter flags SECURITY DEFINER functions executable by signed-in users; review which genuinely need to be callable and revoke EXECUTE on the rest.

## Operational readiness (not code)

Before real NDIS data: confirm a backup/restore procedure, decide on data retention, and keep the truthfulness rule enforced in the UI — "audit readiness" and "requires human review", never "NDIS compliant" or "certified".

## Suggested order of work

1. Fix the import; typecheck clean.
2. Storage bucket policy migration.
3. Six INSERT policy migrations; rescan to confirm clear.
4. Demo data archive pass.
5. Finish Service Operations refactor plus the two tests.
6. Complete audit steps 11–14 and the two UI defects.
