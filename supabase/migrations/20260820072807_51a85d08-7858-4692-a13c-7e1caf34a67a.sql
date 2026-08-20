-- ============ Phase 4-6: medication, mealtime, waste, SIL ============
CREATE TYPE public.medication_admin_result AS ENUM ('administered','refused','withheld','missed','self_administered');
CREATE TYPE public.waste_type AS ENUM ('general','clinical','sharps','infectious','hazardous','other');

-- ---------------- medication_profiles ----------------
CREATE TABLE public.medication_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  medication_name text NOT NULL,
  form text,
  dose text,
  timing text,
  route text,
  prescriber_name text,
  prescriber_contact text,
  pharmacy text,
  consent_obtained boolean NOT NULL DEFAULT false,
  consent_date date,
  storage_location text,
  controlled_drug boolean NOT NULL DEFAULT false,
  double_check_required boolean NOT NULL DEFAULT false,
  authorised_record_url text,
  start_date date,
  end_date date,
  review_date date,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.medication_profiles TO authenticated;
GRANT ALL ON public.medication_profiles TO service_role;
ALTER TABLE public.medication_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY mp_select ON public.medication_profiles FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY mp_insert ON public.medication_profiles FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY mp_update ON public.medication_profiles FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE OR REPLACE FUNCTION public.enforce_medication_profile_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    IF NEW.authorised_record_url IS NULL OR trim(NEW.authorised_record_url) = '' THEN
      RAISE EXCEPTION 'Cannot activate medication profile: the authorised medication record (e.g. prescriber or pharmacy chart) must be uploaded.';
    END IF;
    IF NOT NEW.consent_obtained THEN
      RAISE EXCEPTION 'Cannot activate medication profile: participant or authorised decision-maker consent must be recorded.';
    END IF;
    IF NEW.dose IS NULL OR NEW.timing IS NULL OR NEW.route IS NULL THEN
      RAISE EXCEPTION 'Cannot activate medication profile: dose, timing and route are required.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- ---------------- medication_administration_records ----------------
CREATE TABLE public.medication_administration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  medication_profile_id uuid NOT NULL REFERENCES public.medication_profiles(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  due_at timestamptz NOT NULL,
  recorded_at timestamptz,
  worker_id uuid,
  result public.medication_admin_result,
  reason text,
  witness_id uuid,
  escalated boolean NOT NULL DEFAULT false,
  escalation_notes text,
  linked_incident_id uuid REFERENCES public.incidents(id),
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.medication_administration_records TO authenticated;
GRANT ALL ON public.medication_administration_records TO service_role;
ALTER TABLE public.medication_administration_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY mar_select ON public.medication_administration_records FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY mar_insert ON public.medication_administration_records FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.can_access_participant(participant_id));
CREATE POLICY mar_update ON public.medication_administration_records FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.can_access_participant(participant_id));

CREATE OR REPLACE FUNCTION public.enforce_medication_administration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _profile record; _uid uuid; _recipients uuid[]; _pname text;
BEGIN
  IF NEW.result IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _profile FROM public.medication_profiles WHERE id = NEW.medication_profile_id;
  IF _profile.status <> 'active' THEN
    RAISE EXCEPTION 'Cannot record administration against a medication profile that is not active.';
  END IF;
  IF _profile.double_check_required AND NEW.result = 'administered' AND NEW.witness_id IS NULL THEN
    RAISE EXCEPTION 'This medication requires a second-person check: a witness must be recorded.';
  END IF;
  IF NEW.witness_id IS NOT NULL AND NEW.witness_id = NEW.worker_id THEN
    RAISE EXCEPTION 'The witness for a double check must be a different worker.';
  END IF;
  IF NEW.result IN ('refused','withheld','missed') AND (NEW.reason IS NULL OR trim(NEW.reason) = '') THEN
    RAISE EXCEPTION 'A reason is required when medication is refused, withheld or missed. Follow the authorised medication record and your escalation protocol.';
  END IF;

  NEW.recorded_at := COALESCE(NEW.recorded_at, now());

  IF NEW.result IN ('refused','withheld','missed') THEN
    NEW.escalated := true;
    SELECT first_name || ' ' || last_name INTO _pname FROM public.participants WHERE id = NEW.participant_id;
    SELECT array_agg(ur.user_id) INTO _recipients
      FROM public.user_roles ur JOIN public.user_profiles up ON up.id = ur.user_id
     WHERE ur.role IN ('supervisor','compliance_officer','super_admin')
       AND up.organisation_id = NEW.organisation_id;
    IF _recipients IS NOT NULL THEN
      FOREACH _uid IN ARRAY _recipients LOOP
        INSERT INTO public.notifications (user_id, title, message, severity, notification_type, source_table, source_record_id, link, organisation_id)
        VALUES (_uid, 'Medication ' || NEW.result::text || ' — requires review',
                'Medication "' || _profile.medication_name || '" for ' || COALESCE(_pname,'a participant') ||
                ' was recorded as ' || NEW.result::text || '. Follow the authorised medication record and escalation protocol.',
                'critical', 'medication_alert', 'medication_administration_records', NEW.id, '/medication', NEW.organisation_id);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- ---------------- medication_storage_checks ----------------
