# Guardian Guard — audit evidence system

DGTG Pty Ltd trading as ACSU. This application records evidence of practice so that an
authorised person can prepare for an NDIS certification audit. It does not determine
compliance, does not certify anything and never states that registration is approved.
Every module carries a "requires human review" notice.

## Truthfulness rule

- Allowed language: "audit readiness", "evidence status", "requires human review".
- Never used: "NDIS compliant", "certified", "registration approved".
- Any decision reserved to a person (reportability, restrictive practice authorisation,
  registration group confirmation, SIL enablement) is recorded as a human declaration with
  the assessor, timestamp and rationale.

## Scope mapped in the system

| Area | Where |
| --- | --- |
| Practice standards, outcomes, evidence requirements | Evidence Matrix (`/evidence-matrix`) |
| Rights, consent, support planning, service agreements, transitions | Participant Care (`/participant-care`) |
| Core Module 4.3 Management of medication | Medication (`/medication`) |
| Safe environment, infection control, PPE, Core Module 4.5 waste | Safe Environment (`/safe-environment`) |
| Supported Independent Living standards | SIL (`/sil`) |
| Restrictive practices register | Restrictive Practices (`/restrictive-practices`) |
| Incidents and reportable incident assessment | Incidents → Reportable Assessment tab |
| Complaints, safeguarding, privacy, risk | Existing modules |
| Governance, management review, conflicts of interest, internal audit, registration groups | Governance (`/governance`) |

Registration groups tracked: 0107, 0108, 0109, 0111, 0115, 0117, 0120, 0124, 0133, 0137, 0138.
Confirmation of each group is a human declaration recorded with the confirming user.

## Data guarantees

- Organisation-scoped RLS on every table, with explicit Data API grants.
- Immutable append-only audit logging of create, update, reveal and assessment events.
- `created_at` / `updated_at` on every table with update triggers.
- Archive, never delete: records move to `record_status = 'archived'`; delete triggers block removal.
- Role guards in the UI mirror database triggers; the database remains the enforcement boundary.
- Mock audit mode makes the whole application read only and logs the session.

## Workflow gates enforced in the database and mirrored in the UI

- Evidence requirements cannot be marked ready without a linked policy, evidence and a review date.
- Support plans, service agreements and medication profiles cannot be activated without consent.
- Worker assignment requires a plan briefing and current mandatory training.
- High-risk medication administration requires a recorded double check.
- A failed environment check requires a follow-up action and escalates automatically.
- A SIL tenancy cannot be signed unless it is independent of the service agreement, rights are
  acknowledged and a conflict/safeguarding plan exists.
- A restrictive practice cannot be authorised or put in use without an authorisation reference,
  a behaviour support plan, a least-restrictive review and a named human authoriser.
- An incident cannot be closed until a compliance officer records a reportability assessment.
- A completed internal audit requires findings and a rating; a declared conflict requires mitigation.

## Testing

`bunx vitest run` — gate logic, evidence matrix scoring, notification rules, staff eligibility and
export builders are covered by unit tests. UI screens exercise the same helper functions used by the
tests, so blocked states shown to users match the tested rules.
