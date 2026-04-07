

# Fix: Data Linkage and Relevancy Across Full Site

## Problems Found

1. **Complaints table is empty** (0 records) — complaints demo data was never seeded despite the Complaints Management system being built. The seeding edge function only ran for participants, incidents, and risks.

2. **Safeguarding concerns empty** (0 records), **Privacy incidents empty** (0 records), **Alerts empty** (0 records) — no demo data seeded for these modules.

3. **Dashboard shows all zeros** — The Dashboard queries for incidents, complaints, safeguarding, and privacy all return 0 or default 100% because either:
   - Tables are empty (complaints, safeguarding, privacy, alerts)
   - RLS blocks the current user from seeing data (user may not have `organisation_id` set or correct role)

4. **User profile `organisation_id` may be null** — The primary user (`fffb42d5-...`, Sathindra Gurusinghe) has `organisation_id = null`, so all RLS policies using `get_user_organisation_id(auth.uid())` return null, blocking every query. This is the **root cause** of data not reflecting.

5. **Risk linkage to complaints broken** — All 10 risks have `linked_complaint_id = null` because complaints table is empty.

6. **Staff compliance only has 2 records**, both at 0% — no meaningful demo data.

## Plan

### Step 1: Fix user profile organisation linkage (Migration)
- Update the primary user profile (`fffb42d5-...`) to set `organisation_id = '607ad2d2-6cb9-48c6-a0d0-8082a904adf1'` so RLS policies pass.
- Ensure all demo user profiles have the correct `organisation_id`.

### Step 2: Seed complaints demo data (Migration)
- Insert 8-10 complaint records across various statuses (submitted, acknowledged, under_review, investigating, resolved, closed).
- Include realistic NDIS-relevant scenarios: service quality, staff conduct, communication failures.
- Set correct `organisation_id`, `complaint_number`, timestamps, and acknowledgement dates.
- Link some risks to these complaints via `linked_complaint_id` updates.

### Step 3: Seed safeguarding, privacy incidents, and alerts (Migration)
- Insert 3-5 safeguarding concerns with varying severity and escalation levels.
- Insert 2-3 privacy incidents.
- Insert 5-8 alerts covering overdue reviews, critical risks, and stale complaints.

### Step 4: Update staff compliance demo data (Migration)
- Update existing 2 records with realistic compliance percentages and check statuses.
- Add 3-4 more staff compliance records tied to existing user profiles.

### Step 5: Fix Dashboard queries resilience
- Update `Dashboard.tsx` queries to handle cases where `record_status` column doesn't exist on some tables (safeguarding_concerns, complaints already have it, but ensure consistency).
- Ensure the pulse score queries don't silently fail.

### Step 6: Fix risks linkage to new complaints
- Update risk records RSK-004 and RSK-005 to link to newly seeded complaint IDs.

## Technical Details

- All data seeding via SQL migration (single migration file)
- Organisation ID `607ad2d2-6cb9-48c6-a0d0-8082a904adf1` used consistently
- Complaint numbers follow `CMP-2026-XXXX` pattern
- RLS fix is the critical path — without org_id on user profile, nothing displays

