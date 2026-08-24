INSERT INTO public.provider_pathways (code, name, description, is_active) VALUES
  ('universal_multi_service', 'Universal / multi-service provider', 'Default pathway — onboarding requirements are derived from the services the provider confirms.', true),
  ('ndis_support_provider', 'NDIS supports provider', 'Disability supports delivered to NDIS participants.', true),
  ('cleaning_provider', 'Cleaning services', 'General, deep and household cleaning providers.', true),
  ('infection_control_provider', 'Infection-control cleaning', 'Infectious area, bodily fluid and outbreak response cleaning.', true),
  ('allied_health_provider', 'Allied health', 'Registered allied health and therapeutic supports.', true),
  ('nursing_high_intensity_provider', 'Nursing / high-intensity support', 'High intensity daily personal activities and nursing care.', true),
  ('sil_provider', 'Supported independent living (SIL)', 'Providers delivering supported independent living.', true),
  ('community_access_provider', 'Community access & life skills', 'Community participation and daily living skills supports.', true),
  ('transport_provider', 'Transport provider', 'Participant, community and appointment transport.', true),
  ('plumbing_contractor', 'Plumbing contractor', 'Licensed plumbing and drainage work.', true),
  ('building_contractor', 'Building and construction contractor', 'Licensed building and construction work.', true),
  ('property_maintenance_provider', 'Property maintenance / handyman', 'General repairs and property maintenance.', true),
  ('modifications_provider', 'Home and vehicle modifications', 'Accessibility modifications to dwellings and vehicles.', true),
  ('waste_management_provider', 'Waste management', 'Clinical, hazardous and general waste handling.', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true;