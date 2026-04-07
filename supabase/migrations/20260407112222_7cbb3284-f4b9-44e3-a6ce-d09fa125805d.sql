
-- =============================================
-- STAFF COMPLIANCE ENFORCEMENT ENGINE
-- =============================================

-- Enum types
DO $$ BEGIN
  CREATE TYPE public.compliance_record_status AS ENUM (
    'missing', 'pending_review', 'verified', 'expiring_soon', 'expired', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.eligibility_status AS ENUM (
    'compliant', 'expiring_soon', 'non_compliant', 'suspended'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.conduct_source_type AS ENUM (
    'incident', 'complaint', 'manual_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- TABLE: staff_compliance_requirements
-- =============================================
CREATE TABLE IF NOT EXISTS public.staff_compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  role_name text NOT NULL,
  requirement_code text NOT NULL,
  requirement_name text NOT NULL,
  description text,
  is_mandatory boolean NOT NULL DEFAULT true,
  expiry_required boolean NOT NULL DEFAULT false,
  validity_months integer,
  applies_to_roles jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organisation_id, role_name, requirement_code)
);

ALTER TABLE public.staff_compliance_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage requirements"
ON public.staff_compliance_requirements FOR ALL TO authenticated
USING (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'hr_admin'::app_role]))
WITH CHECK (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'hr_admin'::app_role]));

CREATE POLICY "Staff view requirements"
ON public.staff_compliance_requirements FOR SELECT TO authenticated
USING (organisation_id = get_user_organisation_id(auth.uid()));

CREATE TRIGGER update_staff_requirements_updated_at
BEFORE UPDATE ON public.staff_compliance_requirements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- TABLE: staff_compliance_records
-- =============================================
CREATE TABLE IF NOT EXISTS public.staff_compliance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  staff_id uuid NOT NULL,
  requirement_code text NOT NULL,
  requirement_name text NOT NULL,
  status public.compliance_record_status NOT NULL DEFAULT 'missing',
  issue_date date,
  expiry_date date,
  verified_by uuid,
  verified_at timestamptz,
  rejection_reason text,
  uploaded_file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_compliance_records ENABLE ROW LEVEL SECURITY;

-- Admins/compliance/HR can manage all records in their org
CREATE POLICY "Admins manage compliance records"
ON public.staff_compliance_records FOR ALL TO authenticated
USING (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'hr_admin'::app_role]))
WITH CHECK (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'hr_admin'::app_role]));

-- Staff can view their own records
CREATE POLICY "Staff view own compliance records"
ON public.staff_compliance_records FOR SELECT TO authenticated
USING (staff_id = auth.uid());

-- Staff can upload (insert) their own records only as pending_review
CREATE POLICY "Staff upload own compliance records"
ON public.staff_compliance_records FOR INSERT TO authenticated
WITH CHECK (staff_id = auth.uid() AND organisation_id = get_user_organisation_id(auth.uid()) AND status = 'pending_review'::compliance_record_status);

-- Supervisors can view team records
CREATE POLICY "Supervisors view team compliance records"
ON public.staff_compliance_records FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role) AND EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = staff_compliance_records.staff_id AND up.team_id = get_user_team_id(auth.uid())
));

-- No DELETE allowed
CREATE TRIGGER update_staff_records_updated_at
BEFORE UPDATE ON public.staff_compliance_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Audit trail trigger
CREATE TRIGGER audit_staff_compliance_records
AFTER INSERT OR UPDATE ON public.staff_compliance_records
FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

-- =============================================
-- TABLE: staff_eligibility_status
-- =============================================
CREATE TABLE IF NOT EXISTS public.staff_eligibility_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  staff_id uuid NOT NULL UNIQUE,
  is_eligible_for_assignment boolean NOT NULL DEFAULT false,
  eligibility_status public.eligibility_status NOT NULL DEFAULT 'non_compliant',
  reason_summary text,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  evaluated_by_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_eligibility_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage eligibility"
ON public.staff_eligibility_status FOR ALL TO authenticated
USING (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'hr_admin'::app_role]))
WITH CHECK (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'hr_admin'::app_role]));

CREATE POLICY "Staff view own eligibility"
ON public.staff_eligibility_status FOR SELECT TO authenticated
USING (staff_id = auth.uid());

CREATE POLICY "Supervisors view team eligibility"
ON public.staff_eligibility_status FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role) AND EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = staff_eligibility_status.staff_id AND up.team_id = get_user_team_id(auth.uid())
));

CREATE TRIGGER update_staff_eligibility_updated_at
BEFORE UPDATE ON public.staff_eligibility_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- TABLE: staff_conduct_events
-- =============================================
CREATE TABLE IF NOT EXISTS public.staff_conduct_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  staff_id uuid NOT NULL,
  source_type public.conduct_source_type NOT NULL DEFAULT 'manual_review',
  source_record_id uuid,
  event_type text NOT NULL,
  description text,
  action_taken text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_conduct_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage conduct events"
