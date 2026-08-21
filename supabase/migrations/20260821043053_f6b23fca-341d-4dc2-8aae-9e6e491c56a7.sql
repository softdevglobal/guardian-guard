-- ===== ENUMS =====
DO $$ BEGIN
  CREATE TYPE public.shift_status AS ENUM ('scheduled','checked_in','in_progress','submitted','approved','correction_required','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_event_type AS ENUM ('check_in','check_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_evidence_type AS ENUM ('before','after','issue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.geofence_result AS ENUM ('inside','outside','unknown','inaccurate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shift_task_status AS ENUM ('pending','completed','not_completed','not_applicable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== 1. service_task_templates =====
CREATE TABLE public.service_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  name text NOT NULL,
  service_type text,
  description text,
  requires_before_photo boolean NOT NULL DEFAULT false,
  requires_after_photo boolean NOT NULL DEFAULT false,
  participant_confirmation_required boolean NOT NULL DEFAULT false,
  allow_gallery_upload boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.service_task_templates TO authenticated;
GRANT ALL ON public.service_task_templates TO service_role;
ALTER TABLE public.service_task_templates ENABLE ROW LEVEL SECURITY;

-- ===== 2. participant_evidence_preferences =====
CREATE TABLE public.participant_evidence_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  photography_consent_status public.consent_status NOT NULL DEFAULT 'pending',
  allowed_evidence_types public.task_evidence_type[] NOT NULL DEFAULT ARRAY[]::public.task_evidence_type[],
  participant_may_appear boolean NOT NULL DEFAULT false,
  photography_restrictions text,
  private_area_restrictions text,
  alternative_evidence_method text,
  consent_id uuid REFERENCES public.participant_consents(id),
  consent_date timestamptz,
  consent_version integer,
  reviewed_by uuid,
  review_date date,
  accessible_explanation_provided boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id)
);
GRANT SELECT, INSERT, UPDATE ON public.participant_evidence_preferences TO authenticated;
GRANT ALL ON public.participant_evidence_preferences TO service_role;
ALTER TABLE public.participant_evidence_preferences ENABLE ROW LEVEL SECURITY;

-- ===== 3. participant_service_locations =====
CREATE TABLE public.participant_service_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  label text NOT NULL,
  suburb text,
  address_label text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  geofence_radius_metres integer NOT NULL DEFAULT 150,
  access_instructions text,
  access_instructions_restricted boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.participant_service_locations TO authenticated;
GRANT ALL ON public.participant_service_locations TO service_role;
ALTER TABLE public.participant_service_locations ENABLE ROW LEVEL SECURITY;

-- ===== 4. service_shifts =====
CREATE TABLE public.service_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  worker_id uuid NOT NULL,
  supervisor_id uuid,
  service_agreement_id uuid REFERENCES public.service_agreements(id),
  location_id uuid REFERENCES public.participant_service_locations(id),
  address_label text,
  support_item text,
  service_type text,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  actual_start timestamptz,
  actual_end timestamptz,
  geofence_latitude numeric(9,6),
  geofence_longitude numeric(9,6),
  geofence_radius_metres integer NOT NULL DEFAULT 150,
  status public.shift_status NOT NULL DEFAULT 'scheduled',
  service_notes text,
  hazards_observed text,
  linked_incident_id uuid REFERENCES public.incidents(id),
  transport_kilometres numeric(8,2),
  transport_notes text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  approval_notes text,
  correction_reason text,
  correction_requested_at timestamptz,
  geofence_exception boolean NOT NULL DEFAULT false,
  geofence_exception_reason text,
  evidence_exception boolean NOT NULL DEFAULT false,
  evidence_exception_reason text,
  exception_authorised_by uuid,
  exception_authorised_at timestamptz,
  requires_supervisor_review boolean NOT NULL DEFAULT false,
  recurrence_group_id uuid,
  cancelled_reason text,
  created_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_shifts_worker ON public.service_shifts (worker_id, scheduled_start);
CREATE INDEX idx_service_shifts_org_status ON public.service_shifts (organisation_id, status);
GRANT SELECT, INSERT, UPDATE ON public.service_shifts TO authenticated;
GRANT ALL ON public.service_shifts TO service_role;
ALTER TABLE public.service_shifts ENABLE ROW LEVEL SECURITY;

-- ===== 5. service_shift_tasks =====
CREATE TABLE public.service_shift_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  shift_id uuid NOT NULL REFERENCES public.service_shifts(id),
  template_id uuid REFERENCES public.service_task_templates(id),
  title text NOT NULL,
  participant_instructions text,
  sequence integer NOT NULL DEFAULT 1,
  requires_before_photo boolean NOT NULL DEFAULT false,
  requires_after_photo boolean NOT NULL DEFAULT false,
  status public.shift_task_status NOT NULL DEFAULT 'pending',
  completion_notes text,
  completed_by uuid,
  completed_at timestamptz,
  exception_reason text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shift_tasks_shift ON public.service_shift_tasks (shift_id, sequence);
GRANT SELECT, INSERT, UPDATE ON public.service_shift_tasks TO authenticated;
GRANT ALL ON public.service_shift_tasks TO service_role;
ALTER TABLE public.service_shift_tasks ENABLE ROW LEVEL SECURITY;

-- ===== 6. attendance_events =====
CREATE TABLE public.attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  shift_id uuid NOT NULL REFERENCES public.service_shifts(id),
  worker_id uuid NOT NULL,
  event_type public.attendance_event_type NOT NULL,
  server_created_at timestamptz NOT NULL DEFAULT now(),
  device_capture_at timestamptz,
  latitude numeric(9,6),
  longitude numeric(9,6),
  accuracy_metres numeric(8,2),
  geofence_result public.geofence_result NOT NULL DEFAULT 'unknown',
  distance_metres numeric(10,2),
  device_identifier text,
  session_identifier text,
  offline_capture boolean NOT NULL DEFAULT false,
  synced_at timestamptz,
  exception_reason text,
  supervisor_reviewed_by uuid,
  supervisor_reviewed_at timestamptz,
  supervisor_review_notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_attendance_shift ON public.attendance_events (shift_id, server_created_at);
GRANT SELECT, INSERT, UPDATE ON public.attendance_events TO authenticated;
GRANT ALL ON public.attendance_events TO service_role;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

-- ===== 7. task_evidence =====
CREATE TABLE public.task_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  shift_id uuid NOT NULL REFERENCES public.service_shifts(id),
  shift_task_id uuid REFERENCES public.service_shift_tasks(id),
  participant_id uuid NOT NULL REFERENCES public.participants(id),
  worker_id uuid NOT NULL,
  evidence_type public.task_evidence_type NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size_bytes bigint,
  sha256_hash text NOT NULL,
  caption text,
  source text NOT NULL DEFAULT 'camera',
  server_created_at timestamptz NOT NULL DEFAULT now(),
  device_capture_at timestamptz,
  latitude numeric(9,6),
  longitude numeric(9,6),
  accuracy_metres numeric(8,2),
  geofence_result public.geofence_result NOT NULL DEFAULT 'unknown',
  device_identifier text,
  session_identifier text,
  consent_id uuid REFERENCES public.participant_consents(id),
  supersedes_evidence_id uuid REFERENCES public.task_evidence(id),
  supersede_reason text,
  offline_capture boolean NOT NULL DEFAULT false,
  synced_at timestamptz,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_evidence_shift ON public.task_evidence (shift_id);
GRANT SELECT, INSERT, UPDATE ON public.task_evidence TO authenticated;
GRANT ALL ON public.task_evidence TO service_role;
ALTER TABLE public.task_evidence ENABLE ROW LEVEL SECURITY;

-- ===== 8. shift_completion_confirmations =====
CREATE TABLE public.shift_completion_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  shift_id uuid NOT NULL REFERENCES public.service_shifts(id),
  confirmation_method text NOT NULL,
  confirmed_by_name text,
  relationship text,
  declined boolean NOT NULL DEFAULT false,
  declined_reason text,
  not_practicable_reason text,
  confirmed_at timestamptz,
  signature_storage_path text,
  recorded_by uuid,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shift_confirmations_shift ON public.shift_completion_confirmations (shift_id);
GRANT SELECT, INSERT, UPDATE ON public.shift_completion_confirmations TO authenticated;
GRANT ALL ON public.shift_completion_confirmations TO service_role;
ALTER TABLE public.shift_completion_confirmations ENABLE ROW LEVEL SECURITY;

-- ===== HELPER FUNCTIONS =====
CREATE OR REPLACE FUNCTION public.is_shift_oversight(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['super_admin','compliance_officer','supervisor','executive']::app_role[])
$$;

CREATE OR REPLACE FUNCTION public.can_access_shift(_shift_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_shifts s
    WHERE s.id = _shift_id
      AND s.organisation_id = public.get_user_organisation_id(auth.uid())
      AND (
        s.worker_id = auth.uid()
        OR public.is_shift_oversight(auth.uid())
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.service_shifts s
    JOIN public.participants p ON p.id = s.participant_id
    WHERE s.id = _shift_id AND p.user_id = auth.uid() AND s.status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_shift(_shift_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_shifts s
    WHERE s.id = _shift_id
      AND s.organisation_id = public.get_user_organisation_id(auth.uid())
      AND (
        public.is_shift_oversight(auth.uid())
        OR (s.worker_id = auth.uid() AND s.status IN ('scheduled','checked_in','in_progress','correction_required'))
      )
  )
$$;

-- Haversine distance in metres
CREATE OR REPLACE FUNCTION public.geo_distance_metres(_lat1 numeric, _lon1 numeric, _lat2 numeric, _lon2 numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _lat1 IS NULL OR _lon1 IS NULL OR _lat2 IS NULL OR _lon2 IS NULL THEN NULL
    ELSE round((6371000 * 2 * asin(sqrt(
      power(sin(radians(_lat2::float8 - _lat1::float8) / 2), 2) +
      cos(radians(_lat1::float8)) * cos(radians(_lat2::float8)) *
      power(sin(radians(_lon2::float8 - _lon1::float8) / 2), 2)
    )))::numeric, 2)
  END
$$;

-- Blockers preventing submission of a shift
CREATE OR REPLACE FUNCTION public.shift_submission_blockers(_shift_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s public.service_shifts;
  _b text[] := ARRAY[]::text[];
  _pending int;
  _missing int;
  _photo_allowed boolean;
BEGIN
  SELECT * INTO _s FROM public.service_shifts WHERE id = _shift_id;
  IF _s.id IS NULL THEN RETURN ARRAY['Shift not found.']; END IF;

  IF _s.actual_start IS NULL THEN _b := _b || 'Check in has not been recorded.'; END IF;
  IF _s.actual_end IS NULL THEN _b := _b || 'Check out has not been recorded.'; END IF;

  SELECT count(*) INTO _pending FROM public.service_shift_tasks t
   WHERE t.shift_id = _shift_id AND t.record_status = 'active' AND t.status = 'pending';
  IF _pending > 0 THEN _b := _b || format('%s task(s) still pending.', _pending); END IF;

  SELECT count(*) INTO _missing FROM public.service_shift_tasks t
   WHERE t.shift_id = _shift_id AND t.record_status = 'active' AND t.status <> 'not_applicable'
     AND (t.exception_reason IS NULL OR btrim(t.exception_reason) = '')
     AND (
       (t.requires_before_photo AND NOT EXISTS (
          SELECT 1 FROM public.task_evidence e WHERE e.shift_task_id = t.id AND e.evidence_type = 'before' AND e.record_status = 'active'))
       OR (t.requires_after_photo AND NOT EXISTS (
          SELECT 1 FROM public.task_evidence e WHERE e.shift_task_id = t.id AND e.evidence_type = 'after' AND e.record_status = 'active'))
     );

  IF _missing > 0 THEN
    -- Participant photography refusal never blocks service delivery
    SELECT (pref.photography_consent_status = 'granted') INTO _photo_allowed
      FROM public.participant_evidence_preferences pref WHERE pref.participant_id = _s.participant_id;
    IF COALESCE(_photo_allowed, false) THEN
      IF NOT (_s.evidence_exception AND COALESCE(btrim(_s.evidence_exception_reason), '') <> '') THEN
        _b := _b || format('%s task(s) are missing required photo evidence. Record an authorised exception with a reason, or written alternative evidence.', _missing);
      END IF;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.service_shift_tasks t
    WHERE t.shift_id = _shift_id AND t.record_status = 'active'
      AND t.template_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.service_task_templates tp WHERE tp.id = t.template_id AND tp.participant_confirmation_required)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.shift_completion_confirmations c WHERE c.shift_id = _shift_id AND c.record_status = 'active'
  ) THEN
    _b := _b || 'Participant confirmation is required — record confirmation, decline or a not-practicable reason.';
  END IF;

  RETURN _b;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.shift_submission_blockers(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.geo_distance_metres(numeric,numeric,numeric,numeric) FROM anon;

-- ===== RLS POLICIES =====
CREATE POLICY "org read templates" ON public.service_task_templates FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()));
CREATE POLICY "admins manage templates" ON public.service_task_templates FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY "admins update templates" ON public.service_task_templates FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE POLICY "read evidence prefs" ON public.participant_evidence_preferences FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.can_access_participant(participant_id));
CREATE POLICY "manage evidence prefs" ON public.participant_evidence_preferences FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY "update evidence prefs" ON public.participant_evidence_preferences FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE POLICY "read service locations" ON public.participant_service_locations FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.can_access_participant(participant_id));
CREATE POLICY "manage service locations" ON public.participant_service_locations FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY "update service locations" ON public.participant_service_locations FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));

