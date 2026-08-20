-- ============ Phase 7-8: reportable incidents, restrictive practices, governance ============

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS reportable_status text NOT NULL DEFAULT 'requires_human_confirmation',
  ADD COLUMN IF NOT EXISTS reportable_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS immediate_safety_action text,
  ADD COLUMN IF NOT EXISTS affected_person_support text,
  ADD COLUMN IF NOT EXISTS participant_communication text;

-- Replace the auto-classification: never force a reportable determination from data alone.
CREATE OR REPLACE FUNCTION public.auto_set_ndis_deadline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _needs_assessment boolean;
BEGIN
  -- Guidance only: flag incidents that must be assessed by a human, and calculate the
  -- time-critical due date. This never sets is_reportable — only a Compliance Officer can.
  _needs_assessment :=
    NEW.severity IN ('high','critical')
    OR COALESCE(NEW.injury_involved, false)
    OR COALESCE(NEW.medical_attention_required, false)
    OR NEW.incident_category IN ('abuse_allegation','neglect_concern','privacy_breach');

  IF NEW.reportable_status IS NULL THEN
    NEW.reportable_status := 'requires_human_confirmation';
  END IF;

  IF _needs_assessment AND NEW.reportable_status = 'requires_human_confirmation' THEN
    IF NEW.reportable_due_at IS NULL THEN
      NEW.reportable_due_at := COALESCE(NEW.created_at, now()) +
        CASE WHEN NEW.severity = 'critical'
              OR NEW.incident_category IN ('abuse_allegation','neglect_concern')
             THEN interval '24 hours' ELSE interval '5 days' END;
    END IF;
    NEW.ndis_notification_deadline := COALESCE(NEW.ndis_notification_deadline, NEW.reportable_due_at);
  END IF;

  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_incident_closure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    IF NEW.root_cause IS NULL OR trim(NEW.root_cause) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: root_cause is required.';
    END IF;
    IF NEW.corrective_actions IS NULL OR trim(NEW.corrective_actions) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: corrective_actions are required.';
    END IF;
    IF NEW.description IS NULL OR trim(NEW.description) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: description is required.';
    END IF;
    IF NEW.participant_followup_completed IS NOT TRUE THEN
      RAISE EXCEPTION 'Cannot close incident: participant follow-up must be completed.';
    END IF;
    IF NEW.contributing_factors IS NULL OR trim(NEW.contributing_factors) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: contributing_factors are required.';
    END IF;
    IF NEW.immediate_safety_action IS NULL OR trim(NEW.immediate_safety_action) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: the immediate safety action taken must be recorded.';
    END IF;
    IF NEW.affected_person_support IS NULL OR trim(NEW.affected_person_support) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: the support provided to affected people must be recorded.';
    END IF;
    IF NEW.participant_communication IS NULL OR trim(NEW.participant_communication) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: communication with the participant or their representative must be recorded.';
    END IF;
    IF NEW.reportable_status = 'requires_human_confirmation' THEN
      RAISE EXCEPTION 'Cannot close incident: a Compliance Officer must complete the reportable incident assessment first.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TABLE public.reportable_incident_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  incident_id uuid NOT NULL REFERENCES public.incidents(id),
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence text,
  decision text NOT NULL,
  decision_rationale text NOT NULL,
  assessed_by uuid NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  notified_at timestamptz,
  notification_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reportable_incident_assessments TO authenticated;
GRANT ALL ON public.reportable_incident_assessments TO service_role;
ALTER TABLE public.reportable_incident_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ria_select ON public.reportable_incident_assessments FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY ria_insert ON public.reportable_incident_assessments FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND assessed_by = auth.uid()
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[]));
CREATE POLICY ria_update ON public.reportable_incident_assessments FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[]));

