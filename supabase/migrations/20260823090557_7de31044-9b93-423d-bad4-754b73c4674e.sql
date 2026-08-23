
-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'platform_super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('tenant_admin','super_admin','compliance_officer'));
$$;

-- ============ organisations extensions ============
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS trading_name text,
  ADD COLUMN IF NOT EXISTS acn text,
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS primary_contact_phone text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS suburb text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS pathway_id uuid,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

UPDATE public.organisations SET is_demo = true WHERE created_at < now();

DROP POLICY IF EXISTS "Platform admin manages organisations" ON public.organisations;
CREATE POLICY "Platform admin manages organisations" ON public.organisations
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ============ subscription_packages ============
CREATE TABLE IF NOT EXISTS public.subscription_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  included_users integer,
  unlimited_users boolean NOT NULL DEFAULT false,
  module_entitlements text[] NOT NULL DEFAULT '{}',
  trial_days integer NOT NULL DEFAULT 14,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, version)
);
GRANT SELECT, INSERT, UPDATE ON public.subscription_packages TO authenticated;
GRANT ALL ON public.subscription_packages TO service_role;
ALTER TABLE public.subscription_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin manages packages" ON public.subscription_packages
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ============ provider pathways ============
CREATE TABLE IF NOT EXISTS public.provider_pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_pathways TO authenticated;
GRANT ALL ON public.provider_pathways TO service_role;
ALTER TABLE public.provider_pathways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read pathways" ON public.provider_pathways FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admin manages pathways" ON public.provider_pathways
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.pathway_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL REFERENCES public.provider_pathways(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  requirement_key text NOT NULL,
  label text NOT NULL,
  help_text text,
  field_type text NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_mandatory boolean NOT NULL DEFAULT true,
  requires_document boolean NOT NULL DEFAULT false,
  requires_expiry boolean NOT NULL DEFAULT false,
  conditional_on jsonb,
  sensitivity sensitivity_level NOT NULL DEFAULT 'internal',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pathway_id, requirement_key)
);
GRANT SELECT ON public.pathway_requirements TO authenticated;
GRANT ALL ON public.pathway_requirements TO service_role;
ALTER TABLE public.pathway_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read pathway requirements" ON public.pathway_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admin manages pathway requirements" ON public.pathway_requirements
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

ALTER TABLE public.organisations
  ADD CONSTRAINT organisations_pathway_fk FOREIGN KEY (pathway_id) REFERENCES public.provider_pathways(id);

-- ============ tenant_subscriptions ============
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.subscription_packages(id),
  status text NOT NULL DEFAULT 'trial',
  trial_start_date date,
  trial_end_date date,
  current_period_start date,
  current_period_end date,
  renewal_date date,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  seats_included integer,
  unlimited_users boolean NOT NULL DEFAULT false,
  manual_payment_status text NOT NULL DEFAULT 'not_invoiced',
  internal_notes text,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_org ON public.tenant_subscriptions(organisation_id);
GRANT SELECT, INSERT, UPDATE ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin manages subscriptions" ON public.tenant_subscriptions
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Tenant admin reads own subscription" ON public.tenant_subscriptions
  FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_tenant_admin());

-- ============ organisation_onboarding ============
CREATE TABLE IF NOT EXISTS public.organisation_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL UNIQUE REFERENCES public.organisations(id) ON DELETE CASCADE,
  pathway_id uuid REFERENCES public.provider_pathways(id),
  status text NOT NULL DEFAULT 'not_started',
  current_step text NOT NULL DEFAULT 'welcome',
  completed_steps text[] NOT NULL DEFAULT '{}',
  progress_pct integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  submitted_by uuid,
  reviewed_at timestamptz,
  reviewed_by uuid,
  approved_at timestamptz,
  returned_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organisation_onboarding TO authenticated;
GRANT ALL ON public.organisation_onboarding TO service_role;
ALTER TABLE public.organisation_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin manages onboarding" ON public.organisation_onboarding
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Tenant reads own onboarding" ON public.organisation_onboarding
  FOR SELECT TO authenticated USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY "Tenant admin updates own onboarding" ON public.organisation_onboarding
  FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_tenant_admin())
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_tenant_admin());

