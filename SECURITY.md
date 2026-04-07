# Security Policy — DGTG Guardian

## Environment Variables (.env)

The `.env` file in this repository contains **only publishable/anon keys** intended for client-side use:

- `VITE_SUPABASE_URL` — Public API endpoint (equivalent to a website URL)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon key (designed for browser exposure)
- `VITE_SUPABASE_PROJECT_ID` — Project identifier

**These are NOT secrets.** Supabase's security model — like Firebase and Stripe — relies on Row-Level Security (RLS) policies, not key secrecy. The anon key grants only the permissions defined by RLS.

The `.env` file is auto-managed by the Lovable Cloud platform and cannot be removed from the repository.

### Private Keys & Secrets

All private/service-role keys are stored in Lovable Cloud's encrypted secrets manager and are:

- **Never** committed to the repository
- **Never** exposed in client-side code
- **Only** accessible to Edge Functions at runtime via `Deno.env.get()`

Managed secrets include:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- Any third-party API keys

---

## Enforcement Layer — Provable Controls

### 1. Row-Level Security (RLS)

| Control | Evidence |
|---|---|
| RLS enabled | ✅ All 31 tables — zero exceptions |
| `USING (true)` policies | ✅ Zero found |
| `anon` role access | ✅ Zero — all policies require `authenticated` |
| Organisation scoping | ✅ All multi-tenant tables use `get_user_organisation_id(auth.uid())` |
| Role-based access | ✅ All sensitive tables use `has_role()` / `has_any_role()` security definer functions |
| DELETE policies | ✅ Zero DELETE policies on any critical table |

### 2. Immutability — Database-Enforced

All critical tables have `prevent_record_deletion()` triggers that **raise an exception** on any DELETE attempt:

| Table | Delete Prevention | Closed Record Immutability | Closure Validation |
|---|---|---|---|
| `incidents` | ✅ trigger | ✅ trigger | ✅ requires: root_cause, corrective_actions, contributing_factors, participant_followup |
| `complaints` | ✅ trigger | ✅ trigger | ✅ requires: resolution_actions, outcome_communicated_date |
| `safeguarding_concerns` | ✅ trigger | ✅ trigger | ✅ requires: outcome, review_notes |
| `privacy_incidents` | ✅ trigger | ✅ trigger | ✅ requires: corrective_action |
| `risks` | ✅ trigger | ✅ trigger | — |
| `policies` | ✅ trigger | — | — |
| `audit_logs` | ✅ trigger | — | — (append-only: no UPDATE/DELETE RLS policies) |

### 3. Workflow Enforcement — Database-Level Triggers

| Control | Trigger Function | Effect |
|---|---|---|
| Incident status transitions | `enforce_incident_workflow()` | Only allows: draft→submitted→supervisor_review→compliance_review→investigating→actioned→closed |
| Complaint status transitions | `enforce_complaint_workflow()` | Only allows: submitted→acknowledged→under_review→investigating→resolved→closed |
| Severity downgrade prevention | `prevent_severity_downgrade()` | Cannot reduce severity once set — raises exception |

### 4. Audit Trail

Automatic `audit_trail_trigger()` on every INSERT and UPDATE for:
- `incidents`, `complaints`, `risks`, `safeguarding_concerns`, `privacy_incidents`, `policies`, `staff_compliance`, `participants`

Each log entry captures: `user_id`, `user_name`, `action`, `module`, `record_id`, `organisation_id`, `details` (full old/new JSON diff), `timestamp`.

Audit logs are **tamper-proof**:
- No UPDATE RLS policy
- No DELETE RLS policy  
- `prevent_record_deletion()` trigger blocks any delete attempt

### 5. Staff Compliance — Auto-Enforced

| Control | Mechanism |
|---|---|
| Block assignment on expired checks | `auto_check_staff_eligibility()` trigger — sets `eligible_for_assignment = false` when any screening is expired |
| Auto-calculate compliance % | `auto_calculate_compliance_pct()` trigger — scores 10 checkpoints |
| Hourly expiry scanning | `compliance-automation` edge function via `pg_cron` — auto-suspends expired staff, sends alerts |

### 6. AI Safety Controls

| Control | Status |
|---|---|
| AI activity logging table | ✅ `ai_activity_logs` — all AI actions recorded |
| Human reviewer tracking | ✅ `human_reviewer_id` + `reviewed_at` fields |
| AI confidence scoring | ✅ `confidence_score` field on all AI suggestions |
| AI logs append-only | ✅ No UPDATE or DELETE RLS policies |
| AI access restricted | ✅ Only super_admin and compliance_officer can view |

---

## Reporting Vulnerabilities

Contact: admin@dgtg.demo

## Compliance Framework

This system is built to meet NDIS Practice Standards including:
- Incident Management (NDIS Act s73Z)
- Complaints Management
- Risk Management  
- Worker Screening
- Privacy & Information Management
- Governance & Operational Management
