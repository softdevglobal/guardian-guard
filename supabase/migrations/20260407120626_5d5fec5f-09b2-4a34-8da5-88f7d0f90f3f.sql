
-- Create consent status enum
DO $$ BEGIN
  CREATE TYPE public.consent_status AS ENUM ('granted', 'withdrawn', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add columns to participants
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS support_type text,
  ADD COLUMN IF NOT EXISTS risk_flags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consent_status public.consent_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS consent_date timestamptz;

-- Add columns to participant_goals
ALTER TABLE public.participant_goals
  ADD COLUMN IF NOT EXISTS baseline_score numeric,
  ADD COLUMN IF NOT EXISTS target_score numeric,
  ADD COLUMN IF NOT EXISTS measurement_unit text DEFAULT 'score';

-- Add columns to participant_progress
ALTER TABLE public.participant_progress
  ADD COLUMN IF NOT EXISTS evidence_file_url text,
  ADD COLUMN IF NOT EXISTS evidence_type text,
  ADD COLUMN IF NOT EXISTS evidence_notes text;

-- Trigger: block progress entry without evidence
CREATE OR REPLACE FUNCTION public.enforce_progress_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.evidence_file_url IS NULL AND NEW.evidence_notes IS NULL THEN
    RAISE EXCEPTION 'Cannot record progress without evidence. Attach a file or provide evidence notes.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_progress_evidence ON public.participant_progress;
CREATE TRIGGER trg_enforce_progress_evidence
  BEFORE INSERT ON public.participant_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_progress_evidence();

-- Trigger: block updates if consent is not granted
CREATE OR REPLACE FUNCTION public.enforce_participant_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _consent public.consent_status;
BEGIN
  SELECT consent_status INTO _consent
  FROM public.participants
  WHERE id = NEW.participant_id;

  IF _consent IS NULL OR _consent != 'granted' THEN
    RAISE EXCEPTION 'Cannot update participant data: consent is not granted. Current status: %', COALESCE(_consent::text, 'unknown');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_consent_progress ON public.participant_progress;
CREATE TRIGGER trg_enforce_consent_progress
  BEFORE INSERT ON public.participant_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_participant_consent();

DROP TRIGGER IF EXISTS trg_enforce_consent_goals ON public.participant_goals;
CREATE TRIGGER trg_enforce_consent_goals
  BEFORE INSERT OR UPDATE ON public.participant_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_participant_consent();

-- Function: detect declining outcomes (3+ consecutive drops)
CREATE OR REPLACE FUNCTION public.check_declining_outcomes(_participant_id uuid, _goal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _scores numeric[];
  _declining boolean := false;
  _i int;
BEGIN
  SELECT array_agg(metric_value ORDER BY created_at DESC)
  INTO _scores
  FROM (
    SELECT metric_value, created_at
    FROM public.participant_progress
    WHERE participant_id = _participant_id
      AND goal_id = _goal_id
      AND metric_value IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 4
  ) sub;

  IF _scores IS NULL OR array_length(_scores, 1) < 3 THEN
    RETURN false;
  END IF;

  -- Check if last 3 are consecutively declining
  _declining := true;
  FOR _i IN 1..LEAST(3, array_length(_scores, 1) - 1) LOOP
    IF _scores[_i] >= _scores[_i + 1] THEN
      _declining := false;
      EXIT;
    END IF;
  END LOOP;

  RETURN _declining;
END;
$$;
