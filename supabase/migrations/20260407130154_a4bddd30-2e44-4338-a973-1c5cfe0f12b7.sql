
-- Add linked_incident_id to training_completions for skill-gap incident linking
ALTER TABLE public.training_completions
ADD COLUMN IF NOT EXISTS linked_incident_id uuid REFERENCES public.incidents(id);

CREATE INDEX IF NOT EXISTS idx_training_completions_linked_incident
ON public.training_completions(linked_incident_id)
WHERE linked_incident_id IS NOT NULL;

-- Add linked_staff_id to complaints for tracking involved staff
ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS linked_staff_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_complaints_linked_staff
ON public.complaints(linked_staff_id)
WHERE linked_staff_id IS NOT NULL;