CREATE OR REPLACE FUNCTION public.apply_reportable_assessment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.decision NOT IN ('reportable','not_reportable') THEN
    RAISE EXCEPTION 'Reportable assessment decision must be either reportable or not_reportable.';
  END IF;
  IF trim(COALESCE(NEW.decision_rationale,'')) = '' THEN
    RAISE EXCEPTION 'A written rationale is required for the reportable incident decision.';
  END IF;

  UPDATE public.incidents
     SET is_reportable = (NEW.decision = 'reportable'),
         reportable_status = NEW.decision,
         reportable_reason = NEW.decision_rationale,
         ndis_notification_deadline = CASE WHEN NEW.decision = 'reportable'
                                           THEN COALESCE(NEW.due_at, ndis_notification_deadline)
                                           ELSE ndis_notification_deadline END
   WHERE id = NEW.incident_id;

  INSERT INTO public.audit_logs (user_id, action, module, record_id, organisation_id, severity, details)
  VALUES (NEW.assessed_by, 'reportable_incident_decision', 'incidents', NEW.incident_id, NEW.organisation_id,
          CASE WHEN NEW.decision = 'reportable' THEN 'critical' ELSE 'elevated' END,
          jsonb_build_object('decision', NEW.decision, 'rationale', NEW.decision_rationale, 'checklist', NEW.checklist));
  RETURN NEW;
END; $$;

-- ---------------- restrictive practices ----------------
CREATE TABLE public.restrictive_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  practice_type text NOT NULL,
  description text,
  is_authorised boolean NOT NULL DEFAULT false,
  authorisation_reference text,
  authorisation_expiry date,
  behaviour_support_plan_url text,
  behaviour_support_practitioner text,
  least_restrictive_review text,
  reduction_plan text,
  reporting_actions text,
  review_date date,
  status text NOT NULL DEFAULT 'draft',
  authorised_by uuid,
  authorised_at timestamptz,
  linked_incident_id uuid REFERENCES public.incidents(id),
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.restrictive_practices TO authenticated;
GRANT ALL ON public.restrictive_practices TO service_role;
ALTER TABLE public.restrictive_practices ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_select ON public.restrictive_practices FOR SELECT TO authenticated
  USING (public.can_access_participant(participant_id));
CREATE POLICY rp_insert ON public.restrictive_practices FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY rp_update ON public.restrictive_practices FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[]));

CREATE OR REPLACE FUNCTION public.enforce_restrictive_practice_authorisation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    IF NOT NEW.is_authorised OR NEW.authorisation_reference IS NULL THEN
      RAISE EXCEPTION 'A regulated restrictive practice cannot be activated without recorded state or territory authorisation.';
    END IF;
    IF NEW.behaviour_support_plan_url IS NULL OR trim(NEW.behaviour_support_plan_url) = '' THEN
      RAISE EXCEPTION 'A regulated restrictive practice requires an uploaded behaviour support plan.';
    END IF;
    IF NEW.least_restrictive_review IS NULL OR trim(NEW.least_restrictive_review) = '' THEN
      RAISE EXCEPTION 'A least-restrictive-alternative review must be documented.';
    END IF;
    IF NEW.review_date IS NULL THEN
      RAISE EXCEPTION 'A review date is required for an active restrictive practice.';
    END IF;
    IF NEW.authorised_by IS NULL
       OR NOT public.has_any_role(NEW.authorised_by, ARRAY['super_admin','compliance_officer']::app_role[]) THEN
      RAISE EXCEPTION 'A restrictive practice must be authorised by a named human Compliance Officer or administrator. Automated approval is not permitted.';
    END IF;
    NEW.authorised_at := COALESCE(NEW.authorised_at, now());
  END IF;
  RETURN NEW;
END; $$;

