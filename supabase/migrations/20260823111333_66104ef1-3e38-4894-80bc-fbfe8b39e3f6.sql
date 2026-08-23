
-- ===== master templates =====
INSERT INTO public.master_templates (code, name, requirement_type, business_category_codes, service_type_codes, body_template) VALUES
 ('pol_governance','Governance and operational management policy','policy','{}','{}','{{legal_business_name}} (trading as {{trading_name}}, ABN {{abn}}) maintains governance arrangements for the services it delivers: {{service_types}}.'),
 ('pol_privacy','Privacy and information management policy','policy','{}','{}','{{legal_business_name}} protects personal information collected at {{address}}. Contact: {{contact_person}}.'),
 ('pol_incident','Incident management policy','policy','{}','{}','{{legal_business_name}} identifies, reports and reviews incidents. Emergency contact: {{emergency_contact}}.'),
 ('pol_complaints','Complaints and feedback policy','policy','{}','{}','{{legal_business_name}} receives and resolves complaints. Contact: {{contact_person}}.'),
 ('pol_risk','Risk management policy','policy','{}','{}','{{legal_business_name}} identifies and controls risks across {{service_types}}.'),
 ('pol_hr','Human resources policy','policy','{}','{}','{{legal_business_name}} recruits, screens and supervises workers.'),
 ('pol_emergency','Emergency and disaster management policy','policy','{}','{}','{{legal_business_name}} emergency contact: {{emergency_contact}}.'),
 ('pol_continuity','Business continuity policy','policy','{}','{}','{{legal_business_name}} maintains continuity of services: {{service_types}}.'),
 ('pol_information','Information management policy','policy','{}','{}','{{legal_business_name}} manages records and retention.'),
 ('pol_cleaning_ops','Cleaning operations policy','policy','{household_cleaning,infection_control_cleaning}','{}','{{legal_business_name}} cleaning operating procedures.'),
 ('pol_chemical_sds','Chemical safety and SDS policy','policy','{household_cleaning,infection_control_cleaning,waste_management}','{}','{{legal_business_name}} chemical handling and SDS register.'),
 ('pol_infection_control','Infection prevention and control policy','policy','{infection_control_cleaning,nursing_high_intensity,household_cleaning}','{}','{{legal_business_name}} infection prevention and control procedures.'),
 ('pol_ppe','PPE policy','policy','{infection_control_cleaning,waste_management,nursing_high_intensity}','{}','{{legal_business_name}} PPE selection, use and competency.'),
 ('pol_participant_property','Participant property and keys policy','policy','{household_cleaning,handyman_property_maintenance}','{}','{{legal_business_name}} handling of participant property and keys.'),
 ('pol_whs','Work health and safety policy','policy','{electrical_contractor,plumbing_contractor,building_contractor,handyman_property_maintenance,home_modifications,vehicle_modifications}','{}','{{legal_business_name}} WHS arrangements.'),
 ('pol_swms','SWMS / JSA policy','policy','{electrical_contractor,plumbing_contractor,building_contractor,home_modifications}','{}','{{legal_business_name}} safe work method statements.'),
 ('pol_tools_equipment','Tools and equipment policy','policy','{electrical_contractor,plumbing_contractor,building_contractor,handyman_property_maintenance,vehicle_modifications}','{}','{{legal_business_name}} tool and test equipment control.'),
 ('pol_trade_compliance','Trade compliance certificates policy','policy','{electrical_contractor,plumbing_contractor,building_contractor,home_modifications}','{}','{{legal_business_name}} compliance certification process.'),
 ('pol_site_safety','Site safety policy','policy','{electrical_contractor,plumbing_contractor,building_contractor,home_modifications}','{}','{{legal_business_name}} site safety arrangements.'),
 ('pol_defect_rectification','Defect and rectification policy','policy','{building_contractor,home_modifications,handyman_property_maintenance,vehicle_modifications}','{}','{{legal_business_name}} defect handling and rectification.'),
 ('pol_vehicle_safety','Vehicle safety policy','policy','{transport_provider}','{}','{{legal_business_name}} vehicle safety and maintenance.'),
 ('pol_driver_eligibility','Driver eligibility policy','policy','{transport_provider}','{}','{{legal_business_name}} driver licensing and eligibility checks.'),
 ('pol_journey_management','Journey management policy','policy','{transport_provider}','{}','{{legal_business_name}} journey planning and logs.'),
 ('pol_breakdown_emergency','Breakdown and roadside emergency policy','policy','{transport_provider}','{}','{{legal_business_name}} breakdown response. Emergency contact: {{emergency_contact}}.'),
 ('pol_clinical_governance','Clinical governance policy','policy','{allied_health,nursing_high_intensity}','{}','{{legal_business_name}} clinical governance framework.'),
 ('pol_medication','Medication management policy','policy','{nursing_high_intensity}','{medication_support}','{{legal_business_name}} medication management.'),
 ('pol_high_intensity','High-intensity support procedures policy','policy','{nursing_high_intensity}','{}','{{legal_business_name}} individual high-intensity procedures.'),
 ('pol_clinical_escalation','Clinical escalation policy','policy','{allied_health,nursing_high_intensity}','{}','{{legal_business_name}} clinical escalation pathways.'),
 ('pol_competency','Worker competency assessment policy','policy','{allied_health,nursing_high_intensity,infection_control_cleaning}','{}','{{legal_business_name}} competency assessment.'),
 ('pol_sil','SIL service delivery policy','policy','{supported_independent_living}','{}','{{legal_business_name}} supported independent living arrangements.'),
 ('pol_waste','Waste handling and disposal policy','policy','{waste_management,infection_control_cleaning}','{}','{{legal_business_name}} waste segregation, storage and disposal.'),
 ('pol_supported_decision','Supported decision-making and dignity of risk policy','policy','{life_skills_support,community_access,supported_independent_living}','{}','{{legal_business_name}} supported decision making.')
