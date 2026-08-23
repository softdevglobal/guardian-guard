ALTER TYPE public.evidence_status ADD VALUE IF NOT EXISTS 'ready_for_review';
ALTER TYPE public.evidence_status ADD VALUE IF NOT EXISTS 'not_applicable';

ALTER TABLE public.registration_groups
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'not_delivering',
  ADD COLUMN IF NOT EXISTS next_review_date date;

ALTER TABLE public.evidence_requirements
  ADD COLUMN IF NOT EXISTS module_code text,
  ADD COLUMN IF NOT EXISTS standards_version text NOT NULL DEFAULT 'NDIS Practice Standards (2021)',
  ADD COLUMN IF NOT EXISTS standards_effective_date date NOT NULL DEFAULT DATE '2021-07-01';