CREATE TABLE public.medication_storage_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  location text NOT NULL,
  checked_by uuid,
  checked_at timestamptz NOT NULL DEFAULT now(),
  temperature_ok boolean NOT NULL DEFAULT true,
  secure_storage_ok boolean NOT NULL DEFAULT true,
  stock_reconciled boolean NOT NULL DEFAULT true,
  issues text,
  follow_up_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.medication_storage_checks TO authenticated;
GRANT ALL ON public.medication_storage_checks TO service_role;
ALTER TABLE public.medication_storage_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY msc_select ON public.medication_storage_checks FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY msc_insert ON public.medication_storage_checks FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY msc_update ON public.medication_storage_checks FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

-- ---------------- mealtime_profiles ----------------
CREATE TABLE public.mealtime_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  mealtime_support_required boolean NOT NULL DEFAULT true,
  practitioner_plan_url text,
  plan_practitioner text,
  texture_modification text,
  fluid_consistency text,
  allergies text,
  identified_risks text,
  seating_positioning text,
  choking_emergency_response text,
  required_competency_code text NOT NULL DEFAULT 'MEALTIME_MGMT',
  plan_review_date date,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mealtime_profiles TO authenticated;
GRANT ALL ON public.mealtime_profiles TO service_role;
ALTER TABLE public.mealtime_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY mtp_select ON public.mealtime_profiles FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY mtp_insert ON public.mealtime_profiles FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY mtp_update ON public.mealtime_profiles FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE OR REPLACE FUNCTION public.enforce_mealtime_plan_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    IF NEW.practitioner_plan_url IS NULL OR trim(NEW.practitioner_plan_url) = '' THEN
      RAISE EXCEPTION 'Cannot activate mealtime profile: the qualified practitioner mealtime plan must be uploaded.';
    END IF;
    IF NEW.choking_emergency_response IS NULL OR trim(NEW.choking_emergency_response) = '' THEN
      RAISE EXCEPTION 'Cannot activate mealtime profile: the choking and emergency response must be documented.';
    END IF;
    IF NEW.plan_review_date IS NULL THEN
      RAISE EXCEPTION 'Cannot activate mealtime profile: a plan review date is required.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- ---------------- mealtime_task_assignments ----------------
CREATE TABLE public.mealtime_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  mealtime_profile_id uuid NOT NULL REFERENCES public.mealtime_profiles(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  worker_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  competency_verified_at timestamptz,
  blocked_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mealtime_task_assignments TO authenticated;
GRANT ALL ON public.mealtime_task_assignments TO service_role;
ALTER TABLE public.mealtime_task_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY mta_select ON public.mealtime_task_assignments FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND (worker_id = auth.uid() OR public.can_access_participant(participant_id)));
CREATE POLICY mta_insert ON public.mealtime_task_assignments FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','hr_admin']::app_role[]));
CREATE POLICY mta_update ON public.mealtime_task_assignments FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','hr_admin']::app_role[]));

CREATE OR REPLACE FUNCTION public.has_current_training(_user_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.training_completions tc
    WHERE tc.user_id = _user_id
      AND tc.training_code = _code
      AND tc.status = 'completed'
      AND tc.verified_by IS NOT NULL
      AND (tc.expiry_date IS NULL OR tc.expiry_date >= CURRENT_DATE)
  )
$$;

CREATE OR REPLACE FUNCTION public.enforce_mealtime_competency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code text;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT required_competency_code INTO _code FROM public.mealtime_profiles WHERE id = NEW.mealtime_profile_id;
    IF NOT public.has_current_training(NEW.worker_id, COALESCE(_code,'MEALTIME_MGMT')) THEN
      RAISE EXCEPTION 'Rostering blocked: the worker does not hold current verified % competency for mealtime support.', COALESCE(_code,'MEALTIME_MGMT');
    END IF;
    NEW.competency_verified_at := now();
  END IF;
  RETURN NEW;
