
-- 1. Enhance notifications table with missing columns
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id),
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_record_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Add constraint for severity values
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_severity_check
  CHECK (severity IN ('info', 'warning', 'urgent', 'critical'));

-- 2. Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  critical_only boolean NOT NULL DEFAULT false,
  digest_frequency text NOT NULL DEFAULT 'instant',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT digest_frequency_check CHECK (digest_frequency IN ('instant', 'hourly', 'daily', 'weekly'))
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Create notification_audit_log table (append-only)
CREATE TABLE public.notification_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  source_table text,
  source_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT event_type_check CHECK (event_type IN ('generated', 'delivered', 'read', 'clicked', 'dismissed'))
);

ALTER TABLE public.notification_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view notification audit"
  ON public.notification_audit_log FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role]));

CREATE POLICY "System insert notification audit"
  ON public.notification_audit_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER prevent_delete_notification_audit
  BEFORE DELETE ON public.notification_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_record_deletion();

-- 4. Update notifications RLS to add org-scoped admin access
CREATE POLICY "Admins view org notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    organisation_id = get_user_organisation_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'compliance_officer'::app_role])
  );

-- 5. Auto-log read events via trigger
CREATE OR REPLACE FUNCTION public.log_notification_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.is_read = false AND NEW.is_read = true THEN
    NEW.read_at = now();
    INSERT INTO public.notification_audit_log (notification_id, user_id, event_type, source_table, source_record_id)
    VALUES (NEW.id, auth.uid(), 'read', NEW.source_table, NEW.source_record_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_notification_read_trigger
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.log_notification_read();
