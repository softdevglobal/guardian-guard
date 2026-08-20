REVOKE EXECUTE ON FUNCTION public.insert_notification_deduped(uuid, text, text, text, text, text, text, text, uuid, text, text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_incident_time_breaches() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_notification_deduped(uuid, text, text, text, text, text, text, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_incident_time_breaches() TO service_role;