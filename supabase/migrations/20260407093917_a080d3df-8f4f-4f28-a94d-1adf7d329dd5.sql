-- Auto-calculate risk score on risks table
CREATE OR REPLACE FUNCTION public.auto_calculate_risk_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.risk_score := COALESCE(NEW.likelihood_score, 1) * COALESCE(NEW.impact_score, 1);
  
  IF NEW.risk_score >= 16 THEN
    NEW.risk_level := 'Critical';
  ELSIF NEW.risk_score >= 10 THEN
    NEW.risk_level := 'High';
  ELSIF NEW.risk_score >= 5 THEN
    NEW.risk_level := 'Medium';
  ELSE
    NEW.risk_level := 'Low';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_risk_score
BEFORE INSERT OR UPDATE OF likelihood_score, impact_score ON public.risks
FOR EACH ROW
EXECUTE FUNCTION public.auto_calculate_risk_score();

-- Auto-check staff eligibility
CREATE OR REPLACE FUNCTION public.auto_check_staff_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.police_check_status = 'expired' 
     OR NEW.wwcc_status = 'expired' 
     OR NEW.worker_screening_status = 'expired'
     OR NEW.identity_verification = false
  THEN
    NEW.eligible_for_assignment := false;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_staff_eligibility
BEFORE INSERT OR UPDATE ON public.staff_compliance
FOR EACH ROW
EXECUTE FUNCTION public.auto_check_staff_eligibility();

-- Auto-calculate staff compliance percentage
CREATE OR REPLACE FUNCTION public.auto_calculate_compliance_pct()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_checks integer := 10;
  passed integer := 0;
BEGIN
  IF NEW.police_check_status = 'current' THEN passed := passed + 1; END IF;
  IF NEW.wwcc_status = 'current' THEN passed := passed + 1; END IF;
  IF NEW.worker_screening_status = 'current' THEN passed := passed + 1; END IF;
  IF NEW.identity_verification THEN passed := passed + 1; END IF;
  IF NEW.mandatory_induction THEN passed := passed + 1; END IF;
  IF NEW.worker_orientation THEN passed := passed + 1; END IF;
  IF NEW.cyber_safety_completed THEN passed := passed + 1; END IF;
  IF NEW.incident_mgmt_training THEN passed := passed + 1; END IF;
  IF NEW.safeguarding_training THEN passed := passed + 1; END IF;
  IF NEW.code_of_conduct_acknowledged THEN passed := passed + 1; END IF;
  
  NEW.overall_compliance_pct := ROUND((passed::numeric / total_checks) * 100);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_compliance_pct
BEFORE INSERT OR UPDATE ON public.staff_compliance
FOR EACH ROW
EXECUTE FUNCTION public.auto_calculate_compliance_pct();