CREATE POLICY "read own or overseen shifts" ON public.service_shifts FOR SELECT TO authenticated
  USING (
    (organisation_id = public.get_user_organisation_id(auth.uid())
      AND (worker_id = auth.uid() OR public.is_shift_oversight(auth.uid())))
    OR (status = 'approved' AND EXISTS (SELECT 1 FROM public.participants p WHERE p.id = participant_id AND p.user_id = auth.uid()))
  );
CREATE POLICY "schedulers create shifts" ON public.service_shifts FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]));
CREATE POLICY "worker or oversight update shifts" ON public.service_shifts FOR UPDATE TO authenticated
  USING (
    organisation_id = public.get_user_organisation_id(auth.uid())
    AND (
      public.is_shift_oversight(auth.uid())
      OR (worker_id = auth.uid() AND status IN ('scheduled','checked_in','in_progress','correction_required'))
    )
  );

CREATE POLICY "read shift tasks" ON public.service_shift_tasks FOR SELECT TO authenticated
  USING (public.can_access_shift(shift_id));
CREATE POLICY "insert shift tasks" ON public.service_shift_tasks FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.can_edit_shift(shift_id));
CREATE POLICY "update shift tasks" ON public.service_shift_tasks FOR UPDATE TO authenticated
  USING (public.can_edit_shift(shift_id));

