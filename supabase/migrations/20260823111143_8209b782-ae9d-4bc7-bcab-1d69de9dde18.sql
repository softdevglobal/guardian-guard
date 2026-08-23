
-- ============ 1. BUSINESS CATEGORIES ============
CREATE TABLE IF NOT EXISTS public.business_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  requires_ndis_registration boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_categories TO authenticated;
GRANT ALL ON public.business_categories TO service_role;
ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_categories_read" ON public.business_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "business_categories_admin" ON public.business_categories FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER business_categories_updated_at BEFORE UPDATE ON public.business_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ 2. SERVICE TYPES ============
CREATE TABLE IF NOT EXISTS public.service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_category_id uuid NOT NULL REFERENCES public.business_categories(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  high_risk boolean NOT NULL DEFAULT false,
  requires_registration_group boolean NOT NULL DEFAULT false,
  requires_clinical_governance boolean NOT NULL DEFAULT false,
  requires_participant_management boolean NOT NULL DEFAULT false,
  requires_worker_screening boolean NOT NULL DEFAULT false,
  requires_photos boolean NOT NULL DEFAULT false,
  supports_geolocation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_types TO authenticated;
GRANT ALL ON public.service_types TO service_role;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_types_read" ON public.service_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_types_admin" ON public.service_types FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER service_types_updated_at BEFORE UPDATE ON public.service_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ 3. ORGANISATION SERVICE SELECTIONS ============
CREATE TABLE IF NOT EXISTS public.organisation_service_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  business_category_id uuid NOT NULL REFERENCES public.business_categories(id),
  service_type_id uuid REFERENCES public.service_types(id),
  delivery_status text NOT NULL DEFAULT 'planned',
  ndis_funded boolean NOT NULL DEFAULT false,
  registered_service boolean NOT NULL DEFAULT false,
  commencement_date date,
  confirmed_by uuid,
  confirmed_at timestamptz,
  review_date date,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_service_selection_unique
  ON public.organisation_service_selections (organisation_id, business_category_id, COALESCE(service_type_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organisation_service_selections TO authenticated;
GRANT ALL ON public.organisation_service_selections TO service_role;
ALTER TABLE public.organisation_service_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oss_read_own_org" ON public.organisation_service_selections FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "oss_write_own_org" ON public.organisation_service_selections FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['tenant_admin','super_admin','compliance_officer']::app_role[]));
CREATE POLICY "oss_update_own_org" ON public.organisation_service_selections FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['tenant_admin','super_admin','compliance_officer']::app_role[]))
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY "oss_delete_own_org" ON public.organisation_service_selections FOR DELETE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['tenant_admin','super_admin']::app_role[]));
CREATE TRIGGER oss_updated_at BEFORE UPDATE ON public.organisation_service_selections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ 4. ONBOARDING PATHWAY RULES ============
CREATE TABLE IF NOT EXISTS public.onboarding_pathway_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_category_id uuid REFERENCES public.business_categories(id) ON DELETE CASCADE,
  service_type_id uuid REFERENCES public.service_types(id) ON DELETE CASCADE,
  question_definition_id uuid REFERENCES public.pathway_requirements(id) ON DELETE CASCADE,
  requirement_key text,
  step_key text,
  label text,
  field_type text NOT NULL DEFAULT 'text',
  requires_document boolean NOT NULL DEFAULT false,
  requires_expiry boolean NOT NULL DEFAULT false,
  required boolean NOT NULL DEFAULT true,
  condition_json jsonb,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.onboarding_pathway_rules TO authenticated;
