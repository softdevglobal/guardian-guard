-- ============ Phase 2-3: onboarding, consent, agreements, planning ============

ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS participants_user_id_key ON public.participants(user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_participant_id_for_user(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.participants WHERE user_id = _user_id LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_participant_id_for_user(uuid) FROM PUBLIC, anon;

-- Is the current user allowed to see this participant's operational records?
CREATE OR REPLACE FUNCTION public.can_access_participant(_participant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.id = _participant_id
      AND (
        p.user_id = auth.uid()
        OR (
          p.organisation_id = public.get_user_organisation_id(auth.uid())
          AND (
            public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','executive','hr_admin']::app_role[])
            OR p.assigned_trainer_id = auth.uid()
          )
        )
      )
  )
$$;

CREATE TYPE public.service_agreement_status AS ENUM ('draft','participant_review','signed','active','ended','archived');
CREATE TYPE public.support_plan_status AS ENUM ('draft','active','superseded','archived');

-- ---------------- participant_consents ----------------
CREATE TABLE public.participant_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  consent_version integer NOT NULL DEFAULT 1,
  purpose_collection text,
  purpose_use text,
  purpose_disclosure text,
  information_sharing_parties jsonb NOT NULL DEFAULT '[]'::jsonb,
  communication_preference text,
  accessible_format text,
  interpreter_required boolean NOT NULL DEFAULT false,
  nominee_name text,
  nominee_relationship text,
  nominee_contact text,
  advocate_name text,
  advocate_contact text,
  consent_status public.consent_status NOT NULL DEFAULT 'pending',
  consent_date timestamptz,
  withdrawn_date timestamptz,
  captured_by uuid,
  notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.participant_consents TO authenticated;
GRANT ALL ON public.participant_consents TO service_role;
ALTER TABLE public.participant_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY pc_select ON public.participant_consents FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY pc_insert ON public.participant_consents FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','trainer']::app_role[]));
CREATE POLICY pc_update ON public.participant_consents FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

-- ---------------- service_agreements ----------------
CREATE TABLE public.service_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  agreement_number text NOT NULL,
  status public.service_agreement_status NOT NULL DEFAULT 'draft',
  support_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_notes text,
  start_date date,
  end_date date,
  cancellation_terms text,
  emergency_continuity_arrangement text,
  complaints_path text,
  advocate_rights_acknowledged boolean NOT NULL DEFAULT false,
  privacy_notice_acknowledged boolean NOT NULL DEFAULT false,
  signature_method text,
  signed_by_name text,
  signed_at timestamptz,
  signed_copy_url text,
  accessible_format_provided text,
  ended_reason text,
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX service_agreements_number_key ON public.service_agreements(organisation_id, agreement_number);
GRANT SELECT, INSERT, UPDATE ON public.service_agreements TO authenticated;
GRANT ALL ON public.service_agreements TO service_role;
ALTER TABLE public.service_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY sa_select ON public.service_agreements FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY sa_insert ON public.service_agreements FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY sa_update ON public.service_agreements FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE OR REPLACE FUNCTION public.enforce_service_agreement_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE allowed text[];
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  allowed := CASE OLD.status
    WHEN 'draft' THEN ARRAY['participant_review','archived']
    WHEN 'participant_review' THEN ARRAY['draft','signed','archived']
    WHEN 'signed' THEN ARRAY['active','archived']
    WHEN 'active' THEN ARRAY['ended']
    WHEN 'ended' THEN ARRAY['archived']
    ELSE ARRAY[]::text[] END;
  IF NOT (NEW.status::text = ANY(allowed)) THEN
    RAISE EXCEPTION 'Invalid service agreement transition: % -> %.', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'signed' THEN
    IF NEW.signature_method IS NULL OR NEW.signed_by_name IS NULL OR NEW.signed_at IS NULL THEN
      RAISE EXCEPTION 'Cannot mark agreement signed: signature method, signatory name and signed date are required.';
    END IF;
    IF NOT NEW.privacy_notice_acknowledged OR NOT NEW.advocate_rights_acknowledged THEN
      RAISE EXCEPTION 'Cannot mark agreement signed: privacy notice and advocate rights must be acknowledged.';
    END IF;
    IF NEW.complaints_path IS NULL OR trim(NEW.complaints_path) = '' THEN
      RAISE EXCEPTION 'Cannot mark agreement signed: the complaints pathway must be recorded.';
    END IF;
  END IF;
  IF NEW.status = 'active' AND NEW.start_date IS NULL THEN
    RAISE EXCEPTION 'Cannot activate agreement: a start date is required.';
  END IF;
  IF NEW.status = 'ended' AND (NEW.ended_reason IS NULL OR trim(NEW.ended_reason) = '') THEN
    RAISE EXCEPTION 'Cannot end agreement: an ended reason is required.';
  END IF;
  RETURN NEW;
END; $$;

-- ---------------- service_delivery_records ----------------
CREATE TABLE public.service_delivery_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  service_agreement_id uuid REFERENCES public.service_agreements(id),
  worker_id uuid,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  support_item text,
  duration_hours numeric,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  exception_reason text,
  authorised_by uuid,
  authorised_at timestamptz,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.service_delivery_records TO authenticated;
GRANT ALL ON public.service_delivery_records TO service_role;
ALTER TABLE public.service_delivery_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_select ON public.service_delivery_records FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY sdr_insert ON public.service_delivery_records FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.can_access_participant(participant_id));
CREATE POLICY sdr_update ON public.service_delivery_records FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.can_access_participant(participant_id));