CREATE POLICY "read attendance" ON public.attendance_events FOR SELECT TO authenticated
  USING (public.can_access_shift(shift_id));
CREATE POLICY "worker inserts attendance" ON public.attendance_events FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND worker_id = auth.uid() AND public.can_edit_shift(shift_id));
CREATE POLICY "oversight updates attendance" ON public.attendance_events FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.is_shift_oversight(auth.uid()));

CREATE POLICY "read task evidence" ON public.task_evidence FOR SELECT TO authenticated
  USING (public.can_access_shift(shift_id));
CREATE POLICY "worker inserts evidence" ON public.task_evidence FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND worker_id = auth.uid() AND public.can_edit_shift(shift_id));
CREATE POLICY "supersede evidence" ON public.task_evidence FOR UPDATE TO authenticated
  USING (public.can_edit_shift(shift_id));

CREATE POLICY "read confirmations" ON public.shift_completion_confirmations FOR SELECT TO authenticated
  USING (public.can_access_shift(shift_id));
CREATE POLICY "insert confirmations" ON public.shift_completion_confirmations FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_organisation_id(auth.uid()) AND public.can_edit_shift(shift_id));
CREATE POLICY "update confirmations" ON public.shift_completion_confirmations FOR UPDATE TO authenticated
  USING (public.can_edit_shift(shift_id));