ON CONFLICT (code) DO NOTHING;

-- ===== requirement rules (category level) =====
INSERT INTO public.compliance_requirement_rules (business_category_id, requirement_type, requirement_reference, label, required)
SELECT bc.id, v.rtype, v.ref, v.label, true
FROM (VALUES
 ('household_cleaning','insurance','public_liability','Public liability insurance'),
 ('household_cleaning','insurance','workers_compensation','Workers compensation'),
 ('household_cleaning','training','chemical_safety_sds','Chemical safety and SDS training'),
 ('household_cleaning','training','manual_handling','Manual handling training'),
 ('household_cleaning','training','infection_control_basic','Basic infection control training'),
 ('household_cleaning','task_template','cleaning_tasks','Cleaning task templates'),
 ('household_cleaning','evidence','before_after_photos','Before / after photo evidence'),
 ('household_cleaning','operational_module','safe_environment','Safe environment'),
 ('household_cleaning','operational_module','service_operations','Service operations'),
 ('infection_control_cleaning','training','infection_prevention_control','Infection prevention and control training'),
 ('infection_control_cleaning','training','ppe_competency','PPE competency'),
 ('infection_control_cleaning','policy','pol_infection_control','Infection control policy'),
 ('infection_control_cleaning','evidence','sds_register','SDS register'),
 ('infection_control_cleaning','evidence','waste_contractor_evidence','Licensed waste contractor evidence'),
 ('infection_control_cleaning','risk_template','exposure_incident','Exposure incident risk template'),
 ('infection_control_cleaning','operational_module','safe_environment','Safe environment'),
 ('infection_control_cleaning','operational_module','waste_register','Waste register'),
 ('waste_management','licence','waste_transport_licence','Waste transport licence'),
 ('waste_management','operational_module','waste_register','Waste register'),
 ('waste_management','operational_module','safe_environment','Safe environment'),
 ('electrical_contractor','licence','electrical_contractor_licence','Electrical contractor licence'),
 ('electrical_contractor','licence','individual_electrical_licence','Individual electrical licences'),
 ('electrical_contractor','insurance','public_liability','Public liability insurance'),
 ('electrical_contractor','insurance','workers_compensation','Workers compensation'),
 ('electrical_contractor','evidence','swms_jsa','SWMS / JSA'),
 ('electrical_contractor','evidence','electrical_compliance_certificate','Electrical compliance certificate'),
 ('electrical_contractor','evidence','test_equipment_register','Test equipment register'),
 ('electrical_contractor','policy','pol_swms','Isolation and lockout procedure'),
 ('electrical_contractor','operational_module','trade_compliance','Trade compliance'),
 ('plumbing_contractor','licence','plumbing_licence','Plumbing registration / licence'),
 ('plumbing_contractor','insurance','public_liability','Public liability insurance'),
 ('plumbing_contractor','insurance','workers_compensation','Workers compensation'),
 ('plumbing_contractor','evidence','swms_jsa','SWMS / JSA'),
 ('plumbing_contractor','evidence','plumbing_compliance_certificate','Plumbing compliance certificate'),
 ('plumbing_contractor','operational_module','trade_compliance','Trade compliance'),
 ('building_contractor','licence','builder_licence','Builder licence'),
 ('building_contractor','insurance','public_liability','Public liability insurance'),
 ('building_contractor','operational_module','trade_compliance','Trade compliance'),
 ('handyman_property_maintenance','insurance','public_liability','Public liability insurance'),
 ('handyman_property_maintenance','operational_module','service_operations','Service operations'),
 ('home_modifications','licence','building_trade_licence','Relevant trade / building licence'),
 ('home_modifications','insurance','professional_indemnity','Professional indemnity (where design provided)'),
 ('home_modifications','evidence','site_risk_assessment','Site risk assessment'),
 ('home_modifications','evidence','participant_consultation','Participant consultation record'),
 ('home_modifications','evidence','scope_quote_approval','Scope and quote approval'),
 ('home_modifications','evidence','before_after_photos','Before / after evidence'),
 ('home_modifications','evidence','handover_acceptance','Handover and participant acceptance'),
 ('home_modifications','operational_module','trade_compliance','Trade compliance'),
 ('vehicle_modifications','licence','vehicle_modification_certification','Vehicle modification certification'),
 ('vehicle_modifications','evidence','installer_competency','Installer competency'),
 ('vehicle_modifications','evidence','inspection_testing','Inspection and testing record'),
 ('vehicle_modifications','evidence','ot_specification','Participant / OT specification'),
 ('vehicle_modifications','evidence','handover_safe_use_training','Handover and safe-use training'),
 ('vehicle_modifications','evidence','warranty_maintenance','Warranty and maintenance records'),
 ('vehicle_modifications','operational_module','trade_compliance','Trade compliance'),
 ('transport_provider','licence','driver_licence','Driver licence'),
 ('transport_provider','licence','vehicle_registration','Vehicle registration'),
 ('transport_provider','insurance','vehicle_insurance','Vehicle insurance'),
 ('transport_provider','evidence','roadworthiness','Roadworthiness certificate'),
 ('transport_provider','evidence','journey_logs','Journey logs'),
 ('transport_provider','evidence','vehicle_inspection_checklist','Vehicle inspection checklist'),
 ('transport_provider','screening','worker_screening','Worker screening check'),
 ('transport_provider','operational_module','service_operations','Service operations'),
 ('community_access','evidence','participant_consent','Participant consent'),
 ('community_access','evidence','support_plan','Support plan'),
 ('community_access','risk_template','community_risk_assessment','Community risk assessment'),
 ('community_access','operational_module','participants','Participants'),
 ('community_access','operational_module','participant_care','Participant care'),
 ('life_skills_support','evidence','participant_goals','Participant goals and outcome reviews'),
 ('life_skills_support','policy','pol_supported_decision','Supported decision-making'),
 ('life_skills_support','operational_module','participants','Participants'),
 ('supported_independent_living','registration_group','sil','SIL registration group'),
 ('supported_independent_living','evidence','service_agreement','Service agreement'),
 ('supported_independent_living','evidence','house_risk_assessment','House risk assessment'),
 ('supported_independent_living','evidence','continuity_plan','Continuity plan'),
 ('supported_independent_living','operational_module','sil','SIL'),
 ('supported_independent_living','operational_module','participants','Participants'),
 ('allied_health','licence','professional_registration','Professional registration'),
 ('allied_health','insurance','professional_indemnity','Professional indemnity'),
 ('allied_health','policy','pol_clinical_governance','Clinical governance'),
 ('allied_health','operational_module','participant_care','Participant care'),
 ('nursing_high_intensity','licence','professional_registration','Nursing / practitioner registration'),
 ('nursing_high_intensity','training','high_intensity_competency','High-intensity support competency'),
 ('nursing_high_intensity','evidence','individual_participant_plan','Individual participant plan'),
 ('nursing_high_intensity','operational_module','participant_care','Participant care'),
 ('nursing_high_intensity','operational_module','competency','Competency vault'),
 ('ndis_support_provider','screening','worker_screening','NDIS worker screening check'),
 ('ndis_support_provider','operational_module','participants','Participants')
) AS v(cat_code, rtype, ref, label)
JOIN public.business_categories bc ON bc.code = v.cat_code;