CREATE OR REPLACE FUNCTION public.enforce_service_agreement_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _has_agreement boolean;
BEGIN
  IF NEW.status <> 'finalised' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'finalised' THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.service_agreements sa
    WHERE sa.participant_id = NEW.participant_id
      AND sa.status = 'active'
      AND sa.record_status = 'active'
      AND (sa.start_date IS NULL OR sa.start_date <= NEW.service_date)
      AND (sa.end_date IS NULL OR sa.end_date >= NEW.service_date)
  ) INTO _has_agreement;

  IF NOT _has_agreement THEN
    IF NEW.exception_reason IS NULL OR trim(NEW.exception_reason) = '' OR NEW.authorised_by IS NULL THEN
      RAISE EXCEPTION 'Cannot finalise service delivery: no active service agreement covers this date. An authorised exception reason and authoriser are required.';
    END IF;
    IF NOT public.has_any_role(NEW.authorised_by, ARRAY['super_admin','compliance_officer','supervisor']::app_role[]) THEN
      RAISE EXCEPTION 'Cannot finalise service delivery: the exception must be authorised by a supervisor, compliance officer or administrator.';
    END IF;
    NEW.authorised_at := COALESCE(NEW.authorised_at, now());
    INSERT INTO public.audit_logs (user_id, action, module, record_id, organisation_id, severity, details)
    VALUES (auth.uid(), 'service_delivery_agreement_exception', 'service_delivery_records', NEW.id, NEW.organisation_id, 'elevated',
      jsonb_build_object('participant_id', NEW.participant_id, 'service_date', NEW.service_date,
                         'exception_reason', NEW.exception_reason, 'authorised_by', NEW.authorised_by));
  END IF;
  RETURN NEW;
END; $$;

-- ---------------- support_plans ----------------
CREATE TABLE public.support_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  version_number integer NOT NULL DEFAULT 1,
  status public.support_plan_status NOT NULL DEFAULT 'draft',
  goals text,
  strengths text,
  preferences text,
  culture_values_beliefs text,
  communication_method text,
  decision_making_supports text,
  support_network_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  health_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  emergency_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_support_needs text,
  community_participation text,
  review_due_date date,
  participant_involved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX support_plans_version_key ON public.support_plans(participant_id, version_number);
