
-- CAPA columns on incident_actions
ALTER TABLE public.incident_actions
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS corrective_action TEXT,
  ADD COLUMN IF NOT EXISTS preventive_action TEXT,
  ADD COLUMN IF NOT EXISTS effectiveness_review TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS capa_type TEXT NOT NULL DEFAULT 'corrective';

-- incident_training_links
CREATE TABLE public.incident_training_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL,
  training_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned',
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_training_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view training links"
  ON public.incident_training_links FOR SELECT TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()));

CREATE POLICY "Assigner creates training links"
  ON public.incident_training_links FOR INSERT TO authenticated
  WITH CHECK (assigned_by = auth.uid() AND organisation_id = get_user_organisation_id(auth.uid()));

CREATE POLICY "Admins update training links"
  ON public.incident_training_links FOR UPDATE TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'supervisor'::app_role]));

-- approvals
CREATE TABLE public.approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id UUID NOT NULL,
  required_role TEXT NOT NULL DEFAULT 'supervisor',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view approvals"
  ON public.approvals FOR SELECT TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()));

CREATE POLICY "Admins create approvals"
  ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'supervisor'::app_role]));

CREATE POLICY "Admins update approvals"
  ON public.approvals FOR UPDATE TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role, 'supervisor'::app_role]));

-- Prevent deletion on both new tables (archive-only policy)
CREATE OR REPLACE FUNCTION public.prevent_delete_training_links()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Deletion not allowed — archive only'; END; $$;

CREATE TRIGGER no_delete_training_links
  BEFORE DELETE ON public.incident_training_links
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_training_links();

CREATE OR REPLACE FUNCTION public.prevent_delete_approvals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Deletion not allowed — archive only'; END; $$;

CREATE TRIGGER no_delete_approvals
  BEFORE DELETE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_approvals();
