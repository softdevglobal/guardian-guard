-- =============== corrective actions ===============
CREATE TABLE public.corrective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  reference text,
  action text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'internal',
  source_table text,
  source_record_id uuid,
  owner_id uuid,
  priority text NOT NULL DEFAULT 'medium',
  due_date date,
  evidence_required boolean NOT NULL DEFAULT false,
  evidence_document_id uuid REFERENCES public.organisation_documents(id) ON DELETE SET NULL,
  evidence_notes text,
  status text NOT NULL DEFAULT 'open',
  approved_by uuid,
  approved_at timestamptz,
  closure_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT corrective_actions_source_chk CHECK (source_type IN ('audit','incident','complaint','risk','policy_review','management_review','platform_review','internal')),
  CONSTRAINT corrective_actions_priority_chk CHECK (priority IN ('low','medium','high','critical')),
  CONSTRAINT corrective_actions_status_chk CHECK (status IN ('open','in_progress','awaiting_evidence','awaiting_approval','complete'))
);
CREATE INDEX idx_corrective_actions_org ON public.corrective_actions(organisation_id, status);
CREATE INDEX idx_corrective_actions_due ON public.corrective_actions(due_date);

GRANT SELECT, INSERT, UPDATE ON public.corrective_actions TO authenticated;
GRANT ALL ON public.corrective_actions TO service_role;
ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY corrective_actions_select ON public.corrective_actions FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY corrective_actions_insert ON public.corrective_actions FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['tenant_admin','super_admin','compliance_officer','supervisor','executive']::app_role[]));
CREATE POLICY corrective_actions_update ON public.corrective_actions FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['tenant_admin','super_admin','compliance_officer','supervisor','executive']::app_role[]))
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()));

CREATE TRIGGER trg_corrective_actions_updated BEFORE UPDATE ON public.corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_corrective_actions_audit AFTER INSERT OR UPDATE ON public.corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_corrective_actions_nodel BEFORE DELETE ON public.corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

-- =============== key personnel ===============
CREATE TABLE public.key_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  position text NOT NULL,
  role_type text NOT NULL DEFAULT 'key_personnel',
  email text,
  phone text,
  date_appointed date,
  worker_screening_number text,
  worker_screening_expiry date,
  police_check_date date,
  police_check_expiry date,
  qualifications text,
  experience_summary text,
  declarations text,
  evidence_document_id uuid REFERENCES public.organisation_documents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT key_personnel_role_chk CHECK (role_type IN ('director','owner','ceo','manager','responsible_person','key_personnel')),
  CONSTRAINT key_personnel_status_chk CHECK (status IN ('active','inactive'))
);
CREATE INDEX idx_key_personnel_org ON public.key_personnel(organisation_id);

GRANT SELECT, INSERT, UPDATE ON public.key_personnel TO authenticated;
GRANT ALL ON public.key_personnel TO service_role;
ALTER TABLE public.key_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY key_personnel_select ON public.key_personnel FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY key_personnel_insert ON public.key_personnel FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['tenant_admin','super_admin','compliance_officer','hr_admin','executive']::app_role[]));
CREATE POLICY key_personnel_update ON public.key_personnel FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['tenant_admin','super_admin','compliance_officer','hr_admin','executive']::app_role[]))
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()));

CREATE TRIGGER trg_key_personnel_updated BEFORE UPDATE ON public.key_personnel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_key_personnel_audit AFTER INSERT OR UPDATE ON public.key_personnel
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

-- =============== registration details on organisations ===============
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS registration_expiry date,
  ADD COLUMN IF NOT EXISTS registration_applied_at date,
  ADD COLUMN IF NOT EXISTS registration_audit_date date,
  ADD COLUMN IF NOT EXISTS registration_notes text;

ALTER TABLE public.organisations
  ADD CONSTRAINT organisations_registration_status_chk CHECK (registration_status IN
    ('not_started','preparing_application','application_submitted','audit_required','audit_booked','audit_completed','awaiting_commission','registered','renewal_due','registration_expired'));

-- =============== platform-assigned provider tasks ===============
CREATE TABLE public.platform_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  due_date date,
  evidence_required boolean NOT NULL DEFAULT true,
  evidence_document_id uuid REFERENCES public.organisation_documents(id) ON DELETE SET NULL,
  provider_response text,
  status text NOT NULL DEFAULT 'assigned',
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_tasks_status_chk CHECK (status IN ('assigned','in_progress','submitted','approved','correction_required'))
);
CREATE INDEX idx_platform_tasks_org ON public.platform_tasks(organisation_id, status);

GRANT SELECT, INSERT, UPDATE ON public.platform_tasks TO authenticated;
GRANT ALL ON public.platform_tasks TO service_role;
ALTER TABLE public.platform_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_tasks_select ON public.platform_tasks FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY platform_tasks_insert ON public.platform_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY platform_tasks_update ON public.platform_tasks FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid())
    OR (organisation_id = public.get_user_organisation_id(auth.uid())
        AND public.has_any_role(auth.uid(), ARRAY['tenant_admin','super_admin','compliance_officer']::app_role[])))
  WITH CHECK (public.is_platform_admin(auth.uid())
    OR organisation_id = public.get_user_organisation_id(auth.uid()));

CREATE TRIGGER trg_platform_tasks_updated BEFORE UPDATE ON public.platform_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_platform_tasks_audit AFTER INSERT OR UPDATE ON public.platform_tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

-- =============== trust portal ===============
CREATE TABLE public.provider_trust_portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL UNIQUE REFERENCES public.organisations(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT false,
  show_registration_status boolean NOT NULL DEFAULT true,
  show_insurance boolean NOT NULL DEFAULT true,
  show_worker_screening boolean NOT NULL DEFAULT true,
  show_policies_current boolean NOT NULL DEFAULT true,
  show_audit_readiness boolean NOT NULL DEFAULT true,
  contact_email text,
  intro_text text,
  published_snapshot jsonb,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_trust_portals_slug_chk CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$')
);

GRANT SELECT, INSERT, UPDATE ON public.provider_trust_portals TO authenticated;
GRANT SELECT ON public.provider_trust_portals TO anon;
GRANT ALL ON public.provider_trust_portals TO service_role;
ALTER TABLE public.provider_trust_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY trust_portal_public_read ON public.provider_trust_portals FOR SELECT TO anon
  USING (is_enabled = true AND published_at IS NOT NULL);
CREATE POLICY trust_portal_tenant_read ON public.provider_trust_portals FOR SELECT TO authenticated
  USING ((is_enabled = true AND published_at IS NOT NULL)
    OR organisation_id = public.get_user_organisation_id(auth.uid())
    OR public.is_platform_admin(auth.uid()));
CREATE POLICY trust_portal_insert ON public.provider_trust_portals FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['tenant_admin','super_admin','compliance_officer']::app_role[]));
CREATE POLICY trust_portal_update ON public.provider_trust_portals FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['tenant_admin','super_admin','compliance_officer']::app_role[]))
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()));

CREATE TRIGGER trg_trust_portal_updated BEFORE UPDATE ON public.provider_trust_portals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_trust_portal_audit AFTER INSERT OR UPDATE ON public.provider_trust_portals
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();