-- ---------------- governance ----------------
CREATE TABLE public.governance_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  meeting_type text NOT NULL DEFAULT 'governing_body',
  meeting_date date NOT NULL,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  agenda text,
  minutes text,
  decisions text,
  next_meeting_date date,
  recorded_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.governance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  meeting_id uuid REFERENCES public.governance_meetings(id),
  action text NOT NULL,
  owner_id uuid,
  due_date date,
  status text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.conflict_of_interest_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  user_id uuid NOT NULL,
  declaration_type text NOT NULL DEFAULT 'conflict_of_interest',
  has_conflict boolean NOT NULL DEFAULT false,
  description text,
  secondary_employment text,
  mitigation text,
  declared_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.internal_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  title text NOT NULL,
  scope text,
  module text,
  linked_outcome_code text,
  planned_date date,
  completed_date date,
  lead_auditor uuid,
  findings text,
  rating text,
  status text NOT NULL DEFAULT 'planned',
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.management_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  review_date date NOT NULL,
  period_covered text,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  discussion text,
  decisions text,
  actions text,
  chaired_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_position_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  position_title text NOT NULL,
  description text,
  required_qualifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_training jsonb NOT NULL DEFAULT '[]'::jsonb,
  worker_screening_required boolean NOT NULL DEFAULT true,
  ndis_orientation_required boolean NOT NULL DEFAULT true,
  supervision_frequency text,
  emergency_capability text,
  backup_arrangement text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.governance_meetings, public.governance_actions,
  public.conflict_of_interest_declarations, public.internal_audits, public.management_reviews,
  public.staff_position_requirements TO authenticated;
GRANT ALL ON public.governance_meetings, public.governance_actions,
  public.conflict_of_interest_declarations, public.internal_audits, public.management_reviews,
  public.staff_position_requirements TO service_role;

ALTER TABLE public.governance_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_of_interest_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_position_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY gm_select ON public.governance_meetings FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[]));
CREATE POLICY gm_insert ON public.governance_meetings FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[]));
CREATE POLICY gm_update ON public.governance_meetings FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[]));

CREATE POLICY ga_select ON public.governance_actions FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND (owner_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[])));
CREATE POLICY ga_insert ON public.governance_actions FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[]));
CREATE POLICY ga_update ON public.governance_actions FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND (owner_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[])));

CREATE POLICY coi_select ON public.conflict_of_interest_declarations FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR (organisation_id = public.get_user_organisation_id(auth.uid())
        AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin']::app_role[])));
CREATE POLICY coi_insert ON public.conflict_of_interest_declarations FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY coi_update ON public.conflict_of_interest_declarations FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','hr_admin']::app_role[]));

CREATE POLICY ia_select ON public.internal_audits FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[]));
CREATE POLICY ia_insert ON public.internal_audits FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[]));
CREATE POLICY ia_update ON public.internal_audits FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[]));

CREATE POLICY mr_select ON public.management_reviews FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[]));
CREATE POLICY mr_insert ON public.management_reviews FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[]));
CREATE POLICY mr_update ON public.management_reviews FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[]));

CREATE POLICY spr_select ON public.staff_position_requirements FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY spr_insert ON public.staff_position_requirements FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','hr_admin','compliance_officer']::app_role[]));
CREATE POLICY spr_update ON public.staff_position_requirements FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','hr_admin','compliance_officer']::app_role[]));

-- ---------------- triggers ----------------
CREATE TRIGGER trg_ria_apply AFTER INSERT ON public.reportable_incident_assessments FOR EACH ROW EXECUTE FUNCTION public.apply_reportable_assessment();
CREATE TRIGGER trg_ria_updated BEFORE UPDATE ON public.reportable_incident_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_rp_auth BEFORE INSERT OR UPDATE ON public.restrictive_practices FOR EACH ROW EXECUTE FUNCTION public.enforce_restrictive_practice_authorisation();
CREATE TRIGGER trg_rp_updated BEFORE UPDATE ON public.restrictive_practices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_gm_updated BEFORE UPDATE ON public.governance_meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ga_updated BEFORE UPDATE ON public.governance_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_coi_updated BEFORE UPDATE ON public.conflict_of_interest_declarations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ia_updated BEFORE UPDATE ON public.internal_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_mr_updated BEFORE UPDATE ON public.management_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_spr_updated BEFORE UPDATE ON public.staff_position_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_audit_ria AFTER INSERT OR UPDATE ON public.reportable_incident_assessments FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_rp AFTER INSERT OR UPDATE ON public.restrictive_practices FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_gm AFTER INSERT OR UPDATE ON public.governance_meetings FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_coi AFTER INSERT OR UPDATE ON public.conflict_of_interest_declarations FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_ia AFTER INSERT OR UPDATE ON public.internal_audits FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