END; $$;

-- ---------------- check templates & environment checks ----------------
CREATE TABLE public.check_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  name text NOT NULL,
  category text NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.check_templates TO authenticated;
GRANT ALL ON public.check_templates TO service_role;
ALTER TABLE public.check_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY ct_select ON public.check_templates FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY ct_write ON public.check_templates FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[]));
CREATE POLICY ct_update ON public.check_templates FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[]));

CREATE TABLE public.environment_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  template_id uuid REFERENCES public.check_templates(id),
  location text NOT NULL,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  ppe_available boolean NOT NULL DEFAULT true,
  cleaning_completed boolean NOT NULL DEFAULT true,
  infection_control_ok boolean NOT NULL DEFAULT true,
  hazards_identified text,
  passed boolean NOT NULL DEFAULT true,
  escalated boolean NOT NULL DEFAULT false,
  follow_up_action text,
  next_due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.environment_checks TO authenticated;
GRANT ALL ON public.environment_checks TO service_role;
ALTER TABLE public.environment_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY ec_select ON public.environment_checks FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY ec_insert ON public.environment_checks FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY ec_update ON public.environment_checks FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE OR REPLACE FUNCTION public.escalate_failed_environment_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _recipients uuid[];
BEGIN
  IF NOT NEW.ppe_available OR NOT NEW.cleaning_completed OR NOT NEW.infection_control_ok THEN
    NEW.passed := false;
  END IF;
  IF NOT NEW.passed AND (TG_OP = 'INSERT' OR OLD.passed IS DISTINCT FROM NEW.passed) THEN
    NEW.escalated := true;
    SELECT array_agg(ur.user_id) INTO _recipients
      FROM public.user_roles ur JOIN public.user_profiles up ON up.id = ur.user_id
     WHERE ur.role IN ('supervisor','compliance_officer','super_admin')
       AND up.organisation_id = NEW.organisation_id;
    IF _recipients IS NOT NULL THEN
      FOREACH _uid IN ARRAY _recipients LOOP
        INSERT INTO public.notifications (user_id, title, message, severity, notification_type, source_table, source_record_id, link, organisation_id)
        VALUES (_uid, 'Failed environment / infection control check',
                'A check at "' || NEW.location || '" did not pass and requires follow-up.',
                'warning', 'environment_check', 'environment_checks', NEW.id, '/environment', NEW.organisation_id);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TABLE public.waste_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  waste_type public.waste_type NOT NULL,
  description text,
  quantity text,
  storage_location text,
  disposal_method text,
  disposal_contractor text,
  disposal_date date,
  handled_by uuid,
  ppe_used text,
  spill_or_accident boolean NOT NULL DEFAULT false,
  linked_incident_id uuid REFERENCES public.incidents(id),
  notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.waste_register TO authenticated;
GRANT ALL ON public.waste_register TO service_role;
ALTER TABLE public.waste_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY wr_select ON public.waste_register FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY wr_insert ON public.waste_register FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY wr_update ON public.waste_register FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

-- ---------------- SIL ----------------
CREATE TABLE public.sil_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL UNIQUE REFERENCES public.organisations(id),
  is_enabled boolean NOT NULL DEFAULT false,
  registration_confirmed boolean NOT NULL DEFAULT false,
  confirmed_by uuid,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sil_configuration TO authenticated;
GRANT ALL ON public.sil_configuration TO service_role;
ALTER TABLE public.sil_configuration ENABLE ROW LEVEL SECURITY;
CREATE POLICY silcfg_select ON public.sil_configuration FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY silcfg_insert ON public.sil_configuration FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY silcfg_update ON public.sil_configuration FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.enforce_sil_enablement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _confirmed boolean;
BEGIN
  IF NEW.is_enabled THEN
    SELECT is_confirmed INTO _confirmed FROM public.registration_groups
     WHERE organisation_id = NEW.organisation_id AND code = '0138';
    IF _confirmed IS NOT TRUE THEN
      RAISE EXCEPTION 'Supported Independent Living cannot be enabled: registration group 0138 has not been confirmed by an authorised administrator.';
    END IF;
    NEW.registration_confirmed := true;
    NEW.confirmed_by := COALESCE(NEW.confirmed_by, auth.uid());
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  END IF;
  RETURN NEW;
END; $$;