CREATE TABLE IF NOT EXISTS public.onboarding_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  onboarding_id uuid NOT NULL REFERENCES public.organisation_onboarding(id) ON DELETE CASCADE,
  requirement_key text NOT NULL,
  step_key text NOT NULL,
  value_text text,
  value_number numeric,
  value_bool boolean,
  value_date date,
  value_json jsonb,
  is_masked boolean NOT NULL DEFAULT false,
  answered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (onboarding_id, requirement_key)
);
CREATE INDEX IF NOT EXISTS idx_onboarding_answers_org ON public.onboarding_answers(organisation_id);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_answers TO authenticated;
GRANT ALL ON public.onboarding_answers TO service_role;
ALTER TABLE public.onboarding_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin reads answers" ON public.onboarding_answers
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Tenant admin manages own answers" ON public.onboarding_answers
  FOR ALL TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_tenant_admin())
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_tenant_admin());

-- ============ organisation_documents ============
CREATE TABLE IF NOT EXISTS public.organisation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  requirement_key text,
  document_type text NOT NULL,
  title text NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  issue_date date,
  expiry_date date,
  verification_status text NOT NULL DEFAULT 'pending',
  verified_by uuid,
  verified_at timestamptz,
  verification_notes text,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.organisation_documents(id),
  sensitivity sensitivity_level NOT NULL DEFAULT 'controlled',
  is_critical boolean NOT NULL DEFAULT false,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_documents_org ON public.organisation_documents(organisation_id);
GRANT SELECT, INSERT, UPDATE ON public.organisation_documents TO authenticated;
GRANT ALL ON public.organisation_documents TO service_role;
ALTER TABLE public.organisation_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin manages org documents" ON public.organisation_documents
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Tenant reads own documents" ON public.organisation_documents
  FOR SELECT TO authenticated USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY "Tenant admin uploads own documents" ON public.organisation_documents
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_tenant_admin() AND uploaded_by = auth.uid());
CREATE POLICY "Tenant admin updates own unverified documents" ON public.organisation_documents
  FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_tenant_admin() AND verification_status <> 'verified')
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_tenant_admin());

-- ============ onboarding_review_findings ============
CREATE TABLE IF NOT EXISTS public.onboarding_review_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  onboarding_id uuid NOT NULL REFERENCES public.organisation_onboarding(id) ON DELETE CASCADE,
  requirement_key text NOT NULL,
  decision text NOT NULL DEFAULT 'pending',
  reviewer_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (onboarding_id, requirement_key)
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_review_findings TO authenticated;
GRANT ALL ON public.onboarding_review_findings TO service_role;
ALTER TABLE public.onboarding_review_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin manages findings" ON public.onboarding_review_findings
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Tenant reads own findings" ON public.onboarding_review_findings
  FOR SELECT TO authenticated USING (organisation_id = public.get_user_organisation_id(auth.uid()));

-- ============ organisation_module_entitlements ============
CREATE TABLE IF NOT EXISTS public.organisation_module_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'package',
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, module_key)
);
GRANT SELECT, INSERT, UPDATE ON public.organisation_module_entitlements TO authenticated;
GRANT ALL ON public.organisation_module_entitlements TO service_role;
ALTER TABLE public.organisation_module_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin manages entitlements" ON public.organisation_module_entitlements
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Tenant reads own entitlements" ON public.organisation_module_entitlements
  FOR SELECT TO authenticated USING (organisation_id = public.get_user_organisation_id(auth.uid()));

-- ============ organisation_invitations ============
CREATE TABLE IF NOT EXISTS public.organisation_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role app_role NOT NULL DEFAULT 'tenant_admin',
  status text NOT NULL DEFAULT 'pending',
  token_hash text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  send_attempts integer NOT NULL DEFAULT 1,
  failure_reason text,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organisation_invitations(organisation_id);
GRANT SELECT, INSERT, UPDATE ON public.organisation_invitations TO authenticated;
GRANT ALL ON public.organisation_invitations TO service_role;
ALTER TABLE public.organisation_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin manages invitations" ON public.organisation_invitations
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "Tenant admin reads own invitations" ON public.organisation_invitations
  FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_tenant_admin());

-- ============ platform_support_sessions ============
CREATE TABLE IF NOT EXISTS public.platform_support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  reason text NOT NULL,
  scope text NOT NULL DEFAULT 'read_only',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.platform_support_sessions TO authenticated;
