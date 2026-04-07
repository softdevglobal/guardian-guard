

# Fix: Seed Training Completions for Sathindra Gurusinghe

## Problem
The eligibility engine checks both `staff_compliance_records` and `training_completions`. While all 9 compliance records are verified, the `training_completions` table has **zero rows** for this user. The 8 mandatory training requirements all fail, blocking assignment.

## Root Cause
The seed migration created `staff_compliance_records` but never inserted corresponding `training_completions` records. These are two independent checks in `evaluate_staff_eligibility()`.

## Fix

### Step 1: Seed training completions for all demo staff
Insert `training_completions` rows for Sathindra (`fffb42d5-...`) and all other demo users who have compliance records but missing training records. Each row needs:
- `user_id`, `training_code` (matching all 8 mandatory codes)
- `status = 'completed'`, `score = 95`, `completion_date` in the past
- `verified_by` set to a different staff member (compliance officer)
- `expiry_date` set to match their compliance record expiry (~May 2, 2026)
- `organisation_id` matching their profile

### Step 2: Re-evaluate eligibility
After inserting training records, the `reevaluate_on_training_change` trigger will automatically call `evaluate_staff_eligibility()`, updating the status from "non_compliant/blocked" to "compliant/eligible".

### No code changes needed
The UI and eligibility logic are correct. This is purely a data gap from incomplete seeding.

## Technical Detail
- Use the Supabase insert tool (not migration) for data seeding
- 8 training codes x ~9 demo users = ~72 rows
- `verified_by` must differ from `user_id` (enforced by `prevent_training_self_verification` trigger)

