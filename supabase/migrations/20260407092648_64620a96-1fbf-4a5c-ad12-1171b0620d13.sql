
-- =============================================
-- PHASE 1: FULL SCHEMA EXPANSION
-- =============================================

-- 1. NEW ENUMS
-- =============================================

-- Expand incident_status with new values
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'supervisor_review';
ALTER TYPE public.incident_status ADD VALUE IF NOT EXISTS 'compliance_review';

-- Risk status
CREATE TYPE public.risk_status AS ENUM ('open', 'assessed', 'mitigating', 'monitoring', 'closed');

-- Safeguarding
CREATE TYPE public.safeguarding_status AS ENUM ('raised', 'screened', 'action_required', 'monitoring', 'resolved', 'closed');
CREATE TYPE public.safeguarding_concern_type AS ENUM ('distress', 'abuse_concern', 'neglect_concern', 'exploitation', 'digital_safety', 'self_harm', 'behavioural_change', 'isolation', 'other');
CREATE TYPE public.safeguarding_source AS ENUM ('staff_observation', 'ai_alert', 'complaint', 'participant_disclosure', 'external_report');

-- Privacy
CREATE TYPE public.privacy_incident_status AS ENUM ('detected', 'contained', 'assessed', 'actioned', 'closed');
CREATE TYPE public.privacy_incident_type AS ENUM ('unauthorised_access', 'misdirected_email', 'lost_device', 'suspicious_login', 'oversharing', 'export_misuse', 'other');

-- Complaint enums
CREATE TYPE public.complaint_category AS ENUM ('service_quality', 'staff_conduct', 'delay', 'communication', 'privacy', 'safeguarding', 'billing', 'other');
CREATE TYPE public.complaint_source_type AS ENUM ('participant', 'family', 'advocate', 'staff', 'external');
CREATE TYPE public.submission_channel AS ENUM ('phone', 'email', 'web_form', 'in_person', 'other');

-- Incident enums
CREATE TYPE public.environment_type AS ENUM ('office', 'remote', 'digital_platform', 'phone_call', 'other');
CREATE TYPE public.incident_category AS ENUM ('injury', 'emotional_distress', 'abuse_allegation', 'neglect_concern', 'privacy_breach', 'behavioural_event', 'service_disruption', 'other');

-- Shared
CREATE TYPE public.escalation_level AS ENUM ('monitor', 'urgent_review', 'immediate_intervention');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- 2. EXPAND INCIDENTS TABLE
-- =============================================
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS date_of_incident date,
  ADD COLUMN IF NOT EXISTS time_of_incident time,
  ADD COLUMN IF NOT EXISTS date_reported date,
  ADD COLUMN IF NOT EXISTS reporter_role text,
  ADD COLUMN IF NOT EXISTS incident_location text,
  ADD COLUMN IF NOT EXISTS environment text DEFAULT 'office',
  ADD COLUMN IF NOT EXISTS incident_category text,
  ADD COLUMN IF NOT EXISTS sub_category text,
  ADD COLUMN IF NOT EXISTS participant_harmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS staff_harmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_attention_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_service_contacted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS incident_summary text,
  ADD COLUMN IF NOT EXISTS immediate_action_taken text,
  ADD COLUMN IF NOT EXISTS current_participant_condition text,
  ADD COLUMN IF NOT EXISTS ai_suggested_classification text,
  ADD COLUMN IF NOT EXISTS supervisor_classification text,
  ADD COLUMN IF NOT EXISTS reportable_reason text,
  ADD COLUMN IF NOT EXISTS investigation_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_investigator uuid,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS contributing_factors text,
  ADD COLUMN IF NOT EXISTS corrective_actions text,
  ADD COLUMN IF NOT EXISTS preventive_actions text,
  ADD COLUMN IF NOT EXISTS participant_followup_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS outcome_summary text,
  ADD COLUMN IF NOT EXISTS closure_recommendation text,
  ADD COLUMN IF NOT EXISTS witnesses jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS other_persons_involved jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linked_staff_id uuid;

-- 3. EXPAND RISKS TABLE
-- =============================================
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS date_identified date,
  ADD COLUMN IF NOT EXISTS linked_participant_id uuid REFERENCES public.participants(id),
  ADD COLUMN IF NOT EXISTS linked_staff_id uuid,
  ADD COLUMN IF NOT EXISTS linked_incident_id uuid REFERENCES public.incidents(id),
  ADD COLUMN IF NOT EXISTS linked_complaint_id uuid REFERENCES public.complaints(id),
  ADD COLUMN IF NOT EXISTS likelihood_score integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS impact_score integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS risk_score integer GENERATED ALWAYS AS (likelihood_score * impact_score) STORED,
  ADD COLUMN IF NOT EXISTS risk_level text,
  ADD COLUMN IF NOT EXISTS existing_controls text,
  ADD COLUMN IF NOT EXISTS review_date date,
  ADD COLUMN IF NOT EXISTS escalation_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS residual_risk_score integer;

