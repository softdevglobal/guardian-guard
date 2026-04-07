
-- Trigger: block advancing to under_review/investigating without assigned handler
CREATE OR REPLACE FUNCTION public.enforce_complaint_handler_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('under_review', 'investigating') AND OLD.status NOT IN ('under_review', 'investigating') THEN
    IF NEW.assigned_handler IS NULL THEN
      RAISE EXCEPTION 'Cannot advance complaint to %: a handler must be assigned first.', NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_complaint_handler ON public.complaints;
CREATE TRIGGER trg_enforce_complaint_handler
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_complaint_handler_assignment();

-- Trigger: log late acknowledgement (>2 days)
CREATE OR REPLACE FUNCTION public.log_late_complaint_acknowledgement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'acknowledged' AND OLD.status = 'submitted' THEN
    IF NEW.acknowledgement_date IS NOT NULL AND
       NEW.acknowledgement_date > (OLD.created_at + interval '2 days') THEN
      INSERT INTO public.audit_logs (user_id, action, module, record_id, organisation_id, severity, details)
      VALUES (auth.uid(), 'late_acknowledgement', 'complaints', NEW.id, NEW.organisation_id, 'elevated',
              jsonb_build_object(
                'complaint_number', NEW.complaint_number,
                'created_at', OLD.created_at,
                'acknowledged_at', NEW.acknowledgement_date,
                'delay_hours', EXTRACT(EPOCH FROM (NEW.acknowledgement_date - OLD.created_at)) / 3600
              ));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_late_complaint_ack ON public.complaints;
CREATE TRIGGER trg_log_late_complaint_ack
  AFTER UPDATE ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.log_late_complaint_acknowledgement();