CREATE TRIGGER trg_nodel_ria BEFORE DELETE ON public.reportable_incident_assessments FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_rp BEFORE DELETE ON public.restrictive_practices FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_gm BEFORE DELETE ON public.governance_meetings FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_ga BEFORE DELETE ON public.governance_actions FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_coi BEFORE DELETE ON public.conflict_of_interest_declarations FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_ia BEFORE DELETE ON public.internal_audits FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_nodel_mr BEFORE DELETE ON public.management_reviews FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

REVOKE EXECUTE ON FUNCTION public.apply_reportable_assessment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_restrictive_practice_authorisation() FROM PUBLIC, anon, authenticated;

-- ---------------- mandatory training matrix ----------------
INSERT INTO public.training_requirements (organisation_id, training_code, training_name, description, is_mandatory, validity_months, min_pass_score, required_for_roles)
SELECT o.id, t.code, t.name, t.descr, t.mandatory, t.months, 0, t.roles::jsonb
FROM public.organisations o
CROSS JOIN (VALUES
  ('NDIS_ORIENTATION','NDIS Worker Orientation Module','Quality, Safety and You orientation module.', true, 36, '["support_worker","supervisor","trainer","hr_admin","compliance_officer"]'),
  ('CODE_OF_CONDUCT','NDIS Code of Conduct','Obligations under the NDIS Code of Conduct.', true, 24, '["support_worker","supervisor","trainer","hr_admin","compliance_officer"]'),
  ('COMPLAINTS_MGMT','Complaints Management and Resolution','Accessible complaints handling and procedural fairness.', true, 24, '["support_worker","supervisor","compliance_officer"]'),
  ('PRIVACY_INFO','Privacy and Information Management','Privacy, confidentiality and information security obligations.', true, 24, '["support_worker","supervisor","trainer","hr_admin","compliance_officer"]'),
  ('INFECTION_PPE','Infection Prevention and PPE','Infection prevention, hand hygiene and correct PPE use.', true, 12, '["support_worker","supervisor","trainer"]'),
  ('CULTURAL_SAFETY','Cultural Safety and Responsiveness','Culturally safe and responsive support practice.', true, 36, '["support_worker","supervisor","trainer"]'),
  ('TRAUMA_INFORMED','Trauma-Informed Practice','Trauma-informed approaches to support.', true, 36, '["support_worker","supervisor","trainer"]'),
  ('SUPPORTED_DECISION','Supported Decision-Making','Supporting participant choice, control and dignity of risk.', true, 36, '["support_worker","supervisor","trainer"]'),
  ('PBS_TRAINING','Positive Behaviour Support','Positive behaviour support and restrictive practice obligations.', true, 24, '["support_worker","supervisor"]'),
  ('MEDICATION_MGMT','Medication Management (conditional)','Required only where medication support is delivered.', false, 12, '["support_worker","supervisor"]'),
  ('MEALTIME_MGMT','Mealtime Management (conditional)','Required only where mealtime support is delivered.', false, 12, '["support_worker","supervisor"]'),
  ('WASTE_MGMT','Waste and Hazardous Materials (conditional)','Required only where clinical or hazardous waste is handled.', false, 12, '["support_worker","supervisor"]')
) AS t(code, name, descr, mandatory, months, roles)
WHERE NOT EXISTS (
  SELECT 1 FROM public.training_requirements tr
  WHERE tr.organisation_id = o.id AND tr.training_code = t.code
);