-- ===== requirement rules (service level) =====
INSERT INTO public.compliance_requirement_rules (business_category_id, service_type_id, requirement_type, requirement_reference, label, required)
SELECT st.business_category_id, st.id, v.rtype, v.ref, v.label, true
FROM (VALUES
 ('medication_support','operational_module','medication','Medication management'),
 ('medication_support','training','medication_competency','Medication competency'),
 ('dysphagia_mealtime','operational_module','mealtime','Mealtime management'),
 ('dysphagia_mealtime','training','dysphagia_competency','Dysphagia competency'),
 ('electrical_home_modification','licence','electrical_contractor_licence','Electrical contractor licence'),
 ('electrical_home_modification','evidence','site_risk_assessment','Site risk assessment'),
 ('electrical_home_modification','evidence','electrical_compliance_certificate','Electrical compliance certificate'),
 ('electrical_home_modification','evidence','handover_acceptance','Participant handover'),
 ('clinical_waste_disposal','operational_module','waste_register','Waste register'),
 ('bodily_fluid_cleanup','training','ppe_competency','PPE competency'),
 ('sil_support','operational_module','sil','SIL')
) AS v(st_code, rtype, ref, label)
JOIN public.service_types st ON st.code = v.st_code;

-- ===== engine: applicable requirements =====
CREATE OR REPLACE FUNCTION public.organisation_applicable_requirements(_org uuid)
RETURNS TABLE (requirement_type text, requirement_reference text, label text, required boolean, source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT r.requirement_type, r.requirement_reference, COALESCE(r.label, r.requirement_reference), r.required,
    COALESCE(st.name, bc.name)
  FROM public.compliance_requirement_rules r
  JOIN public.business_categories bc ON bc.id = r.business_category_id
  LEFT JOIN public.service_types st ON st.id = r.service_type_id
  WHERE r.active
    AND EXISTS (
      SELECT 1 FROM public.organisation_service_selections s
      WHERE s.organisation_id = _org AND NOT s.is_archived
        AND s.business_category_id = r.business_category_id
        AND (r.service_type_id IS NULL OR r.service_type_id = s.service_type_id)
    );
$$;

-- ===== engine: active modules =====
CREATE OR REPLACE FUNCTION public.organisation_active_modules(_org uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mods text[] := ARRAY['dashboard','settings','staff','training','policies','incidents','complaints','risks','governance','audit','documents','onboarding'];
BEGIN
  SELECT mods || COALESCE(array_agg(DISTINCT m.requirement_reference), '{}')
    INTO mods
  FROM public.organisation_applicable_requirements(_org) m
  WHERE m.requirement_type = 'operational_module';

  IF EXISTS (SELECT 1 FROM public.organisation_service_selections s
             JOIN public.service_types st ON st.id = s.service_type_id
             WHERE s.organisation_id = _org AND NOT s.is_archived AND st.requires_participant_management) THEN
    mods := mods || ARRAY['participants'];
  END IF;
  IF EXISTS (SELECT 1 FROM public.organisation_service_selections s
             JOIN public.service_types st ON st.id = s.service_type_id
             WHERE s.organisation_id = _org AND NOT s.is_archived AND st.supports_geolocation) THEN
    mods := mods || ARRAY['service_operations','geolocation'];
  END IF;
  IF EXISTS (SELECT 1 FROM public.organisation_service_selections s
             JOIN public.service_types st ON st.id = s.service_type_id
             WHERE s.organisation_id = _org AND NOT s.is_archived AND st.requires_photos) THEN
    mods := mods || ARRAY['photo_evidence'];
  END IF;
  IF EXISTS (SELECT 1 FROM public.organisation_service_selections s
             JOIN public.service_types st ON st.id = s.service_type_id
             WHERE s.organisation_id = _org AND NOT s.is_archived AND st.requires_clinical_governance) THEN
    mods := mods || ARRAY['participant_care','competency'];
  END IF;
  RETURN ARRAY(SELECT DISTINCT unnest(mods));
END;
$$;

-- ===== engine: generate draft policies from master templates =====
CREATE OR REPLACE FUNCTION public.generate_org_policies(_org uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  WHERE s.organisation_id = _org AND NOT s.is_archived;

  FOR t IN
    SELECT mt.* FROM public.master_templates mt
    WHERE mt.active AND (
      cardinality(mt.business_category_codes) = 0
      OR EXISTS (
        SELECT 1 FROM public.organisation_service_selections s
        JOIN public.business_categories bc ON bc.id = s.business_category_id
        WHERE s.organisation_id = _org AND NOT s.is_archived AND bc.code = ANY (mt.business_category_codes)
      )
      OR EXISTS (
        SELECT 1 FROM public.organisation_service_selections s
        JOIN public.service_types st ON st.id = s.service_type_id
        WHERE s.organisation_id = _org AND NOT s.is_archived AND st.code = ANY (mt.service_type_codes)
      ))
  LOOP
    IF EXISTS (SELECT 1 FROM public.policies p WHERE p.organisation_id = _org AND p.master_template_id = t.id) THEN
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

-- ===== engine: confirm selections =====
CREATE OR REPLACE FUNCTION public.confirm_service_selections(_org uuid, _ndis_funding_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_sel integer;
  n_pol integer;
  onb_id uuid;
BEGIN
  IF NOT (public.is_platform_admin(auth.uid()) OR _org = public.get_user_organisation_id(auth.uid())) THEN
    RAISE EXCEPTION 'Not permitted for this organisation';
  END IF;
  SELECT count(*) INTO n_sel FROM public.organisation_service_selections
   WHERE organisation_id = _org AND NOT is_archived;
  IF n_sel = 0 THEN
    RAISE EXCEPTION 'Select at least one service before confirming';
  END IF;

  UPDATE public.organisation_service_selections
     SET confirmed_by = auth.uid(), confirmed_at = now()
   WHERE organisation_id = _org AND NOT is_archived AND confirmed_at IS NULL;

  SELECT public.generate_org_policies(_org) INTO n_pol;

  UPDATE public.organisation_onboarding
     SET pathway_status = 'services_confirmed',
         ndis_funding_status = _ndis_funding_status,
         services_confirmed_at = now(),
         status = CASE WHEN status IN ('not_started','changes_requested','returned') THEN 'in_progress' ELSE status END
   WHERE organisation_id = _org
   RETURNING id INTO onb_id;

  RETURN jsonb_build_object('selections', n_sel, 'policies_created', n_pol, 'onboarding_id', onb_id);
END;
$$;