CREATE TABLE public.sil_houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  name text NOT NULL,
  address text,
  house_emergency_plan text,
  plan_review_date date,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sil_houses TO authenticated;
GRANT ALL ON public.sil_houses TO service_role;
ALTER TABLE public.sil_houses ENABLE ROW LEVEL SECURITY;
CREATE POLICY silh_select ON public.sil_houses FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY silh_insert ON public.sil_houses FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY silh_update ON public.sil_houses FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE TABLE public.sil_tenancy_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  house_id uuid REFERENCES public.sil_houses(id),
  agreement_number text NOT NULL,
  status public.service_agreement_status NOT NULL DEFAULT 'draft',
  independent_of_service_agreement boolean NOT NULL DEFAULT true,
  tenancy_start date,
  tenancy_end date,
  rights_acknowledged boolean NOT NULL DEFAULT false,
  accessible_copy_provided boolean NOT NULL DEFAULT false,
  keys_private_space_preferences text,
  visitor_preferences text,
  co_tenant_consultation text,
  shared_space_decisions text,
  vacancy_consultation text,
  conflict_safeguarding_plan text,
  signature_method text,
  signed_by_name text,
  signed_at timestamptz,
  signed_copy_url text,
  ended_reason text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sil_tenancy_number_key ON public.sil_tenancy_agreements(organisation_id, agreement_number);
GRANT SELECT, INSERT, UPDATE ON public.sil_tenancy_agreements TO authenticated;
GRANT ALL ON public.sil_tenancy_agreements TO service_role;
ALTER TABLE public.sil_tenancy_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY silt_select ON public.sil_tenancy_agreements FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY silt_insert ON public.sil_tenancy_agreements FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY silt_update ON public.sil_tenancy_agreements FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE OR REPLACE FUNCTION public.enforce_sil_module_available()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _enabled boolean;
BEGIN
  SELECT is_enabled INTO _enabled FROM public.sil_configuration WHERE organisation_id = NEW.organisation_id;
  IF _enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'The Supported Independent Living module is unavailable until registration group 0138 is confirmed and SIL is enabled by an authorised administrator.';
  END IF;
  IF TG_TABLE_NAME = 'sil_tenancy_agreements' AND NEW.status = 'signed'
     AND (NOT NEW.rights_acknowledged OR NOT NEW.accessible_copy_provided) THEN
    RAISE EXCEPTION 'Cannot sign a tenancy agreement: tenancy rights and provision of an accessible copy must be acknowledged.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TABLE public.sil_house_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  house_id uuid NOT NULL REFERENCES public.sil_houses(id),
  drill_type text NOT NULL,
  drill_date date NOT NULL,
  participants_involved jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome text,
  issues_identified text,
  next_due_date date,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sil_house_drills TO authenticated;
GRANT ALL ON public.sil_house_drills TO service_role;
ALTER TABLE public.sil_house_drills ENABLE ROW LEVEL SECURITY;
CREATE POLICY sild_select ON public.sil_house_drills FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY sild_insert ON public.sil_house_drills FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY sild_update ON public.sil_house_drills FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE TABLE public.participant_concerns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid REFERENCES public.participants(id),
  raised_by uuid,
  anonymous boolean NOT NULL DEFAULT false,
  concern text NOT NULL,
  support_requested text,
  advocacy_referral boolean NOT NULL DEFAULT false,
  routed_to_complaint_id uuid REFERENCES public.complaints(id),
  status text NOT NULL DEFAULT 'received',
  outcome text,
  no_retaliation_acknowledged boolean NOT NULL DEFAULT true,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.participant_concerns TO authenticated;
GRANT ALL ON public.participant_concerns TO service_role;
ALTER TABLE public.participant_concerns ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcon_select ON public.participant_concerns FOR SELECT TO authenticated
  USING (raised_by = auth.uid()
    OR (organisation_id = public.get_user_organisation_id(auth.uid())
        AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[])));
CREATE POLICY pcon_insert ON public.participant_concerns FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY pcon_update ON public.participant_concerns FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[]));

