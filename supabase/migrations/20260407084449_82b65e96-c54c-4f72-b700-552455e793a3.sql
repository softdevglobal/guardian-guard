
-- Drop the overly permissive insert policies
drop policy "Insert audit logs" on public.audit_logs;
drop policy "Insert AI logs" on public.ai_activity_logs;
drop policy "Create alerts" on public.alerts;
drop policy "Create notifications" on public.notifications;

-- Recreate with tighter checks
create policy "Insert audit logs"
  on public.audit_logs for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

create policy "Insert AI logs"
  on public.ai_activity_logs for insert to authenticated
  with check (human_reviewer_id = auth.uid() or human_reviewer_id is null);

create policy "Create alerts"
  on public.alerts for insert to authenticated
  with check (
    organisation_id = public.get_user_organisation_id(auth.uid())
    or public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[])
  );

create policy "Create notifications"
  on public.notifications for insert to authenticated
  with check (
    user_id is not null
  );