-- ===== GUARD TRIGGERS =====
CREATE OR REPLACE FUNCTION public.enforce_attendance_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.service_shifts;
BEGIN
  SELECT * INTO _s FROM public.service_shifts WHERE id = NEW.shift_id;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Shift not found.'; END IF;
  IF NEW.worker_id <> _s.worker_id THEN
    RAISE EXCEPTION 'Attendance can only be recorded by the worker assigned to this shift.';
  END IF;
  IF _s.status IN ('submitted','approved','cancelled') THEN
    RAISE EXCEPTION 'This shift is % and can no longer record attendance.', _s.status;
  END IF;
  NEW.organisation_id := _s.organisation_id;
  NEW.server_created_at := now();

  IF NEW.event_type = 'check_in' THEN
    PERFORM public.check_staff_assignment_eligible(_s.worker_id);
  END IF;

  IF NEW.latitude IS NOT NULL AND _s.geofence_latitude IS NOT NULL THEN
    NEW.distance_metres := public.geo_distance_metres(NEW.latitude, NEW.longitude, _s.geofence_latitude, _s.geofence_longitude);
    IF NEW.accuracy_metres IS NOT NULL AND NEW.accuracy_metres > 250 THEN
      NEW.geofence_result := 'inaccurate';
    ELSIF NEW.distance_metres <= _s.geofence_radius_metres THEN
      NEW.geofence_result := 'inside';
    ELSE
      NEW.geofence_result := 'outside';
    END IF;
  ELSE
    NEW.geofence_result := 'unknown';
  END IF;

  IF NEW.geofence_result <> 'inside' AND COALESCE(btrim(NEW.exception_reason), '') = '' THEN
    RAISE EXCEPTION 'Location could not be confirmed at the service address. A written reason is required.';
  END IF;

  IF NEW.geofence_result <> 'inside' THEN
    UPDATE public.service_shifts
      SET geofence_exception = true,
          geofence_exception_reason = COALESCE(geofence_exception_reason, NEW.exception_reason),
          requires_supervisor_review = true
      WHERE id = NEW.shift_id;
  END IF;

  IF NEW.event_type = 'check_in' THEN
    UPDATE public.service_shifts SET actual_start = COALESCE(actual_start, now()), status = 'checked_in' WHERE id = NEW.shift_id;
  ELSE
    UPDATE public.service_shifts SET actual_end = now() WHERE id = NEW.shift_id;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_enforce_attendance BEFORE INSERT ON public.attendance_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_event();

