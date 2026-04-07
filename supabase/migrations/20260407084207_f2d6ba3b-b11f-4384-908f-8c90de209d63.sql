
-- 1. Role enum
create type public.app_role as enum (
  'super_admin',
  'compliance_officer',
  'supervisor',
  'trainer',
  'support_worker',
  'hr_admin',
  'executive',
  'participant'
);

-- 2. Sensitivity level enum
create type public.sensitivity_level as enum ('public', 'internal', 'controlled', 'sensitive', 'highly_sensitive');

-- 3. Record status enum
create type public.record_status as enum ('active', 'archived', 'deleted');

-- 4. Organisations
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abn text,
  ndis_registration text,
  primary_contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Teams
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. User roles (separate table per security requirements)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- 7. User profiles
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  avatar_url text,
  team_id uuid references public.teams(id),
  organisation_id uuid references public.organisations(id),
  active_status boolean not null default true,
  mfa_enabled boolean not null default false,
  permitted_modules text[] default '{}',
  data_scope text default 'self',
  clearance_status text default 'pending',
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- 8. Security definer function: has_role
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- 9. Get user organisation_id (security definer)
create or replace function public.get_user_organisation_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id from public.user_profiles where id = _user_id
$$;

-- 10. Get user team_id (security definer)
create or replace function public.get_user_team_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.user_profiles where id = _user_id
$$;

-- 11. Check if user has any of specified roles
create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = any(_roles)
  )
$$;

-- 12. Auto-create profile on signup trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 13. Updated_at trigger function
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_organisations_updated_at before update on public.organisations for each row execute function public.update_updated_at();
create trigger update_teams_updated_at before update on public.teams for each row execute function public.update_updated_at();
create trigger update_user_profiles_updated_at before update on public.user_profiles for each row execute function public.update_updated_at();
