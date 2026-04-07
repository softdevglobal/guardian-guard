CREATE OR REPLACE FUNCTION public.insert_notification_deduped(
  _user_id uuid,
  _title text,
  _message text,
  _severity text,
  _notification_type text,
  _source_table text,
  _source_record_id text,
  _link text,
  _organisation_id uuid,
  _fingerprint text,
  _dedupe_bucket text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted boolean;
BEGIN
  INSERT INTO public.notifications (
    user_id, title, message, severity, notification_type,
    source_table, source_record_id, link, organisation_id,
    fingerprint, dedupe_bucket
  ) VALUES (
    _user_id, _title, _message, _severity, _notification_type,
    _source_table, _source_record_id, _link, _organisation_id,
    _fingerprint, _dedupe_bucket
  )
  ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
  DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;
  RETURN _inserted > 0;
END;
$$;