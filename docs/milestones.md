# Milestones

## M1: Ops Hub Foundations
**Goal:** lock in data model, Aqua integrations, and baseline documentation so future features land on stable ground.  
**Checklist:**
- [x] Inventory current Supabase schema, Aqua SDK capabilities, and UI surface area.
- [x] Define participant/support approval lifecycle and capture rationale in `ADR.md`.
- [x] Update `DEPLOYMENT.md` and `RUNBOOK.md` with any new services, env vars, or routines discovered during research.
- [x] Scaffold Privy-verified service proxy for privileged Supabase writes.

## M2: Participant Onboarding Flow
**Goal:** deliver the invite → self-submission → ops review path with end-to-end data persistence.  
**Checklist:**
- [x] Implement invite token handling plus wallet/magic-link auth stubs in the frontend.
- [x] Build the participant submission form with draft/submit/cancel states wired to Supabase.
- [x] Document new flows in `RUNBOOK.md` (ops steps) and `THREAT_MODEL.md` (auth + attestation risks).

## M3: Ops Lead Panel & Timeline
**Goal:** create the ops dashboard with metrics, participant table, and per-user timelines backed by live data.  
**Checklist:**
- [ ] Add API queries/selectors for hero metrics, participant listings, and timeline data.
- [ ] Build UI components for metric cards, status table, and timeline modal with verification badges.
- [ ] Extend `ADR.md` with UI state decisions and update `RUNBOOK.md` with monitoring/verification steps.

## M4: QR Check-Ins & Payout Console
**Goal:** enable attendance verification and stipend tracking with Aqua attestations closing the loop.  
**Checklist:**
- [ ] Implement QR scanner view + manual fallback that records check-ins and syncs to Aqua.
- [ ] Create finance payout console with attestation updates and attachment handling.
- [ ] Capture new security considerations in `THREAT_MODEL.md` and payout ops steps in `RUNBOOK.md`.

## M5: Deployment & Debug Hardening
**Goal:** ensure the Ops Hub can be deployed reproducibly with clear troubleshooting guidance.  
**Checklist:**
- [ ] Script migrations, seeds, and environment validation; document them in `DEPLOYMENT.md`.
- [ ] Establish smoke tests / health checks and codify responses within `RUNBOOK.md`.
- [ ] Record lessons learned, edge cases, and fixes in `DEBUG.md`; open follow-up ADRs if needed.