-- ---------------- triggers ----------------
CREATE TRIGGER trg_mp_updated BEFORE UPDATE ON public.medication_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_mar_updated BEFORE UPDATE ON public.medication_administration_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_msc_updated BEFORE UPDATE ON public.medication_storage_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_mtp_updated BEFORE UPDATE ON public.mealtime_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_mta_updated BEFORE UPDATE ON public.mealtime_task_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ct_updated BEFORE UPDATE ON public.check_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ec_updated BEFORE UPDATE ON public.environment_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_wr_updated BEFORE UPDATE ON public.waste_register FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_silcfg_updated BEFORE UPDATE ON public.sil_configuration FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_silh_updated BEFORE UPDATE ON public.sil_houses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_silt_updated BEFORE UPDATE ON public.sil_tenancy_agreements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_sild_updated BEFORE UPDATE ON public.sil_house_drills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_pcon_updated BEFORE UPDATE ON public.participant_concerns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_mp_activation BEFORE INSERT OR UPDATE ON public.medication_profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_medication_profile_activation();
CREATE TRIGGER trg_mar_enforce BEFORE INSERT OR UPDATE ON public.medication_administration_records FOR EACH ROW EXECUTE FUNCTION public.enforce_medication_administration();
CREATE TRIGGER trg_mtp_activation BEFORE INSERT OR UPDATE ON public.mealtime_profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_mealtime_plan_activation();
CREATE TRIGGER trg_mta_competency BEFORE INSERT OR UPDATE ON public.mealtime_task_assignments FOR EACH ROW EXECUTE FUNCTION public.enforce_mealtime_competency();
CREATE TRIGGER trg_ec_escalate BEFORE INSERT OR UPDATE ON public.environment_checks FOR EACH ROW EXECUTE FUNCTION public.escalate_failed_environment_check();
CREATE TRIGGER trg_silcfg_gate BEFORE INSERT OR UPDATE ON public.sil_configuration FOR EACH ROW EXECUTE FUNCTION public.enforce_sil_enablement();
CREATE TRIGGER trg_silt_gate BEFORE INSERT OR UPDATE ON public.sil_tenancy_agreements FOR EACH ROW EXECUTE FUNCTION public.enforce_sil_module_available();
CREATE TRIGGER trg_silh_gate BEFORE INSERT ON public.sil_houses FOR EACH ROW EXECUTE FUNCTION public.enforce_sil_module_available();

CREATE TRIGGER trg_audit_mp AFTER INSERT OR UPDATE ON public.medication_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_mar AFTER INSERT OR UPDATE ON public.medication_administration_records FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_mtp AFTER INSERT OR UPDATE ON public.mealtime_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_mta AFTER INSERT OR UPDATE ON public.mealtime_task_assignments FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_ec AFTER INSERT OR UPDATE ON public.environment_checks FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_wr AFTER INSERT OR UPDATE ON public.waste_register FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_silt AFTER INSERT OR UPDATE ON public.sil_tenancy_agreements FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_pcon AFTER INSERT OR UPDATE ON public.participant_concerns FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

CREATE TRIGGER trg_nodel_mp BEFORE DELETE ON public.medication_profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_mar BEFORE DELETE ON public.medication_administration_records FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_msc BEFORE DELETE ON public.medication_storage_checks FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_mtp BEFORE DELETE ON public.mealtime_profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_mta BEFORE DELETE ON public.mealtime_task_assignments FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_ec BEFORE DELETE ON public.environment_checks FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_wr BEFORE DELETE ON public.waste_register FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_silt BEFORE DELETE ON public.sil_tenancy_agreements FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_sild BEFORE DELETE ON public.sil_house_drills FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_pcon BEFORE DELETE ON public.participant_concerns FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

REVOKE EXECUTE ON FUNCTION public.enforce_medication_profile_activation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_medication_administration() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_mealtime_plan_activation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_mealtime_competency() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.escalate_failed_environment_check() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_sil_enablement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_sil_module_available() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_current_training(uuid, text) FROM PUBLIC, anon;

-- seed default recurring check templates
INSERT INTO public.check_templates (organisation_id, name, category, frequency, instructions)
SELECT o.id, t.name, t.category, t.frequency, t.instructions
FROM public.organisations o
CROSS JOIN (VALUES
  ('PPE availability and condition','ppe','weekly','Confirm gloves, masks, aprons and eye protection are stocked, in date and accessible.'),
  ('Cleaning and infection prevention','infection_control','weekly','Confirm cleaning schedule completed, surfaces sanitised and hand hygiene supplies available.'),
  ('Clinical and sharps waste handling','waste','monthly','Confirm segregation, secure storage, contractor collection records and PPE use.'),
  ('Medication storage check','medication_storage','monthly','Confirm temperature range, secure locked storage and stock reconciliation.'),
  ('Safe environment walkthrough','environment','monthly','Confirm exits clear, hazards controlled, equipment maintained and emergency signage visible.')
) AS t(name, category, frequency, instructions);
