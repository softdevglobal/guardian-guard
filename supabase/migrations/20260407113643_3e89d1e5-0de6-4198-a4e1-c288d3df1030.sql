
-- 1. Create training_requirements table
CREATE TABLE IF NOT EXISTS public.training_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  training_code text NOT NULL,
  training_name text NOT NULL,
  description text,
  is_mandatory boolean NOT NULL DEFAULT true,
  validity_months integer,
  min_pass_score numeric DEFAULT 0,
  required_for_roles jsonb DEFAULT '[]'::jsonb,
  linked_module_id uuid REFERENCES public.training_modules(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organisation_id, training_code)
);

ALTER TABLE public.training_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage training requirements"
  ON public.training_requirements FOR ALL TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin']::app_role[]))
  WITH CHECK (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin']::app_role[]));

CREATE POLICY "Staff view training requirements"
  ON public.training_requirements FOR SELECT TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()));

CREATE TRIGGER update_training_requirements_updated_at
  BEFORE UPDATE ON public.training_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Extend training_completions with verification fields
ALTER TABLE public.training_completions
  ADD COLUMN IF NOT EXISTS training_code text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS evidence_file_url text,
  ADD COLUMN IF NOT EXISTS assessment_passed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);

-- 3. Prevent self-verification on training completions
CREATE OR REPLACE FUNCTION public.prevent_training_self_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verified_by IS NOT NULL AND NEW.verified_by = NEW.user_id THEN
    RAISE EXCEPTION 'Staff cannot verify their own training completion.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_training_self_verification
  BEFORE INSERT OR UPDATE ON public.training_completions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_training_self_verification();

