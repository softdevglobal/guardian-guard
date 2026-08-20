-- ============ Phase 1: Practice Standards Evidence Matrix ============

CREATE TYPE public.evidence_status AS ENUM ('missing', 'in_progress', 'ready', 'overdue');

-- ---------- Reference: standard modules ----------
CREATE TABLE public.standard_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_conditional boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.standard_modules TO authenticated;
GRANT ALL ON public.standard_modules TO service_role;
ALTER TABLE public.standard_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read standard modules" ON public.standard_modules FOR SELECT TO authenticated USING (true);

-- ---------- Reference: practice outcomes ----------
CREATE TABLE public.practice_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL REFERENCES public.standard_modules(code),
  outcome_code text NOT NULL UNIQUE,
  outcome_name text NOT NULL,
  part_name text,
  description text,
  registration_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.practice_outcomes TO authenticated;
GRANT ALL ON public.practice_outcomes TO service_role;
ALTER TABLE public.practice_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read practice outcomes" ON public.practice_outcomes FOR SELECT TO authenticated USING (true);

-- ---------- Registration groups (org scoped, admin confirmed) ----------
CREATE TABLE public.registration_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  code text NOT NULL,
  name text NOT NULL,
  is_confirmed boolean NOT NULL DEFAULT false,
  confirmed_by uuid,
  confirmed_at timestamptz,
  notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, code)
);
GRANT SELECT, INSERT, UPDATE ON public.registration_groups TO authenticated;
GRANT ALL ON public.registration_groups TO service_role;
ALTER TABLE public.registration_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read registration groups" ON public.registration_groups
  FOR SELECT TO authenticated USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY "Authorised roles can insert registration groups" ON public.registration_groups
  FOR INSERT TO authenticated WITH CHECK (
    organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[])
  );
CREATE POLICY "Authorised roles can update registration groups" ON public.registration_groups
  FOR UPDATE TO authenticated USING (
    organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive']::app_role[])
  );

-- ---------- Evidence requirements ----------
CREATE TABLE public.evidence_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  outcome_code text NOT NULL REFERENCES public.practice_outcomes(outcome_code),
  requirement_title text NOT NULL,
  quality_indicator text,
  required_evidence_type text NOT NULL,
  linked_policy_id uuid REFERENCES public.policies(id),
  linked_policy_version integer,
  owner_id uuid,
  review_date date,
  status public.evidence_status NOT NULL DEFAULT 'missing',
  auditor_notes text,
  include_in_export boolean NOT NULL DEFAULT true,
  requires_human_review boolean NOT NULL DEFAULT true,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.evidence_requirements TO authenticated;
GRANT ALL ON public.evidence_requirements TO service_role;
ALTER TABLE public.evidence_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read evidence requirements" ON public.evidence_requirements
  FOR SELECT TO authenticated USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY "Authorised roles can insert evidence requirements" ON public.evidence_requirements
  FOR INSERT TO authenticated WITH CHECK (
    organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive','supervisor']::app_role[])
  );
CREATE POLICY "Authorised roles can update evidence requirements" ON public.evidence_requirements
  FOR UPDATE TO authenticated USING (
    organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive','supervisor']::app_role[])
  );

-- ---------- Evidence requirement links ----------
CREATE TABLE public.evidence_requirement_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  requirement_id uuid NOT NULL REFERENCES public.evidence_requirements(id) ON DELETE RESTRICT,
  record_type text NOT NULL,
  record_id uuid,
  record_label text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.evidence_requirement_links TO authenticated;
GRANT ALL ON public.evidence_requirement_links TO service_role;
ALTER TABLE public.evidence_requirement_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read evidence links" ON public.evidence_requirement_links
  FOR SELECT TO authenticated USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY "Authorised roles can insert evidence links" ON public.evidence_requirement_links
  FOR INSERT TO authenticated WITH CHECK (
    organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive','supervisor']::app_role[])
  );