-- 4. EXPAND COMPLAINTS TABLE
-- =============================================
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS complaint_source text,
  ADD COLUMN IF NOT EXISTS submission_channel text,
  ADD COLUMN IF NOT EXISTS complainant_name text,
  ADD COLUMN IF NOT EXISTS anonymous boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS complaint_category text,
  ADD COLUMN IF NOT EXISTS requested_outcome text,
  ADD COLUMN IF NOT EXISTS immediate_risk_identified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_handler uuid,
  ADD COLUMN IF NOT EXISTS acknowledgement_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS investigation_summary text,
  ADD COLUMN IF NOT EXISTS resolution_actions text,
  ADD COLUMN IF NOT EXISTS outcome_communicated_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS final_outcome text;

-- 5. EXPAND STAFF_COMPLIANCE TABLE
-- =============================================
ALTER TABLE public.staff_compliance
  ADD COLUMN IF NOT EXISTS identity_verification boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mandatory_induction boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS worker_orientation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cyber_safety_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS incident_mgmt_training boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS safeguarding_training boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS code_of_conduct_acknowledged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS code_of_conduct_date date,
  ADD COLUMN IF NOT EXISTS restrictions_notes text,
  ADD COLUMN IF NOT EXISTS eligible_for_assignment boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS ndis_screening_required boolean DEFAULT true;

-- 6. EXPAND POLICIES TABLE
-- =============================================
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS policy_text text,
  ADD COLUMN IF NOT EXISTS linked_training_module_id uuid REFERENCES public.training_modules(id),
  ADD COLUMN IF NOT EXISTS staff_acknowledgement_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS acknowledgement_due_date date;

-- 7. NEW TABLE: safeguarding_concerns
-- =============================================
CREATE TABLE public.safeguarding_concerns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  team_id uuid REFERENCES public.teams(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  raised_by uuid NOT NULL,
  date_raised date NOT NULL DEFAULT CURRENT_DATE,
  concern_type public.safeguarding_concern_type NOT NULL DEFAULT 'other',
  source public.safeguarding_source NOT NULL DEFAULT 'staff_observation',
  detailed_description text,
  immediate_safety_risk boolean DEFAULT false,
  immediate_action_taken text,
  supervisor_notified boolean DEFAULT false,
  escalation_level public.escalation_level DEFAULT 'monitor',
  support_actions text,
  linked_incident_id uuid REFERENCES public.incidents(id),
  linked_complaint_id uuid REFERENCES public.complaints(id),
  linked_risk_id uuid REFERENCES public.risks(id),
  review_notes text,
  outcome text,
  ai_confidence_score numeric,
  status public.safeguarding_status NOT NULL DEFAULT 'raised',
  sensitivity_level public.sensitivity_level NOT NULL DEFAULT 'highly_sensitive',
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.safeguarding_concerns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins view safeguarding" ON public.safeguarding_concerns
  FOR SELECT TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role]));

CREATE POLICY "Supervisors view team safeguarding" ON public.safeguarding_concerns
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role) AND team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Staff view own raised" ON public.safeguarding_concerns
  FOR SELECT TO authenticated
  USING (raised_by = auth.uid());

CREATE POLICY "Staff create safeguarding" ON public.safeguarding_concerns
  FOR INSERT TO authenticated
  WITH CHECK (raised_by = auth.uid() AND organisation_id = get_user_organisation_id(auth.uid()));

CREATE POLICY "Admins manage safeguarding" ON public.safeguarding_concerns
  FOR UPDATE TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role]));

CREATE TRIGGER update_safeguarding_updated_at BEFORE UPDATE ON public.safeguarding_concerns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8. NEW TABLE: privacy_incidents
-- =============================================
CREATE TABLE public.privacy_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  team_id uuid REFERENCES public.teams(id),
  detected_by uuid NOT NULL,
  date_detected date NOT NULL DEFAULT CURRENT_DATE,
  incident_type public.privacy_incident_type NOT NULL DEFAULT 'other',
  data_type_involved text[] DEFAULT '{}',
  affected_records_count integer DEFAULT 0,
  affected_participants jsonb DEFAULT '[]'::jsonb,
  affected_staff jsonb DEFAULT '[]'::jsonb,
  breach_description text,
  containment_action text,
  access_source text,
  geolocation_flag text,
  risk_rating text DEFAULT 'medium',
  notification_required boolean DEFAULT false,
  notification_completed_date timestamp with time zone,
  corrective_action text,
  status public.privacy_incident_status NOT NULL DEFAULT 'detected',
  sensitivity_level public.sensitivity_level NOT NULL DEFAULT 'highly_sensitive',
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.privacy_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view privacy incidents" ON public.privacy_incidents
  FOR SELECT TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role]));

