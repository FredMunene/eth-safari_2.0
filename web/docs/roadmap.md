# ETH Safari Ops Hub Roadmap

This roadmap turns the Ops Hub concept into an execution plan that a small hackathon team can tackle in sprints. Adjust timelines based on team size and hackathon length.

## Phase 0 — Foundation (Day 0)
- Align on success metrics: sponsored participants processed, payment proofs logged, QR check-ins captured.
- Confirm tech stack: Aqua SDK, front-end framework, lightweight backend (Supabase/serverless) for session handling.
- Sketch user journeys for ops leads, travelers, volunteers.

## Phase 1 — Prototype Core Loop (Days 1–2)
- Build travel approval form and admin dashboard list.
- Mint Aqua attestations for approvals (status, stipend amount, QR token).
- Generate QR codes + scanner page to record attendance tied to the attestation.
- Demo loop: approval issued → QR scanned → check-in visible on dashboard.

## Phase 2 — Close the Payment Loop (Day 3)
- Add stipend disbursement tracker with proof-of-payment upload or on-chain tx hash.
- Update Aqua record (or issue follow-up attestation) to mark payouts complete.
- Show participant timeline: approval → arrival → payout.

## Phase 3 — Reliability & UX Polish (Day 4)
- Add audit log export (CSV/JSON) for verifiable trails.
- Implement role-based access (ops lead, volunteer scanner, finance approver).
- Harden UI states and mobile responsiveness for on-site staff.

## Phase 4 — Storytelling & Handoff (Day 5)
- Record a <2 min Loom showing the end-to-end Ops Hub flow.
- Document integration hooks (webhooks/APIs) for ETH Safari organizers.
- List stretch goals (multi-event support, SMS alerts, analytics) for post-hackathon follow-up.

### Parallel Workstreams
- **Data & Trust:** Aqua schema, attestation logic, verification scripts.
- **Product & UX:** Dashboard, QR scanner, approval forms, responsive layouts.
- **Ops Playbook:** Process docs, checklists, onboarding guide for organizers.

Deliver the Phase 1 loop first—judges value working software with a clear path to later phases.