CREATE POLICY "Authorised roles can update evidence links" ON public.evidence_requirement_links
  FOR UPDATE TO authenticated USING (
    organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','executive','supervisor']::app_role[])
  );

-- ---------- Extend practice_standards with module / outcome reference ----------
ALTER TABLE public.practice_standards
  ADD COLUMN IF NOT EXISTS module_code text,
  ADD COLUMN IF NOT EXISTS outcome_reference text;

-- ---------- Triggers ----------
CREATE TRIGGER trg_reg_groups_updated_at BEFORE UPDATE ON public.registration_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_evidence_req_updated_at BEFORE UPDATE ON public.evidence_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_evidence_links_updated_at BEFORE UPDATE ON public.evidence_requirement_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_std_modules_updated_at BEFORE UPDATE ON public.standard_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_outcomes_updated_at BEFORE UPDATE ON public.practice_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- archive-not-delete
CREATE TRIGGER trg_no_delete_evidence_req BEFORE DELETE ON public.evidence_requirements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_no_delete_evidence_links BEFORE DELETE ON public.evidence_requirement_links
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();
CREATE TRIGGER trg_no_delete_reg_groups BEFORE DELETE ON public.registration_groups
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

-- audit trail
CREATE TRIGGER trg_audit_evidence_req AFTER INSERT OR UPDATE ON public.evidence_requirements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();
CREATE TRIGGER trg_audit_reg_groups AFTER INSERT OR UPDATE ON public.registration_groups
  FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger();

-- ---------- Readiness gate ----------
CREATE OR REPLACE FUNCTION public.enforce_evidence_ready_checks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_count integer;
BEGIN
  IF NEW.status = 'ready' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ready') THEN
    IF NEW.linked_policy_id IS NULL THEN
      RAISE EXCEPTION 'Cannot mark evidence requirement Ready: a linked policy is required.';
    END IF;
    SELECT count(*) INTO link_count FROM public.evidence_requirement_links WHERE requirement_id = NEW.id;
    IF link_count = 0 THEN
      RAISE EXCEPTION 'Cannot mark evidence requirement Ready: at least one linked evidence record is required.';
    END IF;
    IF NEW.review_date IS NULL OR NEW.review_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'Cannot mark evidence requirement Ready: a current (not past) review date is required.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evidence_ready_checks BEFORE INSERT OR UPDATE ON public.evidence_requirements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_evidence_ready_checks();

-- ---------- Seed: modules ----------
INSERT INTO public.standard_modules (code, name, description, is_conditional, sort_order) VALUES
 ('core','Core Module','Applies to all registered NDIS providers.', false, 1),
 ('medication','Core Module 4.3 — Management of Medication','Applies where the provider administers or assists with medication.', true, 2),
 ('mealtime','Core Module 4.4 — Mealtime Management','Applies where the provider supports participants with mealtime management needs.', true, 3),
 ('waste','Core Module 4.5 — Management of Waste','Applies where the provider handles clinical, hazardous or infectious waste.', true, 4),
 ('sil','Supported Independent Living (SIL)','Applies to registration group 0115/0138 supported independent living services.', true, 5);

