
-- Add review_frequency to risks
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS review_frequency text DEFAULT 'quarterly';

-- Trigger: prevent risk closure without completed mitigations
CREATE OR REPLACE FUNCTION public.enforce_risk_closure_mitigations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pending int;
BEGIN
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    SELECT count(*) INTO _pending
    FROM public.risk_mitigations
    WHERE risk_id = NEW.id
      AND status NOT IN ('completed', 'cancelled');

    IF _pending > 0 THEN
      RAISE EXCEPTION 'Cannot close risk: % mitigation action(s) are still pending. Complete or cancel all mitigations before closing.', _pending;
    END IF;

    -- Also require at least one mitigation to have been recorded
    IF NOT EXISTS (SELECT 1 FROM public.risk_mitigations WHERE risk_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot close risk: at least one mitigation action must be recorded before closure.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_risk_closure_mitigations ON public.risks;
CREATE TRIGGER trg_enforce_risk_closure_mitigations
  BEFORE UPDATE ON public.risks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_risk_closure_mitigations();

-- Trigger: prevent silent risk downgrade (score reduction requires compliance role)
CREATE OR REPLACE FUNCTION public.prevent_risk_score_downgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_score int;
  _new_score int;
BEGIN
  _old_score := COALESCE(OLD.likelihood_score, 1) * COALESCE(OLD.impact_score, 1);
  _new_score := COALESCE(NEW.likelihood_score, 1) * COALESCE(NEW.impact_score, 1);

  IF _new_score < _old_score THEN
    IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role]) THEN
      RAISE EXCEPTION 'Risk score downgrade from % to % requires compliance_officer or super_admin role.', _old_score, _new_score;
    END IF;
    
    -- Log the downgrade
    INSERT INTO public.audit_logs (user_id, action, module, record_id, organisation_id, severity, details)
    VALUES (auth.uid(), 'risk_score_downgrade', 'risks', NEW.id, NEW.organisation_id, 'elevated',
            jsonb_build_object('old_score', _old_score, 'new_score', _new_score, 'old_likelihood', OLD.likelihood_score, 'new_likelihood', NEW.likelihood_score, 'old_impact', OLD.impact_score, 'new_impact', NEW.impact_score));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_risk_score_downgrade ON public.risks;
CREATE TRIGGER trg_prevent_risk_score_downgrade
  BEFORE UPDATE ON public.risks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_risk_score_downgrade();

-- Add UPDATE policy for risk mitigations (owners can update)
CREATE POLICY "Update risk mitigations"
ON public.risk_mitigations
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.risks r
    WHERE r.id = risk_mitigations.risk_id
      AND r.organisation_id = get_user_organisation_id(auth.uid())
      AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role])
  )
);
