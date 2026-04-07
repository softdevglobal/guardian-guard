-- 1. Auto-set NDIS notification deadline for serious/critical incidents
CREATE OR REPLACE FUNCTION public.auto_set_ndis_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set 24h deadline for high/critical severity
  IF NEW.severity IN ('high', 'critical') AND (
    TG_OP = 'INSERT' OR
    (TG_OP = 'UPDATE' AND OLD.severity NOT IN ('high', 'critical'))
  ) THEN
    IF NEW.ndis_notification_deadline IS NULL THEN
      NEW.ndis_notification_deadline := now() + interval '24 hours';
    END IF;
    NEW.is_reportable := true;
    IF NEW.reportable_reason IS NULL THEN
      NEW.reportable_reason := 'Auto-flagged: ' || NEW.severity || ' severity incident';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_ndis_deadline ON public.incidents;
CREATE TRIGGER trg_auto_set_ndis_deadline
BEFORE INSERT OR UPDATE OF severity ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_ndis_deadline();

-- 2. Escalation notification trigger on status advancement
CREATE OR REPLACE FUNCTION public.incident_escalation_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supervisor_ids uuid[];
  _compliance_ids uuid[];
  _uid uuid;
  _incident_link text;
BEGIN
  -- Only fire on status change
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  _incident_link := '/incidents';

  -- When submitted: notify supervisors
  IF NEW.status = 'submitted' THEN
    SELECT array_agg(ur.user_id) INTO _supervisor_ids
    FROM public.user_roles ur
    JOIN public.user_profiles up ON up.id = ur.user_id
    WHERE ur.role IN ('supervisor', 'super_admin')
      AND up.organisation_id = NEW.organisation_id;

    IF _supervisor_ids IS NOT NULL THEN
      FOREACH _uid IN ARRAY _supervisor_ids LOOP
        INSERT INTO public.notifications (user_id, title, message, severity, notification_type, source_table, source_record_id, link, organisation_id)
        VALUES (_uid, 'New Incident Submitted: ' || NEW.incident_number,
                'Incident "' || NEW.title || '" requires supervisor review. Severity: ' || NEW.severity,
                CASE WHEN NEW.severity IN ('high', 'critical') THEN 'critical' ELSE 'warning' END,
                'incident_escalation', 'incidents', NEW.id, _incident_link, NEW.organisation_id);
      END LOOP;
    END IF;
  END IF;

  -- When moved to supervisor_review or beyond with high/critical: notify compliance
  IF NEW.status IN ('supervisor_review', 'compliance_review') AND NEW.severity IN ('high', 'critical') THEN
    SELECT array_agg(ur.user_id) INTO _compliance_ids
    FROM public.user_roles ur
    JOIN public.user_profiles up ON up.id = ur.user_id
    WHERE ur.role IN ('compliance_officer', 'super_admin')
      AND up.organisation_id = NEW.organisation_id;

    IF _compliance_ids IS NOT NULL THEN
      FOREACH _uid IN ARRAY _compliance_ids LOOP
        INSERT INTO public.notifications (user_id, title, message, severity, notification_type, source_table, source_record_id, link, organisation_id)
        VALUES (_uid, 'URGENT: ' || NEW.severity || ' Incident Escalated - ' || NEW.incident_number,
                'Incident "' || NEW.title || '" has been escalated for compliance review. NDIS notification may be required.',
                'critical', 'incident_escalation', 'incidents', NEW.id, _incident_link, NEW.organisation_id);
      END LOOP;
    END IF;
  END IF;

  -- NDIS deadline breach warning on closure attempt
  IF NEW.status = 'closed' AND NEW.is_reportable AND NEW.ndis_notification_deadline IS NOT NULL
     AND NEW.ndis_notification_deadline < now() THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, organisation_id, severity, details)
    VALUES (auth.uid(), 'ndis_deadline_breach', 'incidents', NEW.id, NEW.organisation_id, 'critical',
            jsonb_build_object('incident_number', NEW.incident_number, 'deadline', NEW.ndis_notification_deadline, 'closed_at', now()));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_escalation_notify ON public.incidents;
