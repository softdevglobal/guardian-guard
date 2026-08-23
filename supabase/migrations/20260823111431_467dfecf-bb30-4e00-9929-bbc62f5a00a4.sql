
-- Universal questions (no category = asked of everyone)
INSERT INTO public.onboarding_pathway_rules (business_category_id, requirement_key, step_key, label, field_type, requires_document, requires_expiry, required, display_order)
VALUES
 (NULL,'legal_entity_name','business','Legal entity name','text',false,false,true,10),
 (NULL,'trading_name','business','Trading name','text',false,false,false,20),
 (NULL,'abn','business','ABN','text',false,false,true,30),
 (NULL,'acn','business','ACN (if a company)','text',false,false,false,40),
 (NULL,'business_address','business','Principal business address','text',false,false,true,50),
 (NULL,'primary_contact_name','business','Primary contact name','text',false,false,true,60),
 (NULL,'primary_contact_email','business','Primary contact email','text',false,false,true,70),
 (NULL,'emergency_contact','business','After-hours emergency contact','text',false,false,true,80),
 (NULL,'worker_count','workforce','Number of workers','number',false,false,true,10),
 (NULL,'worker_screening_process','workforce','How do you verify worker screening before a worker starts?','textarea',false,false,true,20),
 (NULL,'incident_process','operations','How are incidents reported and reviewed?','textarea',false,false,true,10),
 (NULL,'complaints_process','operations','How are complaints received and resolved?','textarea',false,false,true,20)
ON CONFLICT DO NOTHING;

-- Category / service specific document questions from the requirement rules
INSERT INTO public.onboarding_pathway_rules
  (business_category_id, service_type_id, requirement_key, step_key, label, field_type, requires_document, requires_expiry, required, display_order)
SELECT r.business_category_id, r.service_type_id, r.requirement_reference,
  CASE r.requirement_type
    WHEN 'licence' THEN 'licences'
    WHEN 'insurance' THEN 'licences'
    WHEN 'screening' THEN 'workforce'
    WHEN 'training' THEN 'workforce'
    ELSE 'documents' END,
  COALESCE(r.label, r.requirement_reference),
  'text', true,
  r.requirement_type IN ('licence','insurance','screening'),
  r.required, 100
FROM public.compliance_requirement_rules r
WHERE r.active AND r.requirement_type IN ('licence','insurance','screening','training');