ON public.staff_conduct_events FOR ALL TO authenticated
USING (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'hr_admin'::app_role]))
WITH CHECK (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'hr_admin'::app_role]));

CREATE POLICY "Staff view own conduct events"
ON public.staff_conduct_events FOR SELECT TO authenticated
USING (staff_id = auth.uid());

-- Audit trail
CREATE TRIGGER audit_staff_conduct_events
AFTER INSERT ON public.staff_conduct_events
FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

-- =============================================
-- FUNCTION: prevent_self_verification
-- Staff cannot verify their own compliance records
-- =============================================
CREATE OR REPLACE FUNCTION public.prevent_self_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verified_by IS NOT NULL AND NEW.verified_by = NEW.staff_id THEN
    RAISE EXCEPTION 'Staff members cannot verify their own compliance records. A different authorised reviewer is required.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_no_self_verification
BEFORE INSERT OR UPDATE ON public.staff_compliance_records
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_verification();

-- =============================================
-- FUNCTION: evaluate_staff_eligibility
-- Pure enforcement logic — called by automation
-- =============================================
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
BEGIN
  -- Get staff org and check if user exists
  SELECT organisation_id INTO _org_id FROM public.user_profiles WHERE id = _staff_id;
  IF _org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Staff not found');
  END IF;

  -- Get role
  SELECT role::text INTO _user_role FROM public.user_roles WHERE user_id = _staff_id LIMIT 1;
  _user_role := COALESCE(_user_role, 'support_worker');

  -- Check staff_compliance table for suspension
  SELECT
    CASE WHEN police_check_status = 'expired' OR wwcc_status = 'expired' OR worker_screening_status = 'expired' THEN 'suspended'
         ELSE 'active' END
  INTO _staff_status
  FROM public.staff_compliance WHERE user_id = _staff_id;

  -- If suspended in old system, block immediately
  IF _staff_status = 'suspended' THEN
    _is_eligible := false;
    _status := 'suspended';
    _reasons := array_append(_reasons, 'Staff has expired clearance in legacy compliance system');
  END IF;

  -- Check each mandatory requirement for this org
  FOR _req IN
    SELECT requirement_code, requirement_name, expiry_required
    FROM public.staff_compliance_requirements
    WHERE organisation_id = _org_id
      AND is_mandatory = true
      AND (applies_to_roles = '[]'::jsonb OR applies_to_roles @> to_jsonb(_user_role))
  LOOP
    -- Find the latest record for this requirement
    SELECT * INTO _rec
    FROM public.staff_compliance_records
    WHERE staff_id = _staff_id
      AND requirement_code = _req.requirement_code
      AND organisation_id = _org_id
    ORDER BY created_at DESC
    LIMIT 1;

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

-- =============================================
-- FUNCTION: check_staff_assignment_eligible
-- Called before assigning staff to participants
-- Raises exception if not eligible
-- =============================================
CREATE OR REPLACE FUNCTION public.check_staff_assignment_eligible(_staff_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _eligible boolean;
  _reason text;
BEGIN
  -- Re-evaluate first
  PERFORM public.evaluate_staff_eligibility(_staff_id);

  SELECT is_eligible_for_assignment, reason_summary
  INTO _eligible, _reason
  FROM public.staff_eligibility_status
  WHERE staff_id = _staff_id;

  IF _eligible IS NULL OR NOT _eligible THEN
    RAISE EXCEPTION 'Assignment blocked: Staff member is not eligible for participant assignment. Reason: %', COALESCE(_reason, 'No eligibility record found');
  END IF;

  RETURN true;
END;
$$;

-- =============================================
-- TRIGGER: Block participant assignment to non-eligible staff
-- =============================================
CREATE OR REPLACE FUNCTION public.enforce_staff_assignment_on_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_trainer_id IS NOT NULL AND
     (OLD.assigned_trainer_id IS DISTINCT FROM NEW.assigned_trainer_id) THEN
    PERFORM public.check_staff_assignment_eligible(NEW.assigned_trainer_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_participant_staff_assignment
BEFORE UPDATE ON public.participants
FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_assignment_on_participant();

-- =============================================
-- TRIGGER: Re-evaluate eligibility when compliance record changes
-- =============================================
CREATE OR REPLACE FUNCTION public.reevaluate_on_compliance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.evaluate_staff_eligibility(NEW.staff_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER reevaluate_eligibility_on_record_change
AFTER INSERT OR UPDATE ON public.staff_compliance_records
FOR EACH ROW EXECUTE FUNCTION public.reevaluate_on_compliance_change();

-- =============================================
-- TRIGGER: Prevent deletion of compliance records (append-only)
-- =============================================
CREATE TRIGGER prevent_compliance_record_deletion
BEFORE DELETE ON public.staff_compliance_records
FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

CREATE TRIGGER prevent_conduct_event_deletion
BEFORE DELETE ON public.staff_conduct_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

CREATE TRIGGER prevent_eligibility_deletion
BEFORE DELETE ON public.staff_eligibility_status
FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
