# Guardian Guard — NDIS Compliance Operating System

Guardian Guard is a compliance management platform built for NDIS (National Disability Insurance Scheme) service providers. It enforces regulatory obligations at the database level, automates deadline monitoring, and provides real-time notification of compliance events.

## Intended Users

- **Super Admins** — full platform oversight
- **Compliance Officers** — incident review, risk management, policy governance
- **Supervisors** — team-level incident/complaint management
- **HR Admins** — staff screening and clearance tracking
- **Trainers / Support Workers** — incident reporting, participant progress
- **Executives** — read-only compliance dashboards

## Modules

| Module | Purpose |
|---|---|
| **Incidents** | Report, investigate, and close incidents with enforced workflow (draft → submitted → supervisor_review → compliance_review → investigating → actioned → closed) |
| **Complaints** | Track complaints through acknowledgement → investigation → resolution with mandatory fields before closure |
| **Risks** | Risk register with likelihood/impact scoring, mitigation tracking, and review date enforcement |
| **Safeguarding** | Raise and escalate safeguarding concerns with immediate safety risk flagging |
| **Privacy** | Log and manage privacy incidents (unauthorised access, lost devices, data breaches) |
| **Staff Compliance** | Track police checks, WWCC, worker screening expiry — auto-blocks assignment on expiry |
| **Policies** | Version-controlled policy management with staff acknowledgement tracking |
| **Training** | Training modules, completion tracking, and certification management |
| **Participants** | Participant records with goals, progress tracking, and risk scoring |
| **Audit Logs** | Tamper-proof, append-only audit trail on all critical tables |
| **Heartbeat / AI** | AI activity logging with human reviewer tracking and confidence scoring |

## Notification Engine

An automated compliance notification system that generates alerts based on live record state:

- **Stale incidents** — open > 5 days → urgent notification to supervisor + compliance
- **Complaint acknowledgement overdue** — > 2 business days → urgent escalation
- **Staff clearance expiring** — 60 days warning; auto-suspend + critical alert on expiry
- **Safeguarding unactioned** — immediate safety risk open > 24 hours → critical to compliance
- **Policy review overdue** — past review date → warning to owner + compliance
- **High/critical risks** — new high/critical risk → notify compliance officers
- **Repeat complaint trends** — ≥ 3 complaints per participant → compliance alert

Delivery: real-time via database subscriptions with 30-second polling fallback. Notifications are organisation-scoped, role-filtered, and append-only audited.

## Security Model

### Row-Level Security (RLS)

All 31 tables have RLS enabled. Zero `USING (true)` policies. Zero anonymous access. All multi-tenant tables scope access via `get_user_organisation_id(auth.uid())`. Role-based access uses `has_role()` / `has_any_role()` security definer functions.

### Database-Enforced Immutability

Critical tables (`incidents`, `complaints`, `safeguarding_concerns`, `privacy_incidents`, `risks`, `policies`, `audit_logs`) have `prevent_record_deletion()` triggers that raise exceptions on DELETE. Closed records are locked via immutability triggers requiring mandatory fields before closure.

### Workflow Enforcement

- `enforce_incident_workflow()` — restricts status transitions to the defined pipeline
- `enforce_complaint_workflow()` — restricts complaint status transitions
- `prevent_severity_downgrade()` — blocks severity reduction after submission
- `auto_check_staff_eligibility()` — auto-sets `eligible_for_assignment = false` on expired screenings

See [SECURITY.md](SECURITY.md) for the full provable controls matrix.

## Edge Function Automation

`compliance-automation` runs on a scheduled basis (pg_cron) and performs:

1. Staff clearance expiry scanning (60-day warning + auto-suspend)
2. Stale incident detection (> 5 days)
3. Complaint acknowledgement overdue (> 2 days)
4. Policy review overdue / upcoming
5. Safeguarding 24-hour response check
6. Risk review overdue
7. High/critical risk alerting
8. Repeat complaint trend detection

## Tech Stack

- **Frontend**: React 18, TypeScript 5, Vite 5, Tailwind CSS 3, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **State**: TanStack React Query
- **Testing**: Vitest + Testing Library (unit), Playwright (e2e)

## Local Development

```bash
npm install
npm run dev        # Start dev server at http://localhost:5173
```

## Testing

```bash
npm test           # Run all unit tests
npm run test:watch # Run tests in watch mode
npx playwright test # Run e2e tests (requires Playwright browsers)
```

## Environment Configuration

This project uses Lovable Cloud, which auto-manages the `.env` file containing:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Public API endpoint (publishable) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (designed for browser use, secured by RLS) |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier |

These are **not secrets** — security is enforced by RLS policies, not key secrecy. Private keys (service role, DB URL) are stored in Lovable Cloud's encrypted secrets manager and only accessible to Edge Functions at runtime.

## License

Proprietary — all rights reserved.
