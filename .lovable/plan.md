

# DGTG NDIS Proactive Compliance Operating System

## Overview
A full-stack, accessibility-first compliance platform with 8 core modules, role-based access control, real-time AI monitoring, and audit-ready logging. Built with WCAG AAA compliance, including high-contrast theme, large text mode, screen reader optimization, reduced motion, and simplified interface toggle.

---

## Foundation Layer

### 1. Authentication & Role-Based Access Control
- Supabase Auth with email/password + MFA enforcement for admin/supervisor/compliance/HR roles
- **Roles table** using `app_role` enum: `super_admin`, `compliance_officer`, `supervisor`, `trainer`, `support_worker`, `hr_admin`, `executive`, `participant`
- `user_roles` table with RLS + `has_role()` security definer function
- `user_profiles` table: user_id, team_id, organisation_id, active_status, mfa_enabled, permitted_modules, data_scope, clearance_status
- Session timeout by role, device/geolocation logging, suspicious access alerts

### 2. Accessibility System (WCAG AAA+)
- Global accessibility toolbar (persistent, keyboard-accessible):
  - **High contrast mode** toggle (dark/light/high-contrast themes)
  - **Large text mode** (scales all text up 150%+)
  - **Simplified interface** mode (reduces visual complexity, larger touch targets, simplified navigation)
  - **Reduced motion** toggle (disables all animations)
  - **Screen reader optimized** with proper ARIA landmarks, live regions, skip links
- All interactive elements: visible focus indicators, minimum 44px touch targets
- Color choices never rely on color alone — always include icons/text labels
- Form validation with clear, descriptive error messages linked to fields

### 3. App Shell & Navigation
- Responsive sidebar navigation filtered by user role/permissions
- Breadcrumb navigation on all pages
- Global search with keyboard shortcut
- Notification center for alerts and approvals
- Role indicator in header showing current user's access level

---

## Module 1: Compliance Pulse Dashboard
- Real-time compliance health gauges (0-100%) for:
  - Governance & Operational Management
  - Provision of Supports
  - Support Environment
  - AI Oversight status
- Score auto-decreases based on: overdue policy reviews, expiring staff screening, open incidents >5 days, missing progress notes
- Alert cards for each compliance drop with direct links to resolve
- Executive summary view vs detailed operational view (role-filtered)

## Module 2: Incident Management & Smart Classification
- Incident creation form with guided workflow
- **Auto-classification engine** (Lovable AI): if injury=yes AND type=participant-related → force "Reportable Incident", disable manual override
- Auto-fill NDIS reporting fields and notification deadlines
- Workflow states: Reported → Review → Investigating → Actioned → Closed
- Role-based actions: Trainer=submit only, Supervisor=review (team scope), Compliance Officer=classify/escalate/close
- Closed incidents become read-only; version history on all edits
- No deletion — archive only

## Module 3: Continuous Monitoring Engine ("Heartbeat")
- Lovable AI edge function for sentiment analysis on training interactions
- Detect distress markers, emotional escalation, safeguarding triggers
- **Silent Alert System**: auto-create Draft Incident, assign severity (Low/Medium/High), notify Supervisor
- **Participant Risk Score**: dynamic score based on distress signals, incident history, missed sessions
- Full AI intervention logging: trigger reason, confidence score, action taken, human reviewer

## Module 4: Risk Register
- Risk creation/update by Supervisors (team scope), Compliance Officer (all scope)
- Trainers can submit risk concerns
- Risk mitigation assignment and tracking
- Risk heat map visualization on dashboard

## Module 5: Complaints Management
- Participant self-service complaint submission (accessible form)
- Staff can log complaints received
- Supervisor review within team scope
- Compliance Officer: full complaint handling authority
- Workflow: Submitted → Under Review → Investigating → Resolved → Closed

## Module 6: Policy Management
- Policy CRUD with version control (no overwriting — new versions only)
- Workflow: Draft → Review → Approved → Published
- Compliance Officer/Super Admin move to Review; Director/Super Admin approve
- All staff see approved versions only; version history fully auditable

## Module 7: Dynamic Training Matrix & Staff Compliance
- Competency mapping: each role → required training modules + certifications
- **Enforcement logic**: incomplete training blocks participant assignment/scheduling
- Auto re-certification: 60-day expiry alerts, auto-enroll in refresher training
- Staff compliance dashboard: police checks, worker screening, training certificates, expiry tracking
- HR Admin: full staff file access; Supervisors: limited clearance status view

## Module 8: Participant Profiles & Outcome Tracker
- Participant goal mapping linked to training modules and skill milestones
- Progress tracking: communication skills, call handling, confidence levels
- **Sensitive field masking** by default (DOB, address, phone, government IDs, safeguarding notes)
- "Reveal" button requiring permission + logged reason + auto-expire access
- Success report generator: before/after comparison, measurable improvements, trainer notes
- Evidence storage: assessments, feedback logs, attached files
- Participant self-service portal: view own schedule, progress, submit feedback

---

## Cross-Cutting Features

### Audit Trail
- Every action timestamped with user, device, location
- Full audit log table accessible to Super Admin and Compliance Officer
- Director gets read-only summary view
- Major changes create version history entries

### Digital Privacy Guard
- PII masking with reveal-on-request (logged with reason, user, timestamp, device)
- Geofencing access logs, device type tracking
- Data breach detection: bulk access alerts, unusual login patterns
- IP allowlist option for sensitive roles

### AI Oversight Controls
- AI can: analyze text, suggest drafts, generate summaries, identify missing compliance items
- AI cannot: close incidents, approve complaints/policies, make safeguarding decisions, reveal masked data
- Full AI activity log: source data, trigger reason, confidence score, suggestion, human reviewer

### Approval Workflows
- Policy approval chain (Draft → Review → Approved → Published)
- Incident closure chain with role gates
- Elevated data access: request → supervisor/compliance review → temporary access → auto-expire

---

## Database Schema (Key Tables)
- `organisations`, `teams`, `user_profiles`, `user_roles`
- `participants`, `participant_goals`, `participant_progress`, `participant_risk_scores`
- `incidents`, `incident_versions`, `incident_workflow_history`
- `risks`, `risk_mitigations`
- `complaints`, `complaint_workflow_history`
- `policies`, `policy_versions`
- `staff_compliance`, `training_modules`, `training_completions`, `certifications`
- `audit_logs`, `ai_activity_logs`, `access_reveal_logs`
- `alerts`, `notifications`
- All tables include: organisation_id, created_by, sensitivity_level, record_status

## Tech Stack
- React + TypeScript + Tailwind CSS (WCAG AAA themed)
- Supabase (external): Auth, Database with RLS, Edge Functions, Storage
- Lovable AI: sentiment analysis, incident classification, compliance suggestions
- Real-time subscriptions for alerts and notifications

