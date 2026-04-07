
-- 1. PREVENT DELETION on critical tables (immutability)
CREATE OR REPLACE FUNCTION public.prevent_record_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of % records is not permitted. Use record_status = archived instead.', TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

CREATE TRIGGER prevent_delete_incidents BEFORE DELETE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

CREATE TRIGGER prevent_delete_complaints BEFORE DELETE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

CREATE TRIGGER prevent_delete_risks BEFORE DELETE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

CREATE TRIGGER prevent_delete_safeguarding BEFORE DELETE ON public.safeguarding_concerns
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

CREATE TRIGGER prevent_delete_privacy BEFORE DELETE ON public.privacy_incidents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

CREATE TRIGGER prevent_delete_audit_logs BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

CREATE TRIGGER prevent_delete_policies BEFORE DELETE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

-- 2. PREVENT UPDATES TO CLOSED RECORDS
CREATE OR REPLACE FUNCTION public.prevent_closed_record_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'closed' AND NEW.status = 'closed' THEN
    -- Allow only record_status changes (for archiving)
    IF NEW.record_status IS DISTINCT FROM OLD.record_status THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify a closed record. Closed records are read-only.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_closed_immutability_incidents BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_closed_record_update();

CREATE TRIGGER enforce_closed_immutability_complaints BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.prevent_closed_record_update();

CREATE TRIGGER enforce_closed_immutability_safeguarding BEFORE UPDATE ON public.safeguarding_concerns
  FOR EACH ROW EXECUTE FUNCTION public.prevent_closed_record_update();

CREATE TRIGGER enforce_closed_immutability_privacy BEFORE UPDATE ON public.privacy_incidents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_closed_record_update();

-- 3. PREVENT INCIDENT SEVERITY DOWNGRADE
CREATE OR REPLACE FUNCTION public.prevent_severity_downgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  severity_rank int;
  old_rank int;
BEGIN
  -- Map severity to rank
  old_rank := CASE OLD.severity
    WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END;
  severity_rank := CASE NEW.severity
    WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END;

  IF severity_rank < old_rank THEN
    RAISE EXCEPTION 'Cannot downgrade incident severity from % to %. This is blocked for compliance.', OLD.severity, NEW.severity;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_severity_no_downgrade BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_severity_downgrade();

-- 4. ENFORCE INCIDENT CLOSURE REQUIREMENTS (DB-level)
CREATE OR REPLACE FUNCTION public.enforce_incident_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    IF NEW.root_cause IS NULL OR trim(NEW.root_cause) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: root_cause is required.';
    END IF;
    IF NEW.corrective_actions IS NULL OR trim(NEW.corrective_actions) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: corrective_actions are required.';
    END IF;
    IF NEW.description IS NULL OR trim(NEW.description) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: description is required.';
    END IF;
    IF NEW.participant_followup_completed IS NOT TRUE THEN
      RAISE EXCEPTION 'Cannot close incident: participant follow-up must be completed.';
    END IF;
    IF NEW.contributing_factors IS NULL OR trim(NEW.contributing_factors) = '' THEN
      RAISE EXCEPTION 'Cannot close incident: contributing_factors are required.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_closure_incidents BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_incident_closure();

-- 5. ENFORCE COMPLAINT CLOSURE REQUIREMENTS
CREATE OR REPLACE FUNCTION public.enforce_complaint_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    IF NEW.resolution_actions IS NULL OR trim(NEW.resolution_actions) = '' THEN
      RAISE EXCEPTION 'Cannot close complaint: resolution_actions are required.';
    END IF;
    IF NEW.outcome_communicated_date IS NULL THEN
      RAISE EXCEPTION 'Cannot close complaint: outcome_communicated_date is required.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_closure_complaints BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.enforce_complaint_closure();

-- 6. ENFORCE SAFEGUARDING CLOSURE
CREATE OR REPLACE FUNCTION public.enforce_safeguarding_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    IF NEW.outcome IS NULL OR trim(NEW.outcome) = '' THEN
      RAISE EXCEPTION 'Cannot close safeguarding concern: outcome is required.';
    END IF;
    IF NEW.review_notes IS NULL OR trim(NEW.review_notes) = '' THEN
      RAISE EXCEPTION 'Cannot close safeguarding concern: review_notes are required.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_closure_safeguarding BEFORE UPDATE ON public.safeguarding_concerns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_safeguarding_closure();

