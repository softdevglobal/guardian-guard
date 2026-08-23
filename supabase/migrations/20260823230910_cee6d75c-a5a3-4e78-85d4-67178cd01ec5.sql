-- 1. Requirement / module / policy engines must only consider CONFIRMED service selections.
CREATE OR REPLACE FUNCTION public.organisation_applicable_requirements(_org uuid)
RETURNS TABLE(requirement_type text, requirement_reference text, label text, required boolean, source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.requirement_type, r.requirement_reference, COALESCE(r.label, r.requirement_reference), r.required,
    COALESCE(st.name, bc.name)
  FROM public.compliance_requirement_rules r
  JOIN public.business_categories bc ON bc.id = r.business_category_id
  LEFT JOIN public.service_types st ON st.id = r.service_type_id
  WHERE r.active
    AND EXISTS (
      SELECT 1 FROM public.organisation_service_selections s
      WHERE s.organisation_id = _org AND NOT s.is_archived AND s.confirmed_at IS NOT NULL
        AND s.business_category_id = r.business_category_id
        AND (r.service_type_id IS NULL OR r.service_type_id = s.service_type_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.organisation_active_modules(_org uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mods text[] := ARRAY['dashboard','settings','staff','training','policies','incidents','complaints','risks','governance','audit','documents','onboarding'];
BEGIN
  SELECT mods || COALESCE(array_agg(DISTINCT m.requirement_reference), '{}')
    INTO mods
  FROM public.organisation_applicable_requirements(_org) m
  WHERE m.requirement_type = 'operational_module';

  IF EXISTS (SELECT 1 FROM public.organisation_service_selections s
             JOIN public.service_types st ON st.id = s.service_type_id
             WHERE s.organisation_id = _org AND NOT s.is_archived AND s.confirmed_at IS NOT NULL
               AND st.requires_participant_management) THEN
    mods := mods || ARRAY['participants'];
  END IF;
  IF EXISTS (SELECT 1 FROM public.organisation_service_selections s
             JOIN public.service_types st ON st.id = s.service_type_id
             WHERE s.organisation_id = _org AND NOT s.is_archived AND s.confirmed_at IS NOT NULL
               AND st.supports_geolocation) THEN
    mods := mods || ARRAY['service_operations','geolocation'];
  END IF;
  IF EXISTS (SELECT 1 FROM public.organisation_service_selections s
             JOIN public.service_types st ON st.id = s.service_type_id
             WHERE s.organisation_id = _org AND NOT s.is_archived AND s.confirmed_at IS NOT NULL
               AND st.requires_photos) THEN
    mods := mods || ARRAY['photo_evidence'];
  END IF;
  IF EXISTS (SELECT 1 FROM public.organisation_service_selections s
             JOIN public.service_types st ON st.id = s.service_type_id
             WHERE s.organisation_id = _org AND NOT s.is_archived AND s.confirmed_at IS NOT NULL
               AND st.requires_clinical_governance) THEN
    mods := mods || ARRAY['participant_care','competency'];
  END IF;
  RETURN ARRAY(SELECT DISTINCT unnest(mods));
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_org_policies(_org uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.organisations%ROWTYPE;
  t public.master_templates%ROWTYPE;
  svc text;
  created integer := 0;
  body text;
BEGIN
  IF _org IS NULL THEN RETURN 0; END IF;
  IF NOT (public.is_platform_admin(auth.uid()) OR _org = public.get_user_organisation_id(auth.uid())) THEN
    RAISE EXCEPTION 'Not permitted for this organisation';
  END IF;
  SELECT * INTO o FROM public.organisations WHERE id = _org;
  SELECT string_agg(DISTINCT st.name, ', ') INTO svc
  FROM public.organisation_service_selections s
  JOIN public.service_types st ON st.id = s.service_type_id
  WHERE s.organisation_id = _org AND NOT s.is_archived AND s.confirmed_at IS NOT NULL;

  FOR t IN
    SELECT mt.* FROM public.master_templates mt
    WHERE mt.active AND (
      EXISTS (
        SELECT 1 FROM public.organisation_service_selections s
        JOIN public.business_categories bc ON bc.id = s.business_category_id
        WHERE s.organisation_id = _org AND NOT s.is_archived AND s.confirmed_at IS NOT NULL
          AND bc.code = ANY (mt.business_category_codes)
      )
      OR EXISTS (
        SELECT 1 FROM public.organisation_service_selections s
        JOIN public.service_types st ON st.id = s.service_type_id
        WHERE s.organisation_id = _org AND NOT s.is_archived AND s.confirmed_at IS NOT NULL
          AND st.code = ANY (mt.service_type_codes)
      )
      OR (
        cardinality(mt.business_category_codes) = 0
        AND EXISTS (
          SELECT 1 FROM public.organisation_service_selections s
          WHERE s.organisation_id = _org AND NOT s.is_archived AND s.confirmed_at IS NOT NULL
        )
      ))
  LOOP
    IF EXISTS (SELECT 1 FROM public.policies p
                WHERE p.organisation_id = _org AND p.master_template_id = t.id
                  AND p.record_status = 'active') THEN
      CONTINUE;
    END IF;
    body := replace(replace(replace(replace(replace(replace(replace(
      COALESCE(t.body_template, ''),
      '{{legal_business_name}}', COALESCE(o.legal_name, o.name, '')),
      '{{trading_name}}', COALESCE(o.trading_name, o.name, '')),
      '{{abn}}', COALESCE(o.abn, '')),
      '{{address}}', COALESCE(concat_ws(', ', o.address_line1, o.suburb, o.state, o.postcode), '')),
      '{{contact_person}}', COALESCE(o.primary_contact_name, '')),
      '{{service_types}}', COALESCE(svc, '')),
      '{{emergency_contact}}', COALESCE(o.primary_contact_phone, ''));

    INSERT INTO public.policies (organisation_id, title, status, category, policy_text, owner_id,
                                 master_template_id, master_template_version, next_review_date)
    VALUES (_org, t.name, 'draft', t.requirement_type, body, auth.uid(), t.id, t.version,
            COALESCE(t.review_date, current_date + interval '12 months'));
    created := created + 1;
  END LOOP;
  RETURN created;
END;
$$;

-- 2. Idempotent reset of the affected tenant's automatic (never provider-confirmed) setup.
DO $reset$
DECLARE
  _org uuid := 'dc1d90a8-8695-4d76-926d-24d8f7c2f34d';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id = _org) THEN
    RETURN;
  END IF;

  -- Service selections: archived and un-confirmed (rows kept for history, never deleted).
  UPDATE public.organisation_service_selections
     SET is_archived = true, confirmed_at = NULL, confirmed_by = NULL
   WHERE organisation_id = _org
     AND (NOT is_archived OR confirmed_at IS NOT NULL OR confirmed_by IS NOT NULL);

  -- Onboarding back to an unanswered, in-progress state.
  UPDATE public.organisation_onboarding
     SET pathway_status = 'selection_required',
         ndis_funding_status = NULL,
         services_confirmed_at = NULL,
         status = CASE WHEN status IN ('approved','waived') THEN status ELSE 'in_progress' END
   WHERE organisation_id = _org
     AND (pathway_status <> 'selection_required'
          OR ndis_funding_status IS NOT NULL
          OR services_confirmed_at IS NOT NULL);

  -- Registration groups derived from the incorrect selections: un-confirm only (no deletion).
  UPDATE public.registration_groups
     SET is_confirmed = false
   WHERE organisation_id = _org AND is_confirmed;

  -- Evidence requirements derived from the old scope become not applicable (history preserved).
  UPDATE public.evidence_requirements
     SET status = 'not_applicable', updated_at = now()
   WHERE organisation_id = _org AND status <> 'not_applicable';

  -- Auto-generated, untouched draft policies from the incorrect selections are archived (never
  -- deleted) so the provider's real confirmation regenerates the correct set.
  UPDATE public.policies p
     SET record_status = 'archived', updated_at = now()
   WHERE p.organisation_id = _org
     AND p.master_template_id IS NOT NULL
     AND p.status = 'draft'
     AND p.record_status = 'active'
     AND p.approved_at IS NULL
     AND p.published_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.policy_versions v WHERE v.policy_id = p.id)
     AND NOT EXISTS (SELECT 1 FROM public.policy_acknowledgements a WHERE a.policy_id = p.id);
END
$reset$;