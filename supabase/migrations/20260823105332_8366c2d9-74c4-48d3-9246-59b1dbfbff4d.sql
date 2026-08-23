-- =========================================================
-- 1. ROLE MODEL: tenant_admin carries super_admin authority WITHIN its own organisation
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (ur.role = _role OR (_role = 'super_admin'::app_role AND ur.role = 'tenant_admin'::app_role))
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (ur.role = ANY(_roles)
           OR ('super_admin'::app_role = ANY(_roles) AND ur.role = 'tenant_admin'::app_role))
  )
$$;

-- =========================================================
-- 2. TENANT ISOLATION: organisation record editing is org-scoped
-- =========================================================
DROP POLICY IF EXISTS "Super admins can manage organisations" ON public.organisations;

CREATE POLICY "Org admins update their own organisation"
  ON public.organisations FOR UPDATE TO authenticated
  USING (id = public.get_user_organisation_id(auth.uid()) AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (id = public.get_user_organisation_id(auth.uid()) AND public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- 3. EVIDENCE REQUIREMENT GENERATION FROM CONFIRMED SCOPE
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_evidence_requirements(_org uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted integer := 0;
BEGIN
  IF _org IS NULL THEN
    RETURN 0;
  END IF;

  -- newly applicable requirements start as missing
  WITH scope AS (
    SELECT po.*
    FROM public.practice_outcomes po
    WHERE EXISTS (
      SELECT 1 FROM public.registration_groups rg
      WHERE rg.organisation_id = _org
        AND rg.is_confirmed
        AND rg.record_status = 'active'
        AND rg.code = ANY(po.registration_groups)
    )
  ), ins AS (
    INSERT INTO public.evidence_requirements
      (organisation_id, outcome_code, requirement_title, quality_indicator,
       required_evidence_type, module_code, status, requires_human_review)
    SELECT _org, s.outcome_code, s.outcome_code || ' ' || s.outcome_name, s.part_name,
           'Policy + operational records', s.module_code, 'missing', true
    FROM scope s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.evidence_requirements er
      WHERE er.organisation_id = _org AND er.outcome_code = s.outcome_code
    )
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;

  -- requirements outside the confirmed scope become not_applicable (history preserved)
  UPDATE public.evidence_requirements er
     SET status = 'not_applicable', updated_at = now()
   WHERE er.organisation_id = _org
     AND er.status <> 'not_applicable'
     AND NOT EXISTS (
       SELECT 1 FROM public.practice_outcomes po
       JOIN public.registration_groups rg
         ON rg.organisation_id = _org AND rg.is_confirmed AND rg.record_status = 'active'
        AND rg.code = ANY(po.registration_groups)
       WHERE po.outcome_code = er.outcome_code
     );

  -- requirements that came back into scope revert to missing unless evidence already exists
  UPDATE public.evidence_requirements er
     SET status = 'missing', updated_at = now()
   WHERE er.organisation_id = _org
     AND er.status = 'not_applicable'
     AND EXISTS (
       SELECT 1 FROM public.practice_outcomes po
       JOIN public.registration_groups rg
         ON rg.organisation_id = _org AND rg.is_confirmed AND rg.record_status = 'active'
        AND rg.code = ANY(po.registration_groups)
       WHERE po.outcome_code = er.outcome_code
     );

  RETURN _inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_evidence_requirements(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_evidence_requirements(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_evidence_on_registration_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.generate_evidence_requirements(COALESCE(NEW.organisation_id, OLD.organisation_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registration_group_scope ON public.registration_groups;
CREATE TRIGGER trg_registration_group_scope
AFTER INSERT OR UPDATE OF is_confirmed, record_status ON public.registration_groups
FOR EACH ROW EXECUTE FUNCTION public.sync_evidence_on_registration_scope();

-- =========================================================
-- 4. ONBOARDING STATE MACHINE
-- =========================================================
UPDATE public.organisation_onboarding SET status = 'changes_requested' WHERE status = 'returned';

UPDATE public.organisation_onboarding o
   SET pathway_id = (SELECT p.id FROM public.provider_pathways p ORDER BY p.created_at LIMIT 1)
 WHERE o.pathway_id IS NULL;

ALTER TABLE public.organisation_onboarding DROP CONSTRAINT IF EXISTS organisation_onboarding_status_check;
ALTER TABLE public.organisation_onboarding
  ADD CONSTRAINT organisation_onboarding_status_check
  CHECK (status IN ('not_started','in_progress','ready_for_review','submitted','changes_requested','approved','waived'));

-- correct invalid submissions (submitted below 100%) — record, never delete
WITH corrected AS (
  UPDATE public.organisation_onboarding o
     SET status = 'changes_requested',
         returned_reason = COALESCE(o.returned_reason || ' | ', '') ||
           'System correction: this pack was submitted before mandatory setup reached 100%. Complete the outstanding items and resubmit.',
         updated_at = now()
   WHERE o.status = 'submitted' AND COALESCE(o.progress_pct, 0) < 100
  RETURNING o.id, o.organisation_id, o.progress_pct
)
INSERT INTO public.audit_logs (organisation_id, user_name, action, module, record_id, severity, details)
SELECT c.organisation_id, 'system', 'onboarding_submission_corrected', 'onboarding', c.id, 'elevated',
       jsonb_build_object('reason', 'submitted below 100% mandatory completion', 'progress_pct', c.progress_pct)
FROM corrected c;

-- =========================================================
-- 5. SINGLE ORGANISATION-SCOPED FIGURES / SCORING SERVICE
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_test_title(_title text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(_title, '') ILIKE 'GG SYSTEM TEST%' OR COALESCE(_title, '') ILIKE '[MOCK AUDIT DATA]%'
$$;

CREATE OR REPLACE FUNCTION public.org_compliance_snapshot(_include_test boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid := public.get_user_organisation_id(auth.uid());
  _inc_open int; _inc_total int; _cmp_open int; _cmp_total int;
  _risk_open int; _risk_total int; _pol int; _pol_due int;
  _part int; _staff int; _gov int; _rg int;
  _req_total int; _req_ready int; _req_overdue int; _req_missing int; _req_progress int; _req_review int;
  _ai_total int; _ai_reviewed int;
  _readiness numeric; _gov_score numeric; _env_score numeric; _ai_score numeric; _sup_score numeric;
BEGIN
  IF _org IS NULL THEN
    RETURN jsonb_build_object('organisation_id', NULL, 'calculated_at', now());
  END IF;

  SELECT count(*) FILTER (WHERE status <> 'closed'), count(*)
    INTO _inc_open, _inc_total
    FROM public.incidents
   WHERE organisation_id = _org AND record_status = 'active'
     AND (_include_test OR NOT public.is_test_title(title));

  SELECT count(*) FILTER (WHERE status NOT IN ('resolved','closed')), count(*)
    INTO _cmp_open, _cmp_total
    FROM public.complaints
   WHERE organisation_id = _org AND record_status = 'active'
     AND (_include_test OR NOT public.is_test_title(subject));

  SELECT count(*) FILTER (WHERE status <> 'closed'), count(*)
    INTO _risk_open, _risk_total
    FROM public.risks
   WHERE organisation_id = _org AND record_status = 'active'
     AND (_include_test OR NOT public.is_test_title(title));

  SELECT count(*), count(*) FILTER (WHERE next_review_date IS NOT NULL AND next_review_date <= current_date + 30)
    INTO _pol, _pol_due
    FROM public.policies
   WHERE organisation_id = _org AND record_status = 'active' AND status <> 'archived'
     AND (_include_test OR NOT public.is_test_title(title));

  SELECT count(*) INTO _part FROM public.participants
   WHERE organisation_id = _org AND record_status = 'active';

  SELECT count(*) INTO _staff FROM public.user_profiles WHERE organisation_id = _org;

  SELECT count(*) INTO _gov FROM public.governance_meetings WHERE organisation_id = _org;

  SELECT count(*) INTO _rg FROM public.registration_groups
   WHERE organisation_id = _org AND is_confirmed AND record_status = 'active';

  SELECT count(*),
         count(*) FILTER (WHERE status = 'ready' AND (review_date IS NULL OR review_date >= current_date)),
         count(*) FILTER (WHERE review_date IS NOT NULL AND review_date < current_date),
         count(*) FILTER (WHERE status = 'missing'),
         count(*) FILTER (WHERE status = 'in_progress'),
         count(*) FILTER (WHERE status = 'ready_for_review')
    INTO _req_total, _req_ready, _req_overdue, _req_missing, _req_progress, _req_review
    FROM public.evidence_requirements
   WHERE organisation_id = _org AND record_status = 'active' AND status <> 'not_applicable';

  SELECT count(*), count(*) FILTER (WHERE reviewed_at IS NOT NULL)
    INTO _ai_total, _ai_reviewed
    FROM public.ai_activity_logs WHERE organisation_id = _org;

  _readiness := CASE WHEN _req_total = 0 THEN NULL ELSE round((_req_ready::numeric / _req_total) * 100) END;
  _gov_score := CASE WHEN (_pol + _gov + _rg) = 0 THEN NULL
                     ELSE round(((_pol - LEAST(_pol_due, _pol))::numeric + _gov + _rg) / (_pol + _gov + _rg) * 100) END;
  _sup_score := CASE WHEN (_part + _inc_total + _cmp_total) = 0 THEN NULL
                     ELSE GREATEST(0, 100 - LEAST(_inc_open * 8, 40) - LEAST(_cmp_open * 10, 40)) END;
  _env_score := CASE WHEN (_part + _risk_total) = 0 THEN NULL
                     ELSE GREATEST(0, 100 - LEAST(_risk_open * 8, 60)) END;
  _ai_score := CASE WHEN _ai_total = 0 THEN NULL ELSE round((_ai_reviewed::numeric / _ai_total) * 100) END;

  RETURN jsonb_build_object(
    'organisation_id', _org,
    'calculated_at', now(),
    'include_test_records', _include_test,
    'counts', jsonb_build_object(
      'incidents_open', _inc_open, 'incidents_total', _inc_total,
      'complaints_open', _cmp_open, 'complaints_total', _cmp_total,
      'risks_open', _risk_open, 'risks_total', _risk_total,
      'policies', _pol, 'policies_due', _pol_due,
      'participants', _part, 'staff', _staff,
      'governance_meetings', _gov, 'registration_groups_confirmed', _rg
    ),
    'evidence', jsonb_build_object(
      'total_applicable', _req_total, 'evidence_ready', _req_ready, 'review_overdue', _req_overdue,
      'missing', _req_missing, 'in_progress', _req_progress, 'ready_for_review', _req_review
    ),
    'scores', jsonb_build_object(
      'audit_readiness', jsonb_build_object('percentage', _readiness, 'numerator', _req_ready, 'denominator', _req_total),
      'governance', jsonb_build_object('percentage', _gov_score, 'numerator', _pol + _gov + _rg, 'denominator', _pol + _gov + _rg),
      'supports', jsonb_build_object('percentage', _sup_score, 'numerator', _inc_total + _cmp_total - _inc_open - _cmp_open, 'denominator', _inc_total + _cmp_total),
      'environment', jsonb_build_object('percentage', _env_score, 'numerator', _risk_total - _risk_open, 'denominator', _risk_total),
      'ai_oversight', jsonb_build_object('percentage', _ai_score, 'numerator', _ai_reviewed, 'denominator', _ai_total)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.org_compliance_snapshot(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.org_compliance_snapshot(boolean) TO authenticated;