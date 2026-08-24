-- ============ SITES ============
CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  site_type text NOT NULL DEFAULT 'office',
  address_line1 text,
  suburb text,
  state text,
  postcode text,
  latitude numeric,
  longitude numeric,
  geofence_radius_metres integer NOT NULL DEFAULT 150,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sites_org ON public.sites(organisation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY sites_select ON public.sites FOR SELECT TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()));
CREATE POLICY sites_insert ON public.sites FOR INSERT TO authenticated
  WITH CHECK (organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin','tenant_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY sites_update ON public.sites FOR UPDATE TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin','tenant_admin','compliance_officer','supervisor']::app_role[]));

CREATE TRIGGER trg_sites_updated_at BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ WORKER PROFILES ============
CREATE TABLE public.worker_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  employment_type text NOT NULL DEFAULT 'casual',
  position text,
  award_classification text,
  pay_rate numeric(10,2),
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  skills text[] NOT NULL DEFAULT '{}',
  qualifications text[] NOT NULL DEFAULT '{}',
  screening_status text NOT NULL DEFAULT 'pending',
  employment_status text NOT NULL DEFAULT 'active',
  primary_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, user_id)
);
CREATE INDEX idx_worker_profiles_org ON public.worker_profiles(organisation_id);
CREATE INDEX idx_worker_profiles_user ON public.worker_profiles(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_profiles TO authenticated;
GRANT ALL ON public.worker_profiles TO service_role;
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY worker_profiles_select ON public.worker_profiles FOR SELECT TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid())
    AND (user_id = auth.uid()
      OR has_any_role(auth.uid(), ARRAY['super_admin','tenant_admin','compliance_officer','supervisor','hr_admin','executive']::app_role[])));
CREATE POLICY worker_profiles_insert ON public.worker_profiles FOR INSERT TO authenticated
  WITH CHECK (organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin','tenant_admin','compliance_officer','hr_admin']::app_role[]));
CREATE POLICY worker_profiles_update ON public.worker_profiles FOR UPDATE TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin','tenant_admin','compliance_officer','hr_admin']::app_role[]));

CREATE TRIGGER trg_worker_profiles_updated_at BEFORE UPDATE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ PARTICIPANT FUNDING ============
CREATE TABLE public.participant_funding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  support_category text NOT NULL,
  allocated_budget numeric(12,2) NOT NULL DEFAULT 0,
  committed_budget numeric(12,2) NOT NULL DEFAULT 0,
  claimed_amount numeric(12,2) NOT NULL DEFAULT 0,
  remaining_budget numeric(12,2) NOT NULL DEFAULT 0,
  service_rate numeric(10,2),
  plan_start_date date,
  plan_end_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_participant_funding_participant ON public.participant_funding(participant_id);
CREATE INDEX idx_participant_funding_org ON public.participant_funding(organisation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participant_funding TO authenticated;
GRANT ALL ON public.participant_funding TO service_role;
ALTER TABLE public.participant_funding ENABLE ROW LEVEL SECURITY;

CREATE POLICY participant_funding_select ON public.participant_funding FOR SELECT TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin','tenant_admin','compliance_officer','supervisor','executive']::app_role[]));
CREATE POLICY participant_funding_insert ON public.participant_funding FOR INSERT TO authenticated
  WITH CHECK (organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin','tenant_admin','compliance_officer']::app_role[]));
CREATE POLICY participant_funding_update ON public.participant_funding FOR UPDATE TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin','tenant_admin','compliance_officer']::app_role[]));

CREATE TRIGGER trg_participant_funding_updated_at BEFORE UPDATE ON public.participant_funding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.calc_participant_funding_remaining()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.remaining_budget := COALESCE(NEW.allocated_budget,0) - COALESCE(NEW.committed_budget,0) - COALESCE(NEW.claimed_amount,0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_participant_funding_remaining
  BEFORE INSERT OR UPDATE ON public.participant_funding
  FOR EACH ROW EXECUTE FUNCTION public.calc_participant_funding_remaining();

-- ============ PARTICIPANT ADDITIVE FIELDS ============
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS participant_number text,
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS funding_management_type text,
  ADD COLUMN IF NOT EXISTS plan_start_date date,
  ADD COLUMN IF NOT EXISTS plan_end_date date,
  ADD COLUMN IF NOT EXISTS communication_method text,
  ADD COLUMN IF NOT EXISTS cultural_preferences text,
  ADD COLUMN IF NOT EXISTS support_coordinator text,
  ADD COLUMN IF NOT EXISTS plan_manager text,
  ADD COLUMN IF NOT EXISTS emergency_contact jsonb;

-- ============ SHIFT SITE LINK ============
ALTER TABLE public.service_shifts
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;