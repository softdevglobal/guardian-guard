
-- PARTICIPANTS
create policy "Org-wide roles view all participants"
  on public.participants for select to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer','executive']::public.app_role[]));

create policy "Supervisors view team participants"
  on public.participants for select to authenticated
  using (public.has_role(auth.uid(), 'supervisor') and team_id = public.get_user_team_id(auth.uid()));

create policy "Trainers view assigned participants"
  on public.participants for select to authenticated
  using (public.has_any_role(auth.uid(), array['trainer','support_worker']::public.app_role[]) and assigned_trainer_id = auth.uid());

create policy "Admins compliance manage participants"
  on public.participants for all to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

create policy "Supervisors update team participants"
  on public.participants for update to authenticated
  using (public.has_role(auth.uid(), 'supervisor') and team_id = public.get_user_team_id(auth.uid()));

-- PARTICIPANT GOALS
create policy "View participant goals"
  on public.participant_goals for select to authenticated
  using (exists (select 1 from public.participants p where p.id = participant_id and (
    (p.organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]))
    or (p.team_id = public.get_user_team_id(auth.uid()) and public.has_role(auth.uid(), 'supervisor'))
    or p.assigned_trainer_id = auth.uid())));

create policy "Manage participant goals"
  on public.participant_goals for all to authenticated
  using (exists (select 1 from public.participants p where p.id = participant_id and (
    (p.organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]))
    or p.assigned_trainer_id = auth.uid())));

-- PARTICIPANT PROGRESS
create policy "View participant progress"
  on public.participant_progress for select to authenticated
  using (exists (select 1 from public.participants p where p.id = participant_id and (
    (p.organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]))
    or (p.team_id = public.get_user_team_id(auth.uid()) and public.has_role(auth.uid(), 'supervisor'))
    or p.assigned_trainer_id = auth.uid())));

create policy "Record participant progress"
  on public.participant_progress for insert to authenticated
  with check (recorded_by = auth.uid());

-- PARTICIPANT RISK SCORES
create policy "View risk scores"
  on public.participant_risk_scores for select to authenticated
  using (exists (select 1 from public.participants p where p.id = participant_id and (
    (p.organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]))
    or (p.team_id = public.get_user_team_id(auth.uid()) and public.has_role(auth.uid(), 'supervisor'))
    or p.assigned_trainer_id = auth.uid())));

-- INCIDENTS
create policy "Org-wide view incidents"
  on public.incidents for select to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

create policy "Supervisors view team incidents"
  on public.incidents for select to authenticated
  using (public.has_role(auth.uid(), 'supervisor') and team_id = public.get_user_team_id(auth.uid()));

create policy "Staff view own incidents"
  on public.incidents for select to authenticated
  using (reported_by = auth.uid());

create policy "Staff create incidents"
  on public.incidents for insert to authenticated
  with check (reported_by = auth.uid() and organisation_id = public.get_user_organisation_id(auth.uid()));

create policy "Compliance manage incidents"
  on public.incidents for update to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

create policy "Supervisors update team incidents"
  on public.incidents for update to authenticated
  using (public.has_role(auth.uid(), 'supervisor') and team_id = public.get_user_team_id(auth.uid()) and status != 'closed');

-- INCIDENT VERSIONS
create policy "View incident versions"
  on public.incident_versions for select to authenticated
  using (exists (select 1 from public.incidents i where i.id = incident_id and (
    (i.organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]))
    or i.reported_by = auth.uid())));

create policy "Create incident versions"
  on public.incident_versions for insert to authenticated
  with check (changed_by = auth.uid());

-- INCIDENT WORKFLOW
create policy "View incident workflow"
  on public.incident_workflow_history for select to authenticated
  using (exists (select 1 from public.incidents i where i.id = incident_id and (
    (i.organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]))
    or i.reported_by = auth.uid())));

create policy "Create incident workflow"
  on public.incident_workflow_history for insert to authenticated
  with check (changed_by = auth.uid());

-- RISKS
create policy "Org-wide view risks"
  on public.risks for select to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer','executive']::public.app_role[]));

create policy "Supervisors view team risks"
  on public.risks for select to authenticated
  using (public.has_role(auth.uid(), 'supervisor') and team_id = public.get_user_team_id(auth.uid()));

create policy "Staff view own risks"
  on public.risks for select to authenticated
  using (created_by = auth.uid());

create policy "Staff create risks"
  on public.risks for insert to authenticated
  with check (created_by = auth.uid() and organisation_id = public.get_user_organisation_id(auth.uid()));

create policy "Compliance manage risks"
  on public.risks for update to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer','supervisor']::public.app_role[]));

-- RISK MITIGATIONS
create policy "View risk mitigations"
  on public.risk_mitigations for select to authenticated
  using (exists (select 1 from public.risks r where r.id = risk_id and r.organisation_id = public.get_user_organisation_id(auth.uid())));

