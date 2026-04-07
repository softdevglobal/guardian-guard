
CREATE TABLE public.practice_standards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.practice_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view practice standards"
  ON public.practice_standards FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.practice_standards (code, name, category, description) VALUES
  ('PS1', 'Rights and Responsibilities', 'Core', 'Each participant accesses supports that promote and respect their legal and human rights.'),
  ('PS2', 'Person-Centred Supports', 'Core', 'Each participant accesses supports that are responsive to their needs and goals.'),
  ('PS3', 'Individual Values and Beliefs', 'Core', 'Each participant accesses supports that respect their culture, diversity, values and beliefs.'),
  ('PS4', 'Privacy and Dignity', 'Core', 'Each participant accesses supports that respect and protect their dignity and right to privacy.'),
  ('PS5', 'Violence, Abuse, Neglect, Exploitation and Discrimination', 'Core', 'Each participant accesses supports free from violence, abuse, neglect, exploitation and discrimination.'),
  ('PS6', 'Governance and Operational Management', 'Core', 'Each provider has governance and operational management to support quality service delivery.'),
  ('PS7', 'Human Resource Management', 'Supplementary', 'Each provider has human resource management practices to support quality service delivery.'),
  ('PS8', 'Continuity of Supports', 'Supplementary', 'Each participant has access to timely and appropriate support without interruption.'),
  ('PS9', 'Emergency and Disaster Management', 'Supplementary', 'Each participant is safe and supported during emergencies and natural disasters.'),
  ('PS10', 'Information Management', 'Supplementary', 'Management of each participant''s information ensures it is identifiable, accurately recorded, current, confidential.'),
  ('PS11', 'Feedback and Complaints Management', 'Supplementary', 'Each participant has access to a system for complaints and feedback.'),
  ('PS12', 'Incident Management', 'Supplementary', 'Each participant is safeguarded by the management and resolution of incidents.'),
  ('PS13', 'Restrictive Practices', 'Supplementary', 'Each participant is free from restrictive practices unless properly authorised.'),
  ('PS14', 'Verification (Certification)', 'Supplementary', 'Providers delivering higher-risk supports meet certification requirements.');

ALTER TABLE public.incidents
  ADD COLUMN practice_standard_id uuid REFERENCES public.practice_standards(id);
