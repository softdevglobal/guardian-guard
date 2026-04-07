
-- Enable RLS on organisations and teams
alter table public.organisations enable row level security;
alter table public.teams enable row level security;

-- Fix search_path on update_updated_at
create or replace function public.update_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Organisations policies
create policy "Users can view their organisation"
  on public.organisations for select
  to authenticated
  using (id = public.get_user_organisation_id(auth.uid()));

create policy "Super admins can manage organisations"
  on public.organisations for all
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- Teams policies
create policy "Users can view teams in their org"
  on public.teams for select
  to authenticated
  using (organisation_id = public.get_user_organisation_id(auth.uid()));

create policy "Super admins can manage teams"
  on public.teams for all
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- User roles policies
create policy "Users can view own roles"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

create policy "Super admins can manage all roles"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- User profiles policies
create policy "Users can view own profile"
  on public.user_profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.user_profiles for update
  to authenticated
  using (id = auth.uid());

create policy "Admins compliance HR can view all profiles"
  on public.user_profiles for select
  to authenticated
  using (public.has_any_role(auth.uid(), array['super_admin', 'compliance_officer', 'hr_admin']::public.app_role[]));

create policy "Super admins can manage profiles"
  on public.user_profiles for all
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));