GRANT ALL ON public.platform_support_sessions TO service_role;
ALTER TABLE public.platform_support_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin manages support sessions" ON public.platform_support_sessions
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin() AND requested_by = auth.uid());
CREATE POLICY "Tenant admin sees support sessions on own org" ON public.platform_support_sessions
  FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_tenant_admin());

-- ============ platform_activity_events ============
CREATE TABLE IF NOT EXISTS public.platform_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_label text,
  event_type text NOT NULL,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_events_created ON public.platform_activity_events(created_at DESC);
GRANT SELECT, INSERT ON public.platform_activity_events TO authenticated;
GRANT ALL ON public.platform_activity_events TO service_role;
ALTER TABLE public.platform_activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin reads all events" ON public.platform_activity_events
  FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY "Authenticated logs own events" ON public.platform_activity_events
  FOR INSERT TO authenticated WITH CHECK (actor_user_id = auth.uid());

-- ============ platform_income_records ============
CREATE TABLE IF NOT EXISTS public.platform_income_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  record_type text NOT NULL DEFAULT 'invoice',
  reference text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AUD',
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  received_date date,
  status text NOT NULL DEFAULT 'issued',
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.platform_income_records TO authenticated;
GRANT ALL ON public.platform_income_records TO service_role;
ALTER TABLE public.platform_income_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin manages income" ON public.platform_income_records
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ============ updated_at triggers ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['subscription_packages','provider_pathways','pathway_requirements','tenant_subscriptions','organisation_onboarding','onboarding_answers','organisation_documents','onboarding_review_findings','organisation_module_entitlements','organisation_invitations','platform_support_sessions','platform_income_records']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t);
  END LOOP;
END $$;

-- ============ seed packages ============
INSERT INTO public.subscription_packages (code, name, description, monthly_price, included_users, unlimited_users, module_entitlements, trial_days, version)
VALUES
 ('starter','Starter','Admin plus 2 staff members.',29.00,3,false,ARRAY['dashboard','incidents','participants','staff','training','service_delivery'],14,1),
 ('growth','Growth','Up to 10 users with full operational modules.',99.00,10,false,ARRAY['dashboard','incidents','risks','complaints','policies','participants','participant_care','staff','training','service_delivery','service_approvals','service_operations','safeguarding'],14,1),
 ('unlimited','Unlimited','Unlimited users and all modules.',299.00,NULL,true,ARRAY['dashboard','incidents','risks','complaints','policies','participants','participant_care','medication','staff','staff_enrollment','training','audit','safeguarding','privacy','safe_environment','sil','restrictive_practices','governance','controls','competency','evidence_room','service_delivery','service_approvals','service_operations','settings'],14,1)
ON CONFLICT (code, version) DO NOTHING;