GRANT SELECT, INSERT, UPDATE ON public.support_plans TO authenticated;
GRANT ALL ON public.support_plans TO service_role;
ALTER TABLE public.support_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp_select ON public.support_plans FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY sp_insert ON public.support_plans FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','trainer']::app_role[]));
CREATE POLICY sp_update ON public.support_plans FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','trainer']::app_role[]));

CREATE OR REPLACE FUNCTION public.enforce_support_plan_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    IF NEW.goals IS NULL OR trim(NEW.goals) = '' THEN
      RAISE EXCEPTION 'Cannot activate support plan: goals are required.';
    END IF;
    IF NEW.communication_method IS NULL OR trim(NEW.communication_method) = '' THEN
      RAISE EXCEPTION 'Cannot activate support plan: the communication method is required.';
    END IF;
    IF NEW.review_due_date IS NULL THEN
      RAISE EXCEPTION 'Cannot activate support plan: a review due date is required.';
    END IF;
    UPDATE public.support_plans SET status = 'superseded'
     WHERE participant_id = NEW.participant_id AND id <> NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END; $$;

-- ---------------- participant_risk_assessments ----------------
CREATE TABLE public.participant_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  support_plan_id uuid REFERENCES public.support_plans(id),
  risk_description text NOT NULL,
  likelihood_score integer NOT NULL DEFAULT 1,
  consequence_score integer NOT NULL DEFAULT 1,
  risk_score integer,
  risk_level text,
  existing_controls text,
  escalation_pathway text,
  person_consulted text,
  review_date date,
  status text NOT NULL DEFAULT 'open',
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.participant_risk_assessments TO authenticated;
GRANT ALL ON public.participant_risk_assessments TO service_role;
ALTER TABLE public.participant_risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY pra_select ON public.participant_risk_assessments FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY pra_write ON public.participant_risk_assessments FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','trainer']::app_role[]));
CREATE POLICY pra_update ON public.participant_risk_assessments FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE OR REPLACE FUNCTION public.calc_participant_risk_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.risk_score := COALESCE(NEW.likelihood_score,1) * COALESCE(NEW.consequence_score,1);
  NEW.risk_level := CASE
    WHEN NEW.risk_score >= 16 THEN 'Critical'
    WHEN NEW.risk_score >= 10 THEN 'High'
    WHEN NEW.risk_score >= 5 THEN 'Medium'
    ELSE 'Low' END;
  IF NEW.risk_score >= 10 AND (NEW.existing_controls IS NULL OR trim(NEW.existing_controls) = '') THEN
    RAISE EXCEPTION 'High and critical participant risks require documented controls.';
  END IF;
  RETURN NEW;
END; $$;

-- ---------------- participant_continuity_plans ----------------
CREATE TABLE public.participant_continuity_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  critical_supports text NOT NULL,
  alternative_worker_id uuid,
  alternative_provider text,
  emergency_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  evacuation_requirements text,
  communication_requirements text,
  last_tested_date date,
  test_notes text,
  review_date date,
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.participant_continuity_plans TO authenticated;
GRANT ALL ON public.participant_continuity_plans TO service_role;
ALTER TABLE public.participant_continuity_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcp_select ON public.participant_continuity_plans FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY pcp_insert ON public.participant_continuity_plans FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','trainer']::app_role[]));
CREATE POLICY pcp_update ON public.participant_continuity_plans FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

