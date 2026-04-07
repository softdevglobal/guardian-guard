

# Fix Plan: Seed Missing Data for Demo Accounts

## Issues Found

1. **Staff Compliance Records missing for 8 of 9 demo users** — Only Sathindra (`fffb42d5`) has `staff_compliance_records`. The eligibility engine requires BOTH `staff_compliance_records` (Identity Verification, Police Check, WWCC, etc.) AND `training_completions`. Result: 0 Compliant, 7 Non-Compliant, 8 Blocked on the Staff Compliance page.

2. **Notifications empty for Sarah Chen (`admin@dgtg.demo`)** — All 21 notifications were seeded for Sathindra's user_id and the compliance officer. Sarah Chen (`f06ede31`) sees 0 notifications when logged in.

3. **Alex Thompson missing 1 training completion** — Shows 7/8 on Training page (Partial instead of Compliant).

## Fix Steps

### Step 1: Seed `staff_compliance_records` for all 8 remaining demo users
Insert 9 records per user (matching the 9 mandatory requirements: `identity_verification`, `police_check`, `wwcc`, `worker_orientation`, `code_of_conduct`, `privacy_training`, `incident_training`, `safeguarding_training`, `cyber_safety`) with:
- `status = 'verified'`
- `issue_date = '2026-04-01'`, `expiry_date = '2026-05-02'`
- `verified_by` set to a different staff member
- Correct `organisation_id`

This is ~72 rows (8 users × 9 requirements).

### Step 2: Seed notifications for Sarah Chen (`admin@dgtg.demo`)
Insert ~10 notifications for user_id `f06ede31-498a-49f2-9c4b-52b82b222969` covering the same compliance scenarios (incident escalations, risk alerts, complaint overdue, etc.).

### Step 3: Fix Alex Thompson's missing training
Insert the 1 missing `training_completions` record (likely `ADV_SAFEGUARDING` or similar) for `b855e1af`.

### Step 4: Re-evaluate all staff eligibility
After inserting compliance records, trigger `evaluate_staff_eligibility()` for each demo user so the `staff_eligibility_status` table is updated to `compliant` or `expiring_soon`.

## Expected Result
- Staff Compliance page: ~9 Compliant (or Expiring Soon), 0 Non-Compliant, 0 Blocked
- Notifications page: Sarah Chen sees 10+ notifications
- Training page: All 9 staff show 8/8 Compliant
- All pages load without errors

## Technical Approach
- Use Supabase data insert tool (not migrations) for all data seeding
- `verified_by` must differ from `staff_id` to satisfy `prevent_self_verification` trigger