GRANT ALL ON public.onboarding_pathway_rules TO service_role;
ALTER TABLE public.onboarding_pathway_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opr_read" ON public.onboarding_pathway_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "opr_admin" ON public.onboarding_pathway_rules FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER opr_updated_at BEFORE UPDATE ON public.onboarding_pathway_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ 5. COMPLIANCE REQUIREMENT RULES ============
CREATE TABLE IF NOT EXISTS public.compliance_requirement_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_category_id uuid REFERENCES public.business_categories(id) ON DELETE CASCADE,
  service_type_id uuid REFERENCES public.service_types(id) ON DELETE CASCADE,
  requirement_type text NOT NULL CHECK (requirement_type IN
    ('licence','insurance','screening','training','policy','evidence','risk_template','task_template','registration_group','operational_module')),
  requirement_reference text NOT NULL,
  label text,
  required boolean NOT NULL DEFAULT true,
  condition_json jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.compliance_requirement_rules TO authenticated;
GRANT ALL ON public.compliance_requirement_rules TO service_role;
ALTER TABLE public.compliance_requirement_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crr_read" ON public.compliance_requirement_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "crr_admin" ON public.compliance_requirement_rules FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER crr_updated_at BEFORE UPDATE ON public.compliance_requirement_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ 6. MASTER POLICY / TEMPLATE LIBRARY ============
CREATE TABLE IF NOT EXISTS public.master_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  requirement_type text NOT NULL DEFAULT 'policy',
  business_category_codes text[] NOT NULL DEFAULT '{}',
  service_type_codes text[] NOT NULL DEFAULT '{}',
  registration_group_codes text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  effective_date date NOT NULL DEFAULT current_date,
  review_date date,
  body_template text,
  placeholder_fields text[] NOT NULL DEFAULT ARRAY['legal_business_name','trading_name','abn','address','contact_person','service_types','emergency_contact'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.master_templates TO authenticated;
GRANT ALL ON public.master_templates TO service_role;
ALTER TABLE public.master_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "master_templates_read" ON public.master_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "master_templates_admin" ON public.master_templates FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER master_templates_updated_at BEFORE UPDATE ON public.master_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS master_template_id uuid REFERENCES public.master_templates(id);
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS master_template_version integer;

-- ============ 7. ONBOARDING PATHWAY STATUS ============
ALTER TABLE public.organisation_onboarding ADD COLUMN IF NOT EXISTS pathway_status text NOT NULL DEFAULT 'selection_required';
ALTER TABLE public.organisation_onboarding ADD COLUMN IF NOT EXISTS ndis_funding_status text;
ALTER TABLE public.organisation_onboarding ADD COLUMN IF NOT EXISTS services_confirmed_at timestamptz;
ALTER TABLE public.onboarding_answers ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- ============ 8. SEED CONFIGURATION (categories + service types) ============
INSERT INTO public.business_categories (code, name, description, display_order, requires_ndis_registration) VALUES
 ('ndis_support_provider','NDIS supports','Disability supports delivered to NDIS participants',10,false),
 ('household_cleaning','Cleaning','General, deep and household cleaning services',20,false),
 ('infection_control_cleaning','Infection-control services','Infectious area, bodily fluid and outbreak response cleaning',30,false),
 ('waste_management','Waste management','Clinical, hazardous and general waste handling',40,false),
 ('electrical_contractor','Electrical services','Licensed electrical installation and maintenance',50,false),
 ('plumbing_contractor','Plumbing services','Licensed plumbing and drainage work',60,false),
 ('building_contractor','Building and construction','Licensed building and construction work',70,false),
 ('handyman_property_maintenance','Property maintenance / handyman','General repairs and property maintenance',80,false),
 ('home_modifications','Home modifications','Accessibility modifications to dwellings',90,false),
 ('vehicle_modifications','Vehicle modifications','Accessibility modifications to vehicles',100,false),
 ('transport_provider','Transport','Participant, community and appointment transport',110,false),
 ('community_access','Community access','Support to access community activities',120,false),
 ('life_skills_support','Life-skills support','Development of daily living and life skills',130,false),
 ('supported_independent_living','SIL','Supported independent living',140,false),
 ('allied_health','Allied health','Registered allied health and therapeutic supports',150,false),
 ('nursing_high_intensity','Nursing / high-intensity support','High intensity daily personal activities and nursing care',160,false),
 ('other','Other','Another service type not listed',900,false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.service_types (business_category_id, code, name, display_order, high_risk, requires_registration_group, requires_clinical_governance, requires_participant_management, requires_worker_screening, requires_photos, supports_geolocation)
SELECT bc.id, v.code, v.name, v.ord, v.high_risk, v.reg_group, v.clinical, v.participant, v.screening, v.photos, v.geo
FROM (VALUES
 ('household_cleaning','general_household_cleaning','General household cleaning',10,false,false,false,false,false,true,true),
 ('household_cleaning','deep_cleaning','Deep cleaning',20,false,false,false,false,false,true,true),
 ('household_cleaning','end_of_tenancy_cleaning','End-of-tenancy cleaning',30,false,false,false,false,false,true,true),
 ('household_cleaning','laundry_linen','Laundry and linen',40,false,false,false,false,false,false,true),
 ('household_cleaning','domestic_assistance','Domestic assistance',50,false,true,false,true,true,false,true),
 ('household_cleaning','participant_home_cleaning','Participant home cleaning',60,false,true,false,true,true,true,true),
 ('infection_control_cleaning','infectious_area_cleaning','Infectious-area cleaning',10,true,false,false,false,false,true,true),
 ('infection_control_cleaning','bodily_fluid_cleanup','Bodily-fluid cleanup',20,true,false,false,false,false,true,true),
 ('infection_control_cleaning','ppe_managed_cleaning','PPE-managed cleaning',30,true,false,false,false,false,true,true),
 ('infection_control_cleaning','clinical_hazardous_waste','Clinical or hazardous-waste handling',40,true,false,false,false,false,true,true),
 ('infection_control_cleaning','outbreak_response_cleaning','Outbreak-response cleaning',50,true,false,false,false,false,true,true),
 ('infection_control_cleaning','high_touch_disinfection','High-touch surface disinfection',60,false,false,false,false,false,true,true),
 ('waste_management','general_waste_collection','General waste collection',10,false,false,false,false,false,true,true),
 ('waste_management','clinical_waste_disposal','Clinical waste disposal',20,true,false,false,false,false,true,true),
 ('waste_management','hazardous_waste_disposal','Hazardous waste disposal',30,true,false,false,false,false,true,true),
 ('electrical_contractor','electrical_installation','Electrical installation',10,true,false,false,false,false,true,true),
 ('electrical_contractor','safety_switches','Safety switches',20,true,false,false,false,false,true,true),
 ('electrical_contractor','lighting_modifications','Lighting modifications',30,false,false,false,false,false,true,true),
 ('electrical_contractor','emergency_electrical','Emergency electrical work',40,true,false,false,false,false,true,true),
 ('electrical_contractor','electrical_home_modification','Electrical accessibility modifications',50,true,true,false,true,true,true,true),
 ('electrical_contractor','smart_home_controls','Smart-home controls',60,false,false,false,false,false,true,true),
 ('plumbing_contractor','plumbing_installation','Plumbing installation and repair',10,true,false,false,false,false,true,true),
 ('plumbing_contractor','accessible_bathroom_plumbing','Accessible bathroom plumbing',20,true,true,false,true,true,true,true),
 ('building_contractor','general_building_works','General building works',10,true,false,false,false,false,true,true),
 ('building_contractor','structural_accessibility_works','Structural accessibility works',20,true,true,false,true,true,true,true),
 ('handyman_property_maintenance','general_repairs','General repairs',10,false,false,false,false,false,true,true),
 ('handyman_property_maintenance','participant_property_maintenance','Participant property maintenance',20,false,true,false,true,true,true,true),
 ('home_modifications','grab_rails','Grab rails',10,false,true,false,true,true,true,true),
 ('home_modifications','ramps','Ramps',20,true,true,false,true,true,true,true),
 ('home_modifications','doorway_widening','Doorway widening',30,true,true,false,true,true,true,true),
 ('home_modifications','bathroom_modifications','Bathroom modifications',40,true,true,false,true,true,true,true),
 ('home_modifications','accessible_kitchens','Accessible kitchens',50,true,true,false,true,true,true,true),
 ('home_modifications','lighting_automation','Lighting and automation',60,false,true,false,true,true,true,true),
 ('vehicle_modifications','wheelchair_hoists','Wheelchair hoists',10,true,true,false,true,true,true,false),
 ('vehicle_modifications','hand_controls','Hand controls',20,true,true,false,true,true,true,false),
 ('vehicle_modifications','transfer_equipment','Transfer equipment',30,true,true,false,true,true,true,false),
 ('vehicle_modifications','seating_positioning','Seating and positioning modifications',40,true,true,false,true,true,true,false),
 ('vehicle_modifications','restraint_docking','Restraint and docking systems',50,true,true,false,true,true,true,false),
 ('transport_provider','participant_transport','Participant transport',10,true,true,false,true,true,false,true),
 ('transport_provider','community_transport','Community transport',20,false,true,false,true,true,false,true),
 ('transport_provider','appointment_transport','Appointment transport',30,false,true,false,true,true,false,true),
 ('transport_provider','accessible_vehicle_transport','Accessible vehicle transport',40,true,true,false,true,true,false,true),
 ('community_access','community_participation','Participation in community activities',10,false,true,false,true,true,false,true),
 ('community_access','social_recreation_support','Social and recreation support',20,false,true,false,true,true,false,true),
 ('life_skills_support','daily_living_skills','Development of daily living skills',10,false,true,false,true,true,false,true),
 ('life_skills_support','budgeting_life_admin','Budgeting and life administration support',20,false,true,false,true,true,false,true),
 ('supported_independent_living','sil_support','Supported independent living',10,true,true,false,true,true,false,true),
 ('supported_independent_living','short_term_accommodation','Short-term accommodation',20,true,true,false,true,true,false,true),
 ('allied_health','therapeutic_supports','Therapeutic supports',10,true,true,true,true,true,false,false),
 ('allied_health','occupational_therapy','Occupational therapy',20,true,true,true,true,true,false,false),
 ('allied_health','behaviour_support','Specialist behaviour support',30,true,true,true,true,true,false,false),
 ('nursing_high_intensity','medication_support','Medication support',10,true,true,true,true,true,false,true),
 ('nursing_high_intensity','complex_bowel_care','Complex bowel care',20,true,true,true,true,true,false,true),
 ('nursing_high_intensity','enteral_feeding','Enteral feeding support',30,true,true,true,true,true,false,true),
 ('nursing_high_intensity','dysphagia_mealtime','Dysphagia and mealtime management',40,true,true,true,true,true,false,true),
 ('nursing_high_intensity','tracheostomy_care','Tracheostomy care',50,true,true,true,true,true,false,true),
 ('nursing_high_intensity','urinary_catheter','Urinary catheter support',60,true,true,true,true,true,false,true),
 ('nursing_high_intensity','ventilator_support','Ventilator support',70,true,true,true,true,true,false,true),
 ('nursing_high_intensity','subcutaneous_injections','Subcutaneous injections',80,true,true,true,true,true,false,true),
 ('nursing_high_intensity','complex_wound_care','Complex wound care',90,true,true,true,true,true,false,true),
 ('nursing_high_intensity','seizure_management','Seizure management',100,true,true,true,true,true,false,true),
 ('ndis_support_provider','personal_care','Assistance with daily personal activities',10,true,true,false,true,true,false,true),
 ('ndis_support_provider','household_tasks','Assistance with household tasks',20,false,true,false,true,true,true,true),
 ('ndis_support_provider','support_coordination','Support coordination',30,false,true,false,true,true,false,false),
 ('other','other_service','Other service',10,false,false,false,false,false,false,false)
) AS v(cat_code, code, name, ord, high_risk, reg_group, clinical, participant, screening, photos, geo)
JOIN public.business_categories bc ON bc.code = v.cat_code
ON CONFLICT (code) DO NOTHING;