-- 4. Re-evaluate eligibility when training completion changes
CREATE OR REPLACE FUNCTION public.reevaluate_on_training_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.evaluate_staff_eligibility(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reevaluate_on_training_change
  AFTER INSERT OR UPDATE ON public.training_completions
  FOR EACH ROW EXECUTE FUNCTION public.reevaluate_on_training_change();

-- 5. Prevent deletion of training completions
CREATE TRIGGER trg_prevent_training_deletion
  BEFORE DELETE ON public.training_completions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

-- 6. Audit trail on training completions
CREATE TRIGGER trg_audit_training_completions
  AFTER INSERT OR UPDATE ON public.training_completions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

-- 7. RLS for training_completions (ensure existing + new policies)
-- Drop old policies if they exist to replace cleanly
DO $$
BEGIN
  -- These may not exist, so ignore errors
  BEGIN DROP POLICY IF EXISTS "Users view own completions" ON public.training_completions; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Users create own completions" ON public.training_completions; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins view all completions" ON public.training_completions; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Admins update completions" ON public.training_completions; EXCEPTION WHEN OTHERS THEN NULL; END;
END
$$;

ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own completions"
  ON public.training_completions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create own completions"
  ON public.training_completions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all completions"
  ON public.training_completions FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin']::app_role[]));

CREATE POLICY "Admins update completions"
  ON public.training_completions FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin']::app_role[]));

-- 8. Update evaluate_staff_eligibility to include training checks
CREATE OR REPLACE FUNCTION public.evaluate_staff_eligibility(_staff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _user_role text;
  _staff_status text;
  _reasons text[] := '{}';
  _is_eligible boolean := true;
  _status public.eligibility_status := 'compliant';
  _has_expiring boolean := false;
  _req record;
  _rec record;
  _treq record;
  _trec record;
BEGIN
  SELECT organisation_id INTO _org_id FROM public.user_profiles WHERE id = _staff_id;
  IF _org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Staff not found');
  END IF;

  SELECT role::text INTO _user_role FROM public.user_roles WHERE user_id = _staff_id LIMIT 1;
  _user_role := COALESCE(_user_role, 'support_worker');

  -- Check legacy staff_compliance for suspension
  SELECT
    CASE WHEN police_check_status = 'expired' OR wwcc_status = 'expired' OR worker_screening_status = 'expired' THEN 'suspended'
         ELSE 'active' END
  INTO _staff_status
  FROM public.staff_compliance WHERE user_id = _staff_id;

  IF _staff_status = 'suspended' THEN
    _is_eligible := false;
    _status := 'suspended';
    _reasons := array_append(_reasons, 'Staff has expired clearance in legacy compliance system');
  END IF;

  -- Check staff_compliance_requirements
  FOR _req IN
    SELECT requirement_code, requirement_name, expiry_required
    FROM public.staff_compliance_requirements
    WHERE organisation_id = _org_id
      AND is_mandatory = true
      AND (applies_to_roles = '[]'::jsonb OR applies_to_roles @> to_jsonb(_user_role))
  LOOP
    SELECT * INTO _rec
    FROM public.staff_compliance_records
    WHERE staff_id = _staff_id
      AND requirement_code = _req.requirement_code
      AND organisation_id = _org_id
    ORDER BY created_at DESC LIMIT 1;

    IF _rec IS NULL OR _rec.status = 'missing' THEN
      _is_eligible := false;
      _reasons := array_append(_reasons, 'Missing: ' || _req.requirement_name);
    ELSIF _rec.status = 'rejected' THEN
      _is_eligible := false;
      _reasons := array_append(_reasons, 'Rejected: ' || _req.requirement_name);
    ELSIF _rec.status = 'expired' THEN
      _is_eligible := false;
      _reasons := array_append(_reasons, 'Expired: ' || _req.requirement_name);
    ELSIF _rec.status = 'pending_review' THEN
      _is_eligible := false;
      _reasons := array_append(_reasons, 'Pending review: ' || _req.requirement_name);
    ELSIF _rec.status = 'expiring_soon' THEN
      _has_expiring := true;
    END IF;
  END LOOP;

  -- Check training_requirements
  FOR _treq IN
    SELECT training_code, training_name, validity_months, min_pass_score
    FROM public.training_requirements
    WHERE organisation_id = _org_id
      AND is_mandatory = true
      AND (required_for_roles = '[]'::jsonb OR required_for_roles @> to_jsonb(_user_role))
  LOOP
    SELECT * INTO _trec
    FROM public.training_completions
    WHERE user_id = _staff_id
      AND training_code = _treq.training_code
      AND status = 'completed'
      AND verified_by IS NOT NULL
    ORDER BY completion_date DESC NULLS LAST LIMIT 1;

    IF _trec IS NULL THEN
      _is_eligible := false;
      _reasons := array_append(_reasons, 'Training missing: ' || _treq.training_name);
    ELSIF _treq.validity_months IS NOT NULL AND _trec.expiry_date IS NOT NULL THEN
      IF _trec.expiry_date < CURRENT_DATE THEN
        _is_eligible := false;
        _reasons := array_append(_reasons, 'Training expired: ' || _treq.training_name);
      ELSIF _trec.expiry_date < (CURRENT_DATE + interval '60 days') THEN
        _has_expiring := true;
      END IF;
    END IF;

    -- Check min score
    IF _trec IS NOT NULL AND _treq.min_pass_score > 0 AND (COALESCE(_trec.score, 0) < _treq.min_pass_score) THEN
      _is_eligible := false;
      _reasons := array_append(_reasons, 'Training score below minimum: ' || _treq.training_name);
    END IF;
  END LOOP;

  -- Determine final status
  IF NOT _is_eligible THEN
    IF _status != 'suspended' THEN
      _status := 'non_compliant';
    END IF;
  ELSIF _has_expiring THEN
    _status := 'expiring_soon';
  ELSE
    _status := 'compliant';
  END IF;

  -- Upsert eligibility status
  INSERT INTO public.staff_eligibility_status (
    organisation_id, staff_id, is_eligible_for_assignment,
    eligibility_status, reason_summary, last_evaluated_at, evaluated_by_system
  ) VALUES (
    _org_id, _staff_id, _is_eligible,
    _status, array_to_string(_reasons, '; '), now(), true
  )
  ON CONFLICT (staff_id) DO UPDATE SET
    is_eligible_for_assignment = EXCLUDED.is_eligible_for_assignment,
    eligibility_status = EXCLUDED.eligibility_status,
    reason_summary = EXCLUDED.reason_summary,
    last_evaluated_at = EXCLUDED.last_evaluated_at,
    evaluated_by_system = EXCLUDED.evaluated_by_system,
    updated_at = now();

  RETURN jsonb_build_object(
    'staff_id', _staff_id,
    'is_eligible', _is_eligible,
    'eligibility_status', _status::text,
    'reasons', _reasons
  );
END;
$$;

-- 9. Seed NDIS training requirements for DGTG
INSERT INTO public.training_requirements (organisation_id, training_code, training_name, description, is_mandatory, validity_months, min_pass_score, required_for_roles) VALUES
  ('607ad2d2-6cb9-48c6-a0d0-8082a904adf1', 'NDIS_ORIENTATION', 'NDIS Worker Orientation Module', 'National NDIS orientation covering rights, obligations and quality standards.', true, NULL, 80, '[]'::jsonb),
  ('607ad2d2-6cb9-48c6-a0d0-8082a904adf1', 'CODE_OF_CONDUCT', 'NDIS Code of Conduct Training', 'Understanding and commitment to the NDIS Code of Conduct.', true, 12, 0, '[]'::jsonb),
  ('607ad2d2-6cb9-48c6-a0d0-8082a904adf1', 'SAFEGUARDING', 'Safeguarding Training', 'Identifying, reporting, and responding to abuse, neglect, and exploitation.', true, 12, 80, '[]'::jsonb),
  ('607ad2d2-6cb9-48c6-a0d0-8082a904adf1', 'INCIDENT_MGMT', 'Incident Management Training', 'Procedures for reporting, escalating, and managing incidents.', true, 12, 75, '[]'::jsonb),
  ('607ad2d2-6cb9-48c6-a0d0-8082a904adf1', 'PRIVACY_DATA', 'Privacy & Data Handling Training', 'Obligations under the Privacy Act, data handling, and breach reporting.', true, 12, 80, '[]'::jsonb),
  ('607ad2d2-6cb9-48c6-a0d0-8082a904adf1', 'CYBER_SAFETY', 'Cyber Safety & Digital Security', 'Phishing, password management, device security, and social engineering.', true, 12, 70, '[]'::jsonb),
  ('607ad2d2-6cb9-48c6-a0d0-8082a904adf1', 'INTERNAL_SYSTEMS', 'Internal Systems Training', 'Guardian Guard platform usage, audit logging, and compliance workflows.', true, NULL, 0, '[]'::jsonb),
  ('607ad2d2-6cb9-48c6-a0d0-8082a904adf1', 'ADVANCED_SAFEGUARDING', 'Advanced Safeguarding & Risk Assessment', 'Advanced safeguarding for supervisors and trainers.', true, 12, 85, '["supervisor","trainer"]'::jsonb)
ON CONFLICT (organisation_id, training_code) DO NOTHING;
