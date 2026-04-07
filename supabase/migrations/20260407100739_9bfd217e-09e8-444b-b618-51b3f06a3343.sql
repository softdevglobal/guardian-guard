CREATE OR REPLACE FUNCTION public.audit_trail_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _module text;
  _org_id uuid;
  _details jsonb;
  _user_name text;
  _record_id uuid;
  _new_jsonb jsonb;
  _old_jsonb jsonb;
BEGIN
  _new_jsonb := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _details := _new_jsonb;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
    _old_jsonb := to_jsonb(OLD);
    _details := jsonb_build_object('old', _old_jsonb, 'new', _new_jsonb);
  END IF;

  _module := TG_TABLE_NAME;

  IF _new_jsonb ? 'organisation_id' THEN
    _org_id := (_new_jsonb->>'organisation_id')::uuid;
  END IF;

  IF _new_jsonb ? 'id' THEN
    _record_id := (_new_jsonb->>'id')::uuid;
  END IF;

  SELECT full_name INTO _user_name FROM public.user_profiles WHERE id = auth.uid();

  INSERT INTO public.audit_logs (user_id, user_name, action, module, record_id, organisation_id, details, severity)
  VALUES (auth.uid(), _user_name, _action, _module, _record_id, _org_id, _details, 'normal');

  RETURN NEW;
END;
$$;