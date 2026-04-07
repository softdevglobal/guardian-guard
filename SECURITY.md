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

### Why this is audit-safe

| Control | Status |
|---|---|
| Service role key in repo | ❌ Never |
| Anon key in repo | ✅ By design (RLS-protected) |
| RLS on all tables | ✅ Enforced |
| Deletion prevention triggers | ✅ Active |
| Audit trail on all mutations | ✅ Active |
| Immutable closed records | ✅ Enforced |
| Workflow enforcement (DB-level) | ✅ Active |

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