CREATE TRIGGER trg_incident_escalation_notify
AFTER UPDATE OF status ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.incident_escalation_notify();

-- 3. Function to check time breaches (called by scheduled job or edge function)
CREATE OR REPLACE FUNCTION public.check_incident_time_breaches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
  _breaches int := 0;
  _uid uuid;
  _compliance_ids uuid[];
BEGIN
  -- Check 24h NDIS deadline breaches
  FOR _rec IN
    SELECT i.id, i.incident_number, i.title, i.ndis_notification_deadline, i.organisation_id, i.severity
    FROM public.incidents i
    WHERE i.status NOT IN ('closed', 'actioned')
      AND i.is_reportable = true
      AND i.ndis_notification_deadline IS NOT NULL
      AND i.ndis_notification_deadline < now()
      AND i.record_status = 'active'
  LOOP
    SELECT array_agg(ur.user_id) INTO _compliance_ids
    FROM public.user_roles ur
    JOIN public.user_profiles up ON up.id = ur.user_id
    WHERE ur.role IN ('compliance_officer', 'super_admin')
      AND up.organisation_id = _rec.organisation_id;

    IF _compliance_ids IS NOT NULL THEN
      FOREACH _uid IN ARRAY _compliance_ids LOOP
        PERFORM public.insert_notification_deduped(
          _uid,
          'BREACH: 24h NDIS Deadline Exceeded - ' || _rec.incident_number,
          'Incident "' || _rec.title || '" has exceeded the 24-hour NDIS notification deadline. Immediate action required.',
          'critical', 'time_breach', 'incidents', _rec.id::text, '/incidents', _rec.organisation_id,
          'ndis_breach_' || _rec.id::text, 'incident_time_breach'
        );
      END LOOP;
    END IF;
    _breaches := _breaches + 1;
  END LOOP;

  -- Check 5-day closure deadline breaches
  FOR _rec IN
    SELECT i.id, i.incident_number, i.title, i.created_at, i.organisation_id
    FROM public.incidents i
    WHERE i.status NOT IN ('closed', 'actioned')
      AND i.created_at < (now() - interval '5 days')
      AND i.record_status = 'active'
  LOOP
    SELECT array_agg(ur.user_id) INTO _compliance_ids
    FROM public.user_roles ur
    JOIN public.user_profiles up ON up.id = ur.user_id
    WHERE ur.role IN ('compliance_officer', 'super_admin')
      AND up.organisation_id = _rec.organisation_id;

    IF _compliance_ids IS NOT NULL THEN
      FOREACH _uid IN ARRAY _compliance_ids LOOP
        PERFORM public.insert_notification_deduped(
          _uid,
          'OVERDUE: 5-Day Closure Deadline - ' || _rec.incident_number,
          'Incident "' || _rec.title || '" has exceeded the 5-day resolution target.',
          'warning', 'time_breach', 'incidents', _rec.id::text, '/incidents', _rec.organisation_id,
          'closure_breach_' || _rec.id::text, 'incident_time_breach'
        );
      END LOOP;
    END IF;
    _breaches := _breaches + 1;
  END LOOP;

  RETURN jsonb_build_object('breaches_found', _breaches);
END;
$$;

-- 4. Training eligibility check for incident handlers
CREATE OR REPLACE FUNCTION public.check_incident_handler_training(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_training boolean;
  _org_id uuid;
BEGIN
  SELECT organisation_id INTO _org_id FROM public.user_profiles WHERE id = _user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.training_completions tc
    WHERE tc.user_id = _user_id
      AND tc.training_code = 'INCIDENT_MGMT'
      AND tc.status = 'completed'
      AND tc.verified_by IS NOT NULL
      AND (tc.expiry_date IS NULL OR tc.expiry_date >= CURRENT_DATE)
  ) INTO _has_training;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'has_incident_training', _has_training,
    'training_code', 'INCIDENT_MGMT'
  );
END;
$$;