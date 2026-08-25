-- Storage policies for the removed shift/task workflow
DROP POLICY IF EXISTS task_evidence_select ON storage.objects;
DROP POLICY IF EXISTS task_evidence_insert ON storage.objects;
DROP POLICY IF EXISTS task_evidence_update ON storage.objects;
DROP POLICY IF EXISTS task_evidence_delete ON storage.objects;

-- Operational tables (rostering, shifts, service delivery, sites, funding)
DROP TABLE IF EXISTS public.task_evidence CASCADE;
DROP TABLE IF EXISTS public.shift_completion_confirmations CASCADE;
DROP TABLE IF EXISTS public.attendance_events CASCADE;
DROP TABLE IF EXISTS public.service_shift_tasks CASCADE;
DROP TABLE IF EXISTS public.service_shifts CASCADE;
DROP TABLE IF EXISTS public.service_task_templates CASCADE;
DROP TABLE IF EXISTS public.service_delivery_records CASCADE;
DROP TABLE IF EXISTS public.worker_profiles CASCADE;
DROP TABLE IF EXISTS public.sites CASCADE;
DROP TABLE IF EXISTS public.participant_funding CASCADE;

-- Functions that only served the removed operational surface
DROP FUNCTION IF EXISTS public.can_access_shift(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_edit_shift(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_shift_oversight(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.shift_submission_blockers(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.enforce_shift_workflow() CASCADE;
DROP FUNCTION IF EXISTS public.notify_shift_workflow() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_attendance_event() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_evidence_immutability() CASCADE;
DROP FUNCTION IF EXISTS public.geo_distance_metres(numeric, numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.calc_participant_funding_remaining() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_service_agreement_gate() CASCADE;

-- Enums no longer referenced
DROP TYPE IF EXISTS public.task_evidence_type CASCADE;
DROP TYPE IF EXISTS public.shift_status CASCADE;
DROP TYPE IF EXISTS public.shift_task_status CASCADE;
DROP TYPE IF EXISTS public.attendance_event_type CASCADE;
DROP TYPE IF EXISTS public.geofence_result CASCADE;