
-- Create qualification_type enum
CREATE TYPE public.qualification_type AS ENUM ('qualification', 'licence', 'induction', 'certification');

-- Create controls_matrix table
CREATE TABLE public.controls_matrix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_standard_id UUID REFERENCES public.practice_standards(id) ON DELETE CASCADE NOT NULL,
  quality_indicator TEXT NOT NULL,
  linked_policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  workflow_module TEXT,
  evidence_table TEXT,
  evidence_description TEXT,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.controls_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage controls matrix"
  ON public.controls_matrix FOR ALL
  TO authenticated
  USING (
    organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role])
  );

CREATE POLICY "Staff view controls matrix"
  ON public.controls_matrix FOR SELECT
  TO authenticated
  USING (organisation_id = get_user_organisation_id(auth.uid()));

CREATE TRIGGER update_controls_matrix_updated_at
  BEFORE UPDATE ON public.controls_matrix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Alter certifications table
ALTER TABLE public.certifications
  ADD COLUMN qualification_type public.qualification_type DEFAULT 'certification',
  ADD COLUMN role_requirement JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  ADD COLUMN verified_by UUID,
  ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;

-- Alter policies table
ALTER TABLE public.policies
  ADD COLUMN linked_standard_id UUID REFERENCES public.practice_standards(id) ON DELETE SET NULL;
