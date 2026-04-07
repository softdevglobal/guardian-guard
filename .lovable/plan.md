

# Non-Working Functions Audit

After reviewing every page and component, here is the complete list of buttons, actions, and features that are currently non-functional (using mock data or doing nothing on click):

---

## GLOBAL / APP SHELL

1. **Global Search (Header)** — Search input does nothing; no Ctrl+K shortcut handler
2. **Notifications Bell (Header)** — Hardcoded "4" badge; clicking does nothing; no notifications panel/dropdown
3. **Logout Button (Header)** — Sets user to null in-memory only; no real Supabase auth session to end
4. **No Login/Signup Pages** — No authentication flow exists; the app uses a hardcoded demo user (`DEMO_USER`)

---

## DASHBOARD

5. **Compliance Gauges** — Hardcoded scores (87%, 72%, 91%, 95%); not computed from real database data
6. **Stats Cards** — Hardcoded values (3 incidents, 24 participants, etc.); no database queries
7. **Recent Alerts** — Static mock array; not fetched from `alerts` table
8. **Alert Items not clickable** — No navigation to the related record

---

## INCIDENTS

9. **"Report Incident" form submit** — `onSubmit` calls `e.preventDefault()` only; no data saved to database
10. **Smart Classification logic** — The warning text is shown but no actual auto-classification runs (no AI call, no forced reportable status)
11. **Incident table rows not clickable** — Cursor pointer but no onClick handler; no detail/edit view
12. **All data is mock** — Not fetched from `incidents` table

---

## RISKS

13. **"Add Risk" button** — No onClick handler; does nothing
14. **Risk summary cards** — Hardcoded counts; not computed
15. **Risk rows not clickable** — No detail/edit view
16. **All data is mock** — Not fetched from `risks` table

---

## COMPLAINTS

17. **"Log Complaint" button** — No onClick handler; does nothing
18. **Complaint rows not clickable** — No detail/edit view
19. **All data is mock** — Not fetched from `complaints` table

---

## POLICIES

20. **"Create Policy" button** — No onClick handler; does nothing
21. **Policy summary cards** — Hardcoded counts
22. **Policy rows not clickable** — No detail/edit/version view
23. **All data is mock** — Not fetched from `policies` table

---

## PARTICIPANTS

24. **"Add Participant" button** — No onClick handler; does nothing
25. **PII Reveal/Mask toggle** — Works visually with mock data but does NOT log access to `access_reveal_logs` table; no reason prompt
26. **Participant rows not clickable** — No detail/goals/progress view
27. **All data is mock** — Not fetched from `participants` table

---

## STAFF COMPLIANCE

28. **"Add Staff Member" button** — No onClick handler; does nothing
29. **Staff summary cards** — Hardcoded counts
30. **Staff rows not clickable** — No detail/edit view
31. **All data is mock** — Not fetched from `staff_compliance` / `user_profiles` tables

---

## TRAINING

32. **No "Add Module" button** — No way to create training modules
33. **Training summary cards** — Hardcoded counts
34. **Module rows not clickable** — No detail/enrollment view
35. **All data is mock** — Not fetched from `training_modules` / `training_completions` tables

---

## AUDIT LOGS

36. **Search and filter work** — But only against mock data array
37. **All data is mock** — Not fetched from `audit_logs` table

---

## HEARTBEAT

38. **All monitoring data is mock** — No real AI sentiment analysis running
39. **No AI edge function deployed** — No Lovable AI integration for distress detection
40. **Alert items not actionable** — No way to view/escalate/dismiss alerts
41. **Risk scores static** — Not fetched from `participant_risk_scores` table

---

## SETTINGS

42. **Organisation Details "Save Changes"** — No onClick/onSubmit; does nothing
43. **Security toggles (MFA, IP Allowlist, etc.)** — Visual only; no state persistence
44. **Notification preference toggles** — Visual only; no state persistence
45. **Role "Configure" buttons** — No onClick handler; does nothing
46. **Session timeout input** — Not saved anywhere

---

## CROSS-CUTTING (NOT IMPLEMENTED)

47. **No real authentication** — No login/signup pages, no Supabase Auth integration
48. **No real RBAC enforcement** — Demo user bypasses all; roles table exists but isn't used
49. **No audit trail logging** — Actions don't write to `audit_logs` table
50. **No approval workflows** — No policy approval chain, no incident closure gates
51. **No data masking with access logging** — Reveal doesn't prompt for reason or log to DB
52. **No real-time subscriptions** — No Supabase realtime channels connected
53. **No file upload/storage** — No storage buckets for certificates, evidence, etc.

---

## Summary

| Category | Non-Working Items |
|---|---|
| Authentication & RBAC | 4 items (no login, no real roles, no MFA) |
| Database connectivity | 10 pages all use mock data (0 live queries) |
| Create/Add buttons | 7 buttons do nothing |
| Form submissions | 2 forms don't save (Incident, Settings) |
| Detail/Edit views | 8 tables have no row click actions |
| AI / Heartbeat | 3 items (no edge function, no sentiment analysis) |
| Cross-cutting features | 7 items (audit logging, workflows, realtime, storage) |
| **Total** | **~53 non-functional items** |

---

## Recommended Implementation Order

1. **Authentication** — Login/signup pages + connect AuthContext to Supabase Auth
2. **Wire Dashboard + Incidents to live DB** — Replace mock data with real queries; implement incident creation form
3. **Wire remaining modules** — Participants, Risks, Complaints, Policies, Staff, Training, Audit Logs
4. **Add detail/edit views** — Row click opens detail panel or page for each module
5. **Implement audit trail logging** — Write to `audit_logs` on every create/update action
6. **PII masking with access logging** — Reveal prompt with reason, write to `access_reveal_logs`
7. **Settings persistence** — Save org details and preferences to database
8. **Notifications system** — Real notification bell with dropdown from `notifications` table
9. **Global search** — Search across modules with Ctrl+K
10. **AI Heartbeat edge function** — Deploy Lovable AI sentiment analysis
11. **Approval workflows** — Policy and incident state machines with role gates
12. **Real-time subscriptions** — Live alerts for incidents and heartbeat triggers

