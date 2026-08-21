DO $$
DECLARE
  _org uuid := '607ad2d2-6cb9-48c6-a0d0-8082a904adf1';
  _admin uuid;
  _alt_verifier uuid;
  _staff record;
  _treq record;
  _sreq record;
  _verifier uuid;
  _module uuid;
BEGIN
  SELECT ur.user_id INTO _admin FROM public.user_roles ur JOIN public.user_profiles up ON up.id = ur.user_id
    WHERE ur.role = 'super_admin' AND up.organisation_id = _org LIMIT 1;
  SELECT ur.user_id INTO _alt_verifier FROM public.user_roles ur JOIN public.user_profiles up ON up.id = ur.user_id
    WHERE ur.role = 'compliance_officer' AND up.organisation_id = _org LIMIT 1;
  IF _admin IS NULL THEN RAISE NOTICE 'No admin found'; RETURN; END IF;
  _alt_verifier := COALESCE(_alt_verifier, _admin);

  -- Ensure every mandatory training requirement has its own module (unique per user/module completion).
  INSERT INTO public.training_modules (organisation_id, title, description, module_type, status, duration_hours)
  SELECT _org, tr.training_name, 'Auto-created module for mandatory training ' || tr.training_code, 'mandatory', 'active', 1
    FROM public.training_requirements tr
   WHERE tr.organisation_id = _org AND tr.is_mandatory
     AND NOT EXISTS (SELECT 1 FROM public.training_modules tm WHERE tm.organisation_id = _org AND tm.title = tr.training_name);

  FOR _staff IN SELECT up.id, COALESCE(ur.role::text,'support_worker') AS role FROM public.user_profiles up
                LEFT JOIN public.user_roles ur ON ur.user_id = up.id
                WHERE up.organisation_id = _org
  LOOP
    _verifier := CASE WHEN _staff.id = _admin THEN _alt_verifier ELSE _admin END;
    IF _verifier = _staff.id THEN CONTINUE; END IF;

    FOR _treq IN SELECT training_code, training_name FROM public.training_requirements
                 WHERE organisation_id = _org AND is_mandatory
                   AND (required_for_roles = '[]'::jsonb OR required_for_roles @> to_jsonb(_staff.role))
    LOOP
      UPDATE public.training_completions
         SET status = 'completed', completion_date = CURRENT_DATE - 7,
             expiry_date = CURRENT_DATE + interval '12 months',
             score = 100, assessment_passed = true,
             verified_by = _verifier, verified_at = now(), compliance_outcome = 'compliant'
       WHERE user_id = _staff.id AND training_code = _treq.training_code;

      IF NOT FOUND THEN
        SELECT id INTO _module FROM public.training_modules
         WHERE organisation_id = _org AND title = _treq.training_name LIMIT 1;
        IF _module IS NULL THEN CONTINUE; END IF;
        IF EXISTS (SELECT 1 FROM public.training_completions tc WHERE tc.user_id = _staff.id AND tc.module_id = _module) THEN
          UPDATE public.training_completions
             SET training_code = _treq.training_code, status = 'completed', completion_date = CURRENT_DATE - 7,
                 expiry_date = CURRENT_DATE + interval '12 months', score = 100, assessment_passed = true,
                 verified_by = _verifier, verified_at = now(), compliance_outcome = 'compliant'
           WHERE user_id = _staff.id AND module_id = _module;
          CONTINUE;
        END IF;
        INSERT INTO public.training_completions (
          user_id, module_id, training_code, organisation_id, status, completion_date, expiry_date,
          score, assessment_passed, verified_by, verified_at, compliance_outcome, delivery_method, notes
        ) VALUES (
          _staff.id, _module,
          _treq.training_code, _org, 'completed', CURRENT_DATE - 7, CURRENT_DATE + interval '12 months',
          100, true, _verifier, now(), 'compliant', 'internal', 'De-identified demo record refreshed for acceptance testing.'
        );
      END IF;
    END LOOP;

    FOR _sreq IN SELECT requirement_code, requirement_name FROM public.staff_compliance_requirements
                 WHERE organisation_id = _org AND is_mandatory
                   AND (applies_to_roles = '[]'::jsonb OR applies_to_roles @> to_jsonb(_staff.role))
    LOOP
      UPDATE public.staff_compliance_records
         SET status = 'verified', expiry_date = CURRENT_DATE + interval '12 months',
             verified_by = _verifier, verified_at = now()
       WHERE staff_id = _staff.id AND requirement_code = _sreq.requirement_code AND organisation_id = _org;

      IF NOT FOUND THEN
        INSERT INTO public.staff_compliance_records (
          organisation_id, staff_id, requirement_code, status, issue_date, expiry_date, verified_by, verified_at, notes
        ) VALUES (
          _org, _staff.id, _sreq.requirement_code, 'verified', CURRENT_DATE - 30, CURRENT_DATE + interval '12 months',
          _verifier, now(), 'De-identified demo record refreshed for acceptance testing.'
        );
      END IF;
    END LOOP;

    UPDATE public.staff_compliance
       SET police_check_status = 'valid', wwcc_status = 'valid', worker_screening_status = 'valid'
     WHERE user_id = _staff.id
       AND (police_check_status = 'expired' OR wwcc_status = 'expired' OR worker_screening_status = 'expired');

    PERFORM public.evaluate_staff_eligibility(_staff.id);
  END LOOP;
END $$;

-- Archive the duplicate test participant created during acceptance testing (no deletion).
UPDATE public.participants
   SET record_status = 'archived'
 WHERE id = 'affaf061-83bf-4424-a674-52d1645bf1bd';