-- ---------------- worker_assignments ----------------
CREATE TABLE public.worker_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  worker_id uuid NOT NULL,
  role_on_team text,
  status text NOT NULL DEFAULT 'pending',
  plan_briefing_completed boolean NOT NULL DEFAULT false,
  plan_briefing_date date,
  briefing_support_plan_id uuid REFERENCES public.support_plans(id),
  start_date date,
  end_date date,
  blocked_reason text,
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.worker_assignments TO authenticated;
GRANT ALL ON public.worker_assignments TO service_role;
ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_select ON public.worker_assignments FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND (worker_id = auth.uid()
      OR public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','hr_admin','executive']::app_role[])));
CREATE POLICY wa_insert ON public.worker_assignments FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','hr_admin']::app_role[]));
CREATE POLICY wa_update ON public.worker_assignments FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','hr_admin']::app_role[]));

CREATE OR REPLACE FUNCTION public.enforce_worker_assignment_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    IF NOT NEW.plan_briefing_completed OR NEW.briefing_support_plan_id IS NULL THEN
      RAISE EXCEPTION 'Assignment blocked: the worker must be briefed on the participant support plan before activation.';
    END IF;
    PERFORM public.check_staff_assignment_eligible(NEW.worker_id);
  END IF;
  RETURN NEW;
END; $$;

-- ---------------- triggers ----------------
CREATE TRIGGER trg_pc_updated BEFORE UPDATE ON public.participant_consents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_sa_updated BEFORE UPDATE ON public.service_agreements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_sdr_updated BEFORE UPDATE ON public.service_delivery_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_sp_updated BEFORE UPDATE ON public.support_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_pra_updated BEFORE UPDATE ON public.participant_risk_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_pcp_updated BEFORE UPDATE ON public.participant_continuity_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_wa_updated BEFORE UPDATE ON public.worker_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_sa_workflow BEFORE UPDATE ON public.service_agreements FOR EACH ROW EXECUTE FUNCTION public.enforce_service_agreement_workflow();
CREATE TRIGGER trg_sdr_gate BEFORE INSERT OR UPDATE ON public.service_delivery_records FOR EACH ROW EXECUTE FUNCTION public.enforce_service_agreement_gate();
CREATE TRIGGER trg_sp_activation BEFORE INSERT OR UPDATE ON public.support_plans FOR EACH ROW EXECUTE FUNCTION public.enforce_support_plan_activation();
CREATE TRIGGER trg_pra_score BEFORE INSERT OR UPDATE ON public.participant_risk_assessments FOR EACH ROW EXECUTE FUNCTION public.calc_participant_risk_score();
CREATE TRIGGER trg_wa_gate BEFORE INSERT OR UPDATE ON public.worker_assignments FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_assignment_gate();

CREATE TRIGGER trg_audit_pc AFTER INSERT OR UPDATE ON public.participant_consents FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_sa AFTER INSERT OR UPDATE ON public.service_agreements FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_sdr AFTER INSERT OR UPDATE ON public.service_delivery_records FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_sp AFTER INSERT OR UPDATE ON public.support_plans FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_pra AFTER INSERT OR UPDATE ON public.participant_risk_assessments FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_pcp AFTER INSERT OR UPDATE ON public.participant_continuity_plans FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_wa AFTER INSERT OR UPDATE ON public.worker_assignments FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

CREATE TRIGGER trg_nodel_pc BEFORE DELETE ON public.participant_consents FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_sa BEFORE DELETE ON public.service_agreements FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_sdr BEFORE DELETE ON public.service_delivery_records FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_sp BEFORE DELETE ON public.support_plans FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_pra BEFORE DELETE ON public.participant_risk_assessments FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_pcp BEFORE DELETE ON public.participant_continuity_plans FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_wa BEFORE DELETE ON public.worker_assignments FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

REVOKE EXECUTE ON FUNCTION public.enforce_service_agreement_workflow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_service_agreement_gate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_support_plan_activation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_participant_risk_score() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_worker_assignment_gate() FROM PUBLIC, anon, authenticated;

-- Final definition: also grants access to workers actively assigned to the participant.
CREATE OR REPLACE FUNCTION public.can_access_participant(_participant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.id = _participant_id
      AND (
        p.user_id = auth.uid()
        OR (
          p.organisation_id = public.get_user_organisation_id(auth.uid())
          AND (
            public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor','executive','hr_admin']::app_role[])
            OR p.assigned_trainer_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.worker_assignments wa
              WHERE wa.participant_id = p.id AND wa.worker_id = auth.uid() AND wa.status = 'active'
            )
          )
        )
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_participant(uuid) FROM PUBLIC, anon;