-- 7. ENFORCE PRIVACY INCIDENT CLOSURE
CREATE OR REPLACE FUNCTION public.enforce_privacy_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    IF NEW.corrective_action IS NULL OR trim(NEW.corrective_action) = '' THEN
      RAISE EXCEPTION 'Cannot close privacy incident: corrective_action is required.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_closure_privacy BEFORE UPDATE ON public.privacy_incidents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_privacy_closure();

-- 8. FIX NOTIFICATIONS RLS - prevent impersonation
DROP POLICY IF EXISTS "Create notifications" ON public.notifications;
CREATE POLICY "Create notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role])
  );

-- 9. FIX CROSS-ORG HR ACCESS - scope staff_compliance to same org
DROP POLICY IF EXISTS "HR manage compliance" ON public.staff_compliance;
CREATE POLICY "HR manage compliance" ON public.staff_compliance
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'hr_admin'::app_role])
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = staff_compliance.user_id
      AND up.organisation_id = get_user_organisation_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "HR view all compliance" ON public.staff_compliance;
CREATE POLICY "HR view all compliance" ON public.staff_compliance
  FOR SELECT TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'hr_admin'::app_role, 'compliance_officer'::app_role])
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = staff_compliance.user_id
      AND up.organisation_id = get_user_organisation_id(auth.uid())
    )
  );

-- 10. FIX CROSS-ORG CERTIFICATIONS ACCESS
DROP POLICY IF EXISTS "HR manage certs" ON public.certifications;
CREATE POLICY "HR manage certs" ON public.certifications
  FOR ALL TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'hr_admin'::app_role])
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = certifications.user_id
      AND up.organisation_id = get_user_organisation_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "HR view all certs" ON public.certifications;
CREATE POLICY "HR view all certs" ON public.certifications
  FOR SELECT TO authenticated
  USING (
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'hr_admin'::app_role, 'compliance_officer'::app_role])
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = certifications.user_id
      AND up.organisation_id = get_user_organisation_id(auth.uid())
    )
  );

-- 11. ENFORCE WORKFLOW TRANSITIONS on incidents (DB-level)
CREATE OR REPLACE FUNCTION public.enforce_incident_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_next text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  allowed_next := CASE OLD.status
    WHEN 'draft' THEN 'submitted'
    WHEN 'submitted' THEN 'supervisor_review'
    WHEN 'supervisor_review' THEN 'compliance_review'
    WHEN 'compliance_review' THEN 'investigating'
    WHEN 'investigating' THEN 'actioned'
    WHEN 'actioned' THEN 'closed'
    WHEN 'closed' THEN NULL
    ELSE NULL
  END;

  IF allowed_next IS NULL THEN
    RAISE EXCEPTION 'Status transition from % is not allowed.', OLD.status;
  END IF;

  IF NEW.status <> allowed_next THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %. Expected: %.', OLD.status, NEW.status, allowed_next;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_workflow_incidents BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_incident_workflow();

-- 12. ENFORCE COMPLAINT WORKFLOW TRANSITIONS
CREATE OR REPLACE FUNCTION public.enforce_complaint_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_next text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  allowed_next := CASE OLD.status
    WHEN 'submitted' THEN 'acknowledged'
    WHEN 'acknowledged' THEN 'under_review'
    WHEN 'under_review' THEN 'investigating'
    WHEN 'investigating' THEN 'resolved'
    WHEN 'resolved' THEN 'closed'
    WHEN 'closed' THEN NULL
    ELSE NULL
  END;

  IF allowed_next IS NULL THEN
    RAISE EXCEPTION 'Complaint status transition from % is not allowed.', OLD.status;
  END IF;

  IF NEW.status <> allowed_next THEN
    RAISE EXCEPTION 'Invalid complaint status transition: % -> %. Expected: %.', OLD.status, NEW.status, allowed_next;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_workflow_complaints BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.enforce_complaint_workflow();