CREATE OR REPLACE FUNCTION public.enforce_shift_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b text[]; _oversight boolean;
BEGIN
  _oversight := public.is_shift_oversight(auth.uid());

  IF OLD.status = 'approved' AND NOT public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer']::app_role[]) THEN
    RAISE EXCEPTION 'Approved service records are read-only.';
  END IF;

  IF OLD.status = 'submitted' AND NOT _oversight THEN
    RAISE EXCEPTION 'This service has been submitted for approval and cannot be edited.';
  END IF;

  IF NEW.status = 'submitted' AND OLD.status <> 'submitted' THEN
    _b := public.shift_submission_blockers(NEW.id);
    IF array_length(_b, 1) > 0 THEN
      RAISE EXCEPTION 'Cannot submit this service: %', array_to_string(_b, ' ');
    END IF;
    NEW.submitted_at := now();
  END IF;

  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    IF NOT public.has_any_role(auth.uid(), ARRAY['super_admin','compliance_officer','supervisor']::app_role[]) THEN
      RAISE EXCEPTION 'Only a supervisor, compliance officer or administrator can approve a service.';
    END IF;
    IF OLD.status <> 'submitted' THEN
      RAISE EXCEPTION 'Only submitted services can be approved.';
    END IF;
    NEW.approved_at := now();
    NEW.approved_by := auth.uid();
  END IF;

  IF NEW.status = 'correction_required' AND OLD.status <> 'correction_required' THEN
    IF NOT _oversight THEN
      RAISE EXCEPTION 'Only a supervisor, compliance officer or administrator can request a correction.';
    END IF;
    IF COALESCE(btrim(NEW.correction_reason), '') = '' THEN
      RAISE EXCEPTION 'A written reason is required when requesting a correction.';
    END IF;
    NEW.correction_requested_at := now();
  END IF;

  IF NEW.evidence_exception AND NOT OLD.evidence_exception THEN
    IF COALESCE(btrim(NEW.evidence_exception_reason), '') = '' THEN
      RAISE EXCEPTION 'An evidence exception requires a written reason.';
    END IF;
    NEW.requires_supervisor_review := true;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_enforce_shift_workflow BEFORE UPDATE ON public.service_shifts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shift_workflow();