-- ============ seed electrician pathway ============
INSERT INTO public.provider_pathways (code, name, description)
VALUES ('electrician_trade','Electrician / Trade Contractor','Onboarding pathway for electrical and trade contracting providers.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.pathway_requirements (pathway_id, step_key, requirement_key, label, help_text, field_type, is_mandatory, requires_document, requires_expiry, conditional_on, sensitivity, sort_order)
SELECT p.id, r.step_key, r.requirement_key, r.label, r.help_text, r.field_type, r.is_mandatory, r.requires_document, r.requires_expiry, r.conditional_on, r.sensitivity::sensitivity_level, r.sort_order
FROM public.provider_pathways p
CROSS JOIN (VALUES
 ('business','legal_name','Registered legal name','As registered with ASIC.','text',true,false,false,NULL::jsonb,'internal',10),
 ('business','trading_name','Trading name','Leave blank if the same as the legal name.','text',false,false,false,NULL,'internal',20),
 ('business','abn','ABN','11 digits. We validate the ABN checksum only.','text',true,false,false,NULL,'internal',30),
 ('business','acn','ACN','Companies only.','text',false,false,false,NULL,'internal',40),
 ('business','business_address','Business address','Street, suburb, state, postcode.','textarea',true,false,false,NULL,'internal',50),
 ('business','business_phone','Business phone','Best contact number during business hours.','text',true,false,false,NULL,'internal',60),
 ('business','directors','Directors and key personnel','Names and roles. Dates of birth are stored masked and only revealed with an audit-logged reason.','textarea',true,false,false,NULL,'sensitive',70),
 ('licences','electrical_licence_number','Electrical contractor licence number',NULL,'text',true,true,true,NULL,'controlled',10),
 ('licences','electrical_licence_state','Licence issuing state/territory',NULL,'select',true,false,false,NULL,'internal',20),
 ('licences','public_liability_insurer','Public liability insurer',NULL,'text',true,false,false,NULL,'controlled',30),
 ('licences','public_liability_policy','Public liability policy number',NULL,'text',true,true,true,NULL,'controlled',40),
 ('licences','public_liability_cover','Public liability cover amount','Enter the cover your policy actually provides. Required cover varies by contract and jurisdiction.','number',true,false,false,NULL,'controlled',50),
 ('licences','has_employees','Do you employ staff (not just subcontractors)?',NULL,'boolean',true,false,false,NULL,'internal',60),
 ('licences','workers_comp_policy','Workers compensation policy number','Required when you employ staff.','text',false,true,true,'{"requirement_key":"has_employees","equals":true}','controlled',70),
 ('workforce','worker_screening_details','NDIS worker screening','Clearance numbers and expiry for workers in risk-assessed roles. Stored masked.','textarea',true,true,true,NULL,'sensitive',10),
 ('workforce','police_checks','National police checks','Held for relevant personnel. Stored masked.','textarea',true,true,true,NULL,'sensitive',20),
 ('workforce','works_with_children','Do any workers engage with participants under 18?',NULL,'boolean',true,false,false,NULL,'internal',30),
 ('workforce','wwcc_details','Working with Children Check details','Required when workers engage with participants under 18.','textarea',false,true,true,'{"requirement_key":"works_with_children","equals":true}','sensitive',40),
 ('workforce','employee_count','Number of employees',NULL,'number',true,false,false,NULL,'internal',50),
 ('workforce','subcontractor_count','Number of subcontractors',NULL,'number',true,false,false,NULL,'internal',60),
 ('services','registration_groups','Registration groups you intend to deliver','Suggestions only. Every selection is verified by our team before activation — this is not legal advice.','multiselect',true,false,false,NULL,'internal',10),
 ('services','service_regions','Service regions',NULL,'text',true,false,false,NULL,'internal',20),
 ('operations','job_workflow','How are jobs scheduled and assigned?',NULL,'textarea',true,false,false,NULL,'internal',10),
 ('operations','safety_workflow','Safety and incident reporting process',NULL,'textarea',true,false,false,NULL,'internal',20),
 ('operations','certificate_workflow','Compliance certificate issuing process','How electrical safety/compliance certificates are produced and retained.','textarea',true,false,false,NULL,'internal',30)
) AS r(step_key, requirement_key, label, help_text, field_type, is_mandatory, requires_document, requires_expiry, conditional_on, sensitivity, sort_order)
WHERE p.code = 'electrician_trade'
ON CONFLICT (pathway_id, requirement_key) DO NOTHING;

-- ============ platform aggregate function (server-side role check) ============
CREATE OR REPLACE FUNCTION public.platform_dashboard_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT jsonb_build_object(
    'tenants', (SELECT count(*) FROM public.organisations WHERE is_demo = false),
    'demo_tenants', (SELECT count(*) FROM public.organisations WHERE is_demo),
    'trials', (SELECT count(*) FROM public.tenant_subscriptions WHERE status = 'trial'),
    'active', (SELECT count(*) FROM public.tenant_subscriptions WHERE status = 'active'),
    'past_due', (SELECT count(*) FROM public.tenant_subscriptions WHERE status = 'past_due'),
    'suspended', (SELECT count(*) FROM public.tenant_subscriptions WHERE status = 'suspended'),
    'mrr', (SELECT COALESCE(sum(monthly_price),0) FROM public.tenant_subscriptions WHERE status IN ('active','past_due')),
    'income_received', (SELECT COALESCE(sum(amount),0) FROM public.platform_income_records WHERE status = 'received'),
    'onboarding_backlog', (SELECT count(*) FROM public.organisation_onboarding WHERE status = 'submitted'),
    'expiring_documents', (SELECT count(*) FROM public.organisation_documents WHERE is_critical AND expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + 60)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.platform_dashboard_summary() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_dashboard_summary() TO authenticated;
