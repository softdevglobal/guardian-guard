REVOKE EXECUTE ON FUNCTION public.enforce_attendance_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_shift_workflow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_evidence_immutability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_evidence_supersede() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_shift_workflow() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_shift(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_shift(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_shift_oversight(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shift_submission_blockers(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.geo_distance_metres(numeric,numeric,numeric,numeric) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_access_shift(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_shift(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shift_oversight(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shift_submission_blockers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.geo_distance_metres(numeric,numeric,numeric,numeric) TO authenticated;