
-- 1. Add closed immutability to risks table
CREATE OR REPLACE FUNCTION public.prevent_closed_risk_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'closed' AND NEW.status = 'closed' THEN
    IF NEW.record_status IS DISTINCT FROM OLD.record_status THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a closed risk record. Closed records are read-only.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_closed_immutability_risks
  BEFORE UPDATE ON public.risks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_closed_risk_update();

-- 2. Fix training_completions HR SELECT to be org-scoped
DROP POLICY IF EXISTS "HR admins view all training" ON public.training_completions;
CREATE POLICY "HR admins view all training"
  ON public.training_completions
  FOR SELECT
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'hr_admin'::app_role, 'compliance_officer'::app_role])
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = training_completions.user_id
        AND up.organisation_id = get_user_organisation_id(auth.uid())
    )
  );

-- Also scope HR manage training to org
DROP POLICY IF EXISTS "HR manage training" ON public.training_completions;
CREATE POLICY "HR manage training"
  ON public.training_completions
  FOR ALL
  TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'hr_admin'::app_role])
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = training_completions.user_id
        AND up.organisation_id = get_user_organisation_id(auth.uid())
    )
  );

-- 3. Fix tasks INSERT policy to enforce ownership + org scope
DROP POLICY IF EXISTS "Users create tasks" ON public.tasks;
CREATE POLICY "Users create tasks"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND organisation_id = get_user_organisation_id(auth.uid())
  );
