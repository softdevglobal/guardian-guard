-- Add audit-ready evidence fields to training_completions
ALTER TABLE public.training_completions
  ADD COLUMN IF NOT EXISTS delivery_method text,
  ADD COLUMN IF NOT EXISTS evidence_type text,
  ADD COLUMN IF NOT EXISTS facilitator text,
  ADD COLUMN IF NOT EXISTS duration_hours numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS compliance_outcome text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS retraining_due_date date,
  ADD COLUMN IF NOT EXISTS retraining_reason text;