-- ---------- Seed: 22 core outcomes ----------
INSERT INTO public.practice_outcomes (module_code, outcome_code, outcome_name, part_name, registration_groups, sort_order) VALUES
 ('core','1.1','Person-centred supports','Rights and Responsibilities','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',101),
 ('core','1.2','Individual values and beliefs','Rights and Responsibilities','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',102),
 ('core','1.3','Privacy and dignity','Rights and Responsibilities','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',103),
 ('core','1.4','Independence and informed choice','Rights and Responsibilities','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',104),
 ('core','1.5','Violence, abuse, neglect, exploitation and discrimination','Rights and Responsibilities','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',105),
 ('core','2.1','Governance and operational management','Governance and Operational Management','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',201),
 ('core','2.2','Risk management','Governance and Operational Management','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',202),
 ('core','2.3','Quality management','Governance and Operational Management','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',203),
 ('core','2.4','Information management','Governance and Operational Management','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',204),
 ('core','2.5','Feedback and complaints management','Governance and Operational Management','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',205),
 ('core','2.6','Incident management','Governance and Operational Management','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',206),
 ('core','2.7','Human resource management','Governance and Operational Management','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',207),
 ('core','2.8','Continuity of supports','Governance and Operational Management','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',208),
 ('core','2.9','Emergency and disaster management','Governance and Operational Management','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',209),
 ('core','3.1','Access to supports','Provision of Supports','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',301),
 ('core','3.2','Support planning','Provision of Supports','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',302),
 ('core','3.3','Service agreements with participants','Provision of Supports','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',303),
 ('core','3.4','Responsive support provision','Provision of Supports','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',304),
 ('core','3.5','Transitions to or from the provider','Provision of Supports','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',305),
 ('core','4.1','Safe environment','Provision of Supports Environment','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',401),
 ('core','4.2','Participant money and property','Provision of Supports Environment','["0107","0108","0109","0111","0115","0117","0120","0124","0133","0137","0138"]',402),
 ('core','4.4','Mealtime management','Provision of Supports Environment','["0115","0117","0120","0124","0138"]',404);

INSERT INTO public.practice_outcomes (module_code, outcome_code, outcome_name, part_name, registration_groups, sort_order) VALUES
 ('medication','4.3','Management of medication','Provision of Supports Environment','["0115","0117","0120","0124","0138"]',403),
 ('waste','4.5','Management of waste','Provision of Supports Environment','["0115","0117","0120","0124","0138"]',405),
 ('mealtime','4.4-M','Mealtime management (conditional module detail)','Mealtime Management','["0115","0117","0120","0124","0138"]',444),
 ('sil','SIL-1','Rights and tenancy — participants understand their tenancy rights and have an accessible copy','Supported Independent Living','["0115","0138"]',501),
 ('sil','SIL-2','Service agreement and tenancy agreement kept separate and not contingent on each other','Supported Independent Living','["0115","0138"]',502),
 ('sil','SIL-3','Privacy in the home — keys, private space and visitor preferences','Supported Independent Living','["0115","0138"]',503),
 ('sil','SIL-4','Co-tenant matching, consultation and vacancy decisions','Supported Independent Living','["0115","0138"]',504),
 ('sil','SIL-5','Shared-space decision making and conflict / safeguarding planning','Supported Independent Living','["0115","0138"]',505),
 ('sil','SIL-6','House emergency planning and drill records','Supported Independent Living','["0115","0138"]',506);

-- ---------- Seed: registration groups for existing organisations ----------
INSERT INTO public.registration_groups (organisation_id, code, name)
SELECT o.id, g.code, g.name
FROM public.organisations o
CROSS JOIN (VALUES
  ('0107','Daily Personal Activities'),
  ('0108','Assistance with Travel/Transport Arrangements'),
  ('0109','Household Tasks'),
  ('0111','Specialised Disability Accommodation (Non-SDA)'),
  ('0115','Assistance with Daily Life Tasks in a Group or Shared Living Arrangement'),
  ('0117','Development of Daily Living and Life Skills'),
  ('0120','Household Tasks / Home Maintenance'),
  ('0124','Participation in Community, Social and Civic Activities'),
  ('0133','Specialised Support Coordination'),
  ('0137','Group and Centre Based Activities'),
  ('0138','Supported Independent Living (Group/Shared Living)')
) AS g(code, name)
ON CONFLICT (organisation_id, code) DO NOTHING;

-- ---------- Seed: one evidence requirement per applicable outcome, per organisation ----------
INSERT INTO public.evidence_requirements (organisation_id, outcome_code, requirement_title, quality_indicator, required_evidence_type, status)
SELECT o.id,
       po.outcome_code,
       po.outcome_code || ' ' || po.outcome_name,
       'Documented policy, records and practice evidence demonstrating this outcome',
       'Policy + records + review',
       'missing'::public.evidence_status
FROM public.organisations o
CROSS JOIN public.practice_outcomes po;