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
  _capa_open int; _wc_total int; _wc_ok int;
  _readiness numeric; _gov_score numeric; _env_score numeric; _ai_score numeric; _sup_score numeric; _wc_score numeric;
  _gov_num int; _gov_den int;
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

  SELECT count(*) INTO _capa_open FROM public.corrective_actions
   WHERE organisation_id = _org AND status NOT IN ('closed','verified','completed');

  SELECT count(*), count(*) FILTER (WHERE status = 'verified')
    INTO _wc_total, _wc_ok
    FROM public.staff_compliance_records
   WHERE organisation_id = _org;

  _readiness := CASE WHEN _req_total = 0 THEN NULL ELSE round((_req_ready::numeric / _req_total) * 100) END;

  _gov_den := _pol + _gov + _rg;
  _gov_num := (_pol - LEAST(_pol_due, _pol)) + _gov + _rg;
  _gov_score := CASE WHEN _gov_den = 0 THEN NULL ELSE round(_gov_num::numeric / _gov_den * 100) END;

  -- Absence of incidents/complaints is never evidence of compliance: only score when records exist.
  _sup_score := CASE WHEN (_inc_total + _cmp_total) = 0 THEN NULL
                     ELSE GREATEST(0, 100 - LEAST(_inc_open * 8, 40) - LEAST(_cmp_open * 10, 40)) END;
  _env_score := CASE WHEN _risk_total = 0 THEN NULL
                     ELSE GREATEST(0, 100 - LEAST(_risk_open * 8, 60)) END;
  _ai_score := CASE WHEN _ai_total = 0 THEN NULL ELSE round((_ai_reviewed::numeric / _ai_total) * 100) END;
  _wc_score := CASE WHEN _wc_total = 0 THEN NULL ELSE round((_wc_ok::numeric / _wc_total) * 100) END;

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
      'governance_meetings', _gov, 'registration_groups_confirmed', _rg,
      'corrective_actions_open', _capa_open,
      'worker_requirements', _wc_total, 'worker_requirements_verified', _wc_ok
    ),
    'evidence', jsonb_build_object(
      'total_applicable', _req_total, 'evidence_ready', _req_ready, 'review_overdue', _req_overdue,
      'missing', _req_missing, 'in_progress', _req_progress, 'ready_for_review', _req_review
    ),
    'scores', jsonb_build_object(
      'audit_readiness', jsonb_build_object('percentage', _readiness, 'numerator', _req_ready, 'denominator', _req_total),
      'governance', jsonb_build_object('percentage', _gov_score, 'numerator', _gov_num, 'denominator', _gov_den),
      'supports', jsonb_build_object('percentage', _sup_score, 'numerator', _inc_total + _cmp_total - _inc_open - _cmp_open, 'denominator', _inc_total + _cmp_total),
      'environment', jsonb_build_object('percentage', _env_score, 'numerator', _risk_total - _risk_open, 'denominator', _risk_total),
      'ai_oversight', jsonb_build_object('percentage', _ai_score, 'numerator', _ai_reviewed, 'denominator', _ai_total),
      'worker_compliance', jsonb_build_object('percentage', _wc_score, 'numerator', _wc_ok, 'denominator', _wc_total)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.org_compliance_snapshot(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.org_compliance_snapshot(boolean) TO authenticated;