create policy "Create risk mitigations"
  on public.risk_mitigations for insert to authenticated
  with check (created_by = auth.uid());

-- COMPLAINTS
create policy "Org-wide view complaints"
  on public.complaints for select to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

create policy "Supervisors view team complaints"
  on public.complaints for select to authenticated
  using (public.has_role(auth.uid(), 'supervisor') and team_id = public.get_user_team_id(auth.uid()));

create policy "Users view own complaints"
  on public.complaints for select to authenticated
  using (submitted_by = auth.uid());

create policy "Users submit complaints"
  on public.complaints for insert to authenticated
  with check (organisation_id = public.get_user_organisation_id(auth.uid()));

create policy "Compliance manage complaints"
  on public.complaints for update to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

-- COMPLAINT WORKFLOW
create policy "View complaint workflow"
  on public.complaint_workflow_history for select to authenticated
  using (exists (select 1 from public.complaints c where c.id = complaint_id and c.organisation_id = public.get_user_organisation_id(auth.uid())));

create policy "Create complaint workflow"
  on public.complaint_workflow_history for insert to authenticated
  with check (changed_by = auth.uid());

-- POLICIES
create policy "Staff view published policies"
  on public.policies for select to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and (
    status = 'published' or public.has_any_role(auth.uid(), array['super_admin','compliance_officer','executive']::public.app_role[])));

create policy "Compliance manage policies"
  on public.policies for all to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

-- POLICY VERSIONS
create policy "View policy versions"
  on public.policy_versions for select to authenticated
  using (exists (select 1 from public.policies p where p.id = policy_id and p.organisation_id = public.get_user_organisation_id(auth.uid())));

create policy "Create policy versions"
  on public.policy_versions for insert to authenticated
  with check (created_by = auth.uid() and public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

-- TRAINING MODULES
create policy "Staff view training modules"
  on public.training_modules for select to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()));

create policy "Admins manage training modules"
  on public.training_modules for all to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()) and public.has_any_role(auth.uid(), array['super_admin','hr_admin','compliance_officer']::public.app_role[]));

-- TRAINING COMPLETIONS
create policy "Users view own training"
  on public.training_completions for select to authenticated
  using (user_id = auth.uid());

create policy "HR admins view all training"
  on public.training_completions for select to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','hr_admin','compliance_officer']::public.app_role[]));

create policy "HR manage training"
  on public.training_completions for all to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','hr_admin']::public.app_role[]));

-- CERTIFICATIONS
create policy "Users view own certs"
  on public.certifications for select to authenticated
  using (user_id = auth.uid());

create policy "HR view all certs"
  on public.certifications for select to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','hr_admin','compliance_officer']::public.app_role[]));

create policy "HR manage certs"
  on public.certifications for all to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','hr_admin']::public.app_role[]));

-- STAFF COMPLIANCE
create policy "Users view own compliance"
  on public.staff_compliance for select to authenticated
  using (user_id = auth.uid());

create policy "HR view all compliance"
  on public.staff_compliance for select to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','hr_admin','compliance_officer']::public.app_role[]));

create policy "HR manage compliance"
  on public.staff_compliance for all to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','hr_admin']::public.app_role[]));

create policy "Supervisors view team compliance"
  on public.staff_compliance for select to authenticated
  using (public.has_role(auth.uid(), 'supervisor') and exists (
    select 1 from public.user_profiles up where up.id = user_id and up.team_id = public.get_user_team_id(auth.uid())));

-- AUDIT LOGS
create policy "Admins compliance view audit"
  on public.audit_logs for select to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

create policy "Executives view audit"
  on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(), 'executive'));

create policy "Insert audit logs"
  on public.audit_logs for insert to authenticated
  with check (true);

-- AI ACTIVITY LOGS
create policy "Admins compliance view AI logs"
  on public.ai_activity_logs for select to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

create policy "Insert AI logs"
  on public.ai_activity_logs for insert to authenticated
  with check (true);

-- ACCESS REVEAL LOGS
create policy "Admins view reveal logs"
  on public.access_reveal_logs for select to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

create policy "Users log own reveals"
  on public.access_reveal_logs for insert to authenticated
  with check (user_id = auth.uid());

-- ALERTS
create policy "View assigned alerts"
  on public.alerts for select to authenticated
  using (assigned_to = auth.uid() or public.has_any_role(auth.uid(), array['super_admin','compliance_officer']::public.app_role[]));

create policy "Create alerts"
  on public.alerts for insert to authenticated
  with check (true);

create policy "Update own alerts"
  on public.alerts for update to authenticated
  using (assigned_to = auth.uid());

-- NOTIFICATIONS
create policy "View own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "Update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid());

create policy "Create notifications"
  on public.notifications for insert to authenticated
  with check (true);