-- Evidence immutability
CREATE OR REPLACE FUNCTION public.enforce_evidence_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.storage_path <> OLD.storage_path
     OR NEW.sha256_hash <> OLD.sha256_hash
     OR NEW.evidence_type <> OLD.evidence_type
     OR NEW.shift_id <> OLD.shift_id
     OR NEW.server_created_at <> OLD.server_created_at THEN
    RAISE EXCEPTION 'Evidence records are immutable. Upload a superseding record with a reason instead.';
  END IF;
  IF OLD.record_status = 'archived' AND NEW.record_status = 'active' THEN
    RAISE EXCEPTION 'Superseded evidence cannot be reinstated.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_evidence_immutable BEFORE UPDATE ON public.task_evidence
  FOR EACH ROW EXECUTE FUNCTION public.enforce_evidence_immutability();

CREATE OR REPLACE FUNCTION public.apply_evidence_supersede()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.supersedes_evidence_id IS NOT NULL THEN
    IF COALESCE(btrim(NEW.supersede_reason), '') = '' THEN
      RAISE EXCEPTION 'A reason is required when replacing an evidence item.';
    END IF;
    UPDATE public.task_evidence SET record_status = 'archived' WHERE id = NEW.supersedes_evidence_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_evidence_supersede AFTER INSERT ON public.task_evidence
  FOR EACH ROW EXECUTE FUNCTION public.apply_evidence_supersede();

-- Notifications
CREATE OR REPLACE FUNCTION public.notify_shift_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid;
BEGIN
  IF NEW.status = 'submitted' AND OLD.status <> 'submitted' THEN
    FOR _u IN
      SELECT up.id FROM public.user_profiles up
      JOIN public.user_roles ur ON ur.user_id = up.id
      WHERE up.organisation_id = NEW.organisation_id
        AND ur.role IN ('supervisor','compliance_officer','super_admin')
    LOOP
      PERFORM public.insert_notification_deduped(
        _u, 'Service submitted for approval',
        'A completed service is waiting in the approval queue.',
        CASE WHEN NEW.requires_supervisor_review THEN 'warning' ELSE 'info' END,
        'service_approval', 'service_shifts', NEW.id::text,
        '/service-approvals', NEW.organisation_id,
        'shift_submitted:' || NEW.id::text || ':' || _u::text, 'shift');
    END LOOP;
  END IF;

  IF NEW.status = 'correction_required' AND OLD.status <> 'correction_required' THEN
    PERFORM public.insert_notification_deduped(
      NEW.worker_id, 'Correction requested on your service',
      COALESCE(NEW.correction_reason, 'Your supervisor has requested a correction.'),
      'warning', 'service_correction', 'service_shifts', NEW.id::text,
      '/my-shifts/' || NEW.id::text, NEW.organisation_id,
      'shift_correction:' || NEW.id::text || ':' || COALESCE(NEW.correction_requested_at, now())::text, 'shift');
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_shift_workflow AFTER UPDATE ON public.service_shifts
  FOR EACH ROW EXECUTE FUNCTION public.notify_shift_workflow();

-- updated_at, audit and no-delete on all new tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['service_task_templates','participant_evidence_preferences','participant_service_locations','service_shifts','service_shift_tasks','attendance_events','task_evidence','shift_completion_confirmations']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_audit AFTER INSERT OR UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.audit_trail_trigger()', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_no_delete BEFORE DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion()', t);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.enforce_attendance_event() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_shift_workflow() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_evidence_immutability() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_evidence_supersede() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_shift_workflow() FROM anon, authenticated;