CREATE POLICY "Creator view own privacy incidents" ON public.privacy_incidents
  FOR SELECT TO authenticated
  USING (detected_by = auth.uid());

CREATE POLICY "Staff create privacy incidents" ON public.privacy_incidents
  FOR INSERT TO authenticated
  WITH CHECK (detected_by = auth.uid() AND organisation_id = get_user_organisation_id(auth.uid()));

CREATE POLICY "Admins manage privacy incidents" ON public.privacy_incidents
  FOR UPDATE TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role]));

CREATE TRIGGER update_privacy_incidents_updated_at BEFORE UPDATE ON public.privacy_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 9. NEW TABLE: policy_acknowledgements
-- =============================================
CREATE TABLE public.policy_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.policies(id),
  user_id uuid NOT NULL,
  acknowledged_at timestamp with time zone,
  due_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.policy_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view acknowledgements" ON public.policy_acknowledgements
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'hr_admin'::app_role]));

CREATE POLICY "Users view own acknowledgements" ON public.policy_acknowledgements
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create own acknowledgements" ON public.policy_acknowledgements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own acknowledgements" ON public.policy_acknowledgements
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 10. NEW TABLE: tasks
-- =============================================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  title text NOT NULL,
  description text,
  task_type text DEFAULT 'general',
  source_module text,
  source_record_id uuid,
  assigned_to uuid,
  created_by uuid NOT NULL,
  due_date date,
  priority text DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'pending',
  notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view org tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role]));

CREATE POLICY "Users view assigned or created tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Users create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND organisation_id = get_user_organisation_id(auth.uid()));

CREATE POLICY "Users update own or assigned tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 11. NEW TABLE: incident_actions
-- =============================================
CREATE TABLE public.incident_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id),
  action_type text NOT NULL DEFAULT 'corrective',
  description text NOT NULL,
  assigned_to uuid,
  created_by uuid NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View incident actions" ON public.incident_actions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM incidents i
    WHERE i.id = incident_actions.incident_id
    AND (
      (i.organisation_id = get_user_organisation_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role]))
      OR i.reported_by = auth.uid()
    )
  ));

CREATE POLICY "Create incident actions" ON public.incident_actions
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Update incident actions" ON public.incident_actions
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE TRIGGER update_incident_actions_updated_at BEFORE UPDATE ON public.incident_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 12. AUDIT TRAIL TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.audit_trail_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _module text;
  _org_id uuid;
  _details jsonb;
  _user_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _details := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
    _details := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  END IF;

  _module := TG_TABLE_NAME;

  -- Try to get org_id from the record
  IF NEW ? 'organisation_id' THEN
    _org_id := (NEW->>'organisation_id')::uuid;
  END IF;

  -- Get user name
  SELECT full_name INTO _user_name FROM public.user_profiles WHERE id = auth.uid();

  INSERT INTO public.audit_logs (user_id, user_name, action, module, record_id, organisation_id, details, severity)
  VALUES (
    auth.uid(),
    _user_name,
    _action,
    _module,
    CASE WHEN NEW ? 'id' THEN (NEW->>'id')::uuid ELSE NULL END,
    _org_id,
    _details,
    'normal'
  );

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Apply audit triggers to key tables
CREATE TRIGGER audit_incidents AFTER INSERT OR UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

CREATE TRIGGER audit_risks AFTER INSERT OR UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

CREATE TRIGGER audit_complaints AFTER INSERT OR UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

CREATE TRIGGER audit_safeguarding AFTER INSERT OR UPDATE ON public.safeguarding_concerns
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

CREATE TRIGGER audit_privacy_incidents AFTER INSERT OR UPDATE ON public.privacy_incidents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

CREATE TRIGGER audit_policies AFTER INSERT OR UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

CREATE TRIGGER audit_staff_compliance AFTER INSERT OR UPDATE ON public.staff_compliance
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

CREATE TRIGGER audit_participants AFTER INSERT OR UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.safeguarding_concerns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.privacy_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
