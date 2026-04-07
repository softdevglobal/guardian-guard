
-- Incident enums
create type public.incident_status as enum ('reported', 'review', 'investigating', 'actioned', 'closed');
create type public.incident_severity as enum ('low', 'medium', 'high', 'critical');
create type public.complaint_status as enum ('submitted', 'under_review', 'investigating', 'resolved', 'closed');
create type public.policy_status as enum ('draft', 'review', 'approved', 'published', 'archived');

-- PARTICIPANTS
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  team_id uuid references public.teams(id),
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  phone text,
  email text,
  address text,
  government_id text,
  ndis_number text,
  status text not null default 'active',
  assigned_trainer_id uuid references auth.users(id),
  sensitivity_level public.sensitivity_level not null default 'sensitive',
  record_status public.record_status not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.participants enable row level security;

create table public.participant_goals (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  status text not null default 'in_progress',
  linked_training_module_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.participant_goals enable row level security;

create table public.participant_progress (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  goal_id uuid references public.participant_goals(id),
  metric_name text not null,
  metric_value numeric,
  notes text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.participant_progress enable row level security;

create table public.participant_risk_scores (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  score integer not null default 0 check (score >= 0 and score <= 100),
  distress_signals integer not null default 0,
  incident_count integer not null default 0,
  missed_sessions integer not null default 0,
  trend text default 'stable',
  calculated_at timestamptz not null default now()
);
alter table public.participant_risk_scores enable row level security;

-- INCIDENTS
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  team_id uuid references public.teams(id),
  incident_number text not null unique,
  title text not null,
  description text,
  incident_type text not null,
  status public.incident_status not null default 'reported',
  severity public.incident_severity not null default 'medium',
  injury_involved boolean not null default false,
  is_reportable boolean not null default false,
  participant_id uuid references public.participants(id),
  reported_by uuid not null references auth.users(id),
  assigned_to uuid references auth.users(id),
  ndis_notification_deadline timestamptz,
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  sensitivity_level public.sensitivity_level not null default 'sensitive',
  record_status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.incidents enable row level security;

create table public.incident_versions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  version_number integer not null,
  changes jsonb not null default '{}',
  changed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.incident_versions enable row level security;

create table public.incident_workflow_history (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  from_status public.incident_status,
  to_status public.incident_status not null,
  changed_by uuid not null references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);
alter table public.incident_workflow_history enable row level security;

-- RISKS
create table public.risks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  team_id uuid references public.teams(id),
  title text not null,
  description text,
  category text not null,
  likelihood text not null,
  impact text not null,
  status text not null default 'open',
  created_by uuid not null references auth.users(id),
  assigned_to uuid references auth.users(id),
  sensitivity_level public.sensitivity_level not null default 'controlled',
  record_status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.risks enable row level security;

create table public.risk_mitigations (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references public.risks(id) on delete cascade,
  action text not null,
  status text not null default 'pending',
  assigned_to uuid references auth.users(id),
  due_date date,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.risk_mitigations enable row level security;

-- COMPLAINTS
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  team_id uuid references public.teams(id),
  complaint_number text not null unique,
  subject text not null,
  description text,
  submitted_by uuid references auth.users(id),
  submitted_by_name text,
  participant_id uuid references public.participants(id),
  status public.complaint_status not null default 'submitted',
  priority text not null default 'medium',
  assigned_to uuid references auth.users(id),
  resolved_at timestamptz,
  sensitivity_level public.sensitivity_level not null default 'controlled',
  record_status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.complaints enable row level security;

create table public.complaint_workflow_history (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  from_status public.complaint_status,
  to_status public.complaint_status not null,
  changed_by uuid not null references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);
alter table public.complaint_workflow_history enable row level security;

-- POLICIES
create table public.policies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  current_version integer not null default 1,
  status public.policy_status not null default 'draft',
  owner_id uuid references auth.users(id),
  last_review_date date,
  next_review_date date,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  published_at timestamptz,
  record_status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.policies enable row level security;

create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  version_number integer not null,
  content text,
  change_summary text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.policy_versions enable row level security;

-- TRAINING
create table public.training_modules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  description text,
  module_type text not null default 'mandatory',
  duration_hours numeric,
  required_for_roles public.app_role[] default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.training_modules enable row level security;

create table public.training_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  completion_date timestamptz,
  score numeric,
  certificate_url text,
  expiry_date date,
  status text not null default 'enrolled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_id)
);
alter table public.training_completions enable row level security;

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  issuer text,
  issue_date date not null,
  expiry_date date,
  certificate_url text,
  status text not null default 'current',
  created_at timestamptz not null default now()
);
alter table public.certifications enable row level security;

-- STAFF COMPLIANCE
create table public.staff_compliance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  police_check_status text not null default 'pending',
  police_check_date date,
  police_check_expiry date,
  wwcc_status text not null default 'pending',
  wwcc_number text,
  wwcc_expiry date,
  worker_screening_status text not null default 'pending',
  worker_screening_expiry date,
  overall_compliance_pct integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.staff_compliance enable row level security;

-- AUDIT & AI LOGS
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id),
  user_id uuid references auth.users(id),
  user_name text,
  action text not null,
  module text not null,
  record_id uuid,
  details jsonb default '{}',
  severity text not null default 'normal',
  ip_address text,
  device_info text,
  geolocation text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;

create table public.ai_activity_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id),
  trigger_reason text not null,
  source_data_ref text,
  confidence_score numeric,
  action_taken text not null,
  suggestion text,
  result jsonb default '{}',
  human_reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ai_activity_logs enable row level security;

create table public.access_reveal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  participant_id uuid not null references public.participants(id),
  field_accessed text not null,
  reason text not null,
  ip_address text,
  device_info text,
  geolocation text,
  access_granted boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.access_reveal_logs enable row level security;

-- ALERTS & NOTIFICATIONS
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id),
  alert_type text not null,
  severity text not null default 'medium',
  title text not null,
  message text,
  source_module text,
  source_record_id uuid,
  is_read boolean not null default false,
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.alerts enable row level security;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text,
  notification_type text not null default 'info',
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

-- Updated_at triggers
create trigger update_participants_updated_at before update on public.participants for each row execute function public.update_updated_at();
create trigger update_participant_goals_updated_at before update on public.participant_goals for each row execute function public.update_updated_at();
create trigger update_incidents_updated_at before update on public.incidents for each row execute function public.update_updated_at();
create trigger update_risks_updated_at before update on public.risks for each row execute function public.update_updated_at();
create trigger update_complaints_updated_at before update on public.complaints for each row execute function public.update_updated_at();
create trigger update_policies_updated_at before update on public.policies for each row execute function public.update_updated_at();
create trigger update_training_modules_updated_at before update on public.training_modules for each row execute function public.update_updated_at();
create trigger update_training_completions_updated_at before update on public.training_completions for each row execute function public.update_updated_at();
create trigger update_staff_compliance_updated_at before update on public.staff_compliance for each row execute function public.update_updated_at();
