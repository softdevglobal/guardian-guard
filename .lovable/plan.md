

# Seed Notifications for All Modules

## Problem
The `notifications` table has 0 records. Despite having 10 incidents, 8 complaints, 10 risks, safeguarding concerns, and privacy incidents in the database, no notification records were ever created. The Notifications page shows empty.

## Root Cause
The `compliance-automation` edge function generates notifications when invoked, but it hasn't been triggered. The `incident_escalation_notify` trigger only fires on status changes, not for records inserted via seed migrations (which bypass triggers since they use `SECURITY DEFINER` context or direct SQL).

## Plan

### Step 1: Seed realistic notifications (Data insert, not migration)
Insert ~15-20 notifications into the `notifications` table for the primary user (`fffb42d5-1558-4d85-8fcc-bde2eca867e4`, super_admin) covering:

- **Incidents** (5): Escalation alerts for high/critical incidents, NDIS deadline warnings, stale incident flags
- **Complaints** (3): Acknowledgement overdue, complaint escalated, complaint resolved
- **Risks** (3): Critical risk created, risk score escalated, overdue review
- **Safeguarding** (2): Immediate safety risk raised, safeguarding escalation
- **Privacy** (1): Data breach detected
- **Staff Compliance** (2): Clearance expiring, clearance expired

Each notification will have:
- Correct `user_id`, `organisation_id`
- Appropriate `severity` (critical/urgent/warning/info)
- `source_table` and `source_record_id` linking to real records
- `link` for navigation (e.g., `/incidents`, `/risks`)
- Mix of read/unread states
- Realistic timestamps spread over the last 7 days

### Step 2: Also seed notifications for compliance officer
Insert ~5 notifications for `feac6eb9-...` (compliance@dgtg.demo) so multi-user notification routing is demonstrated.

### No UI changes needed
The Notifications page and NotificationBell component are already fully built with filtering, search, severity badges, tabs, and mark-as-read functionality. They just need data.

## Technical Details
- Use the Supabase insert tool (not migration) since this is data seeding
- All `source_record_id` values will reference real existing record IDs
- Timestamps will be staggered: some from 7 days ago, some from today
- ~5 notifications marked as `is_read = true` to show read/unread contrast

