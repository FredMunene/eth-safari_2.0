# Architecture Decision Records

## ADR-001: Participant & Support Approval Lifecycle on Supabase
**Status:** Accepted  
**Date:** 2025-11-13  

**Context:**  
- Ops Hub must support invite-driven onboarding, travel/support approvals, QR check-ins, and payout attestations for ETH Safari.  
- The UI needs consistent data for the Ops Panel, Participant Portal, QR scanner, and finance workflows, plus timelines that combine on/off-chain evidence.  
- We already provisions Supabase tables (`participants`, `travel_approvals`, `check_ins`, `payouts`, `activity_log`) and need a canonical lifecycle that explains how each surface reads/writes those rows while preserving Aqua attestation hashes and verification flags.  

**Decision:**  
- Treat `participants` as immutable profile records referenced by every support approval.  
- Store each travel/support approval in `travel_approvals` with statuses `pending → approved | rejected`, QR token, stipend metadata, and Aqua attestation hash slots once minted.  
- Model operational steps as follow-up tables: `check_ins` capture QR scans, `payouts` record stipend execution with proof metadata, and `activity_log` mirrors every state transition for feeds.  
- Surfaces derive state as follows: Ops Panel pulls hero metrics and tables from `travel_approvals` + `payouts`; Participant Timeline stitches approvals, check-ins, and payouts; QR scanner writes to `check_ins`; finance console updates `payouts` and appends activity log entries.  
- Aqua attestations are optional but strongly encouraged for every table row; verification badges read `aqua_attestation_hash` or `aqua_verified`.  

**Alternatives Considered:**  
- **Single JSON document per participant** — Pros: fewer tables, simpler inserts. Cons: complex filtering, brittle concurrency, hard to expose partial data to limited-scope clients (QR scanner, participant portal).  
- **Pure event-sourced ledger (activity_log only)** — Pros: append-only, auditable, easier Aqua anchoring. Cons: every view would require heavy event reduction, hard to enforce relational constraints (stipend totals, role-based inserts), more complex Supabase policies.  

**Consequences:**  
- Positive: normalized relations make Supabase policies manageable, enable targeted queries for dashboards, and align with the Participant Timeline UX.  
- Positive: Aqua hashes live alongside the operational rows, so syncing/verifying events does not need extra joins beyond the related row.  
- Negative: multi-table lifecycle requires transactions or compensating logic when issuing approvals plus writing activity logs.  
- Negative: we must keep documentation and runbooks updated so future engineers understand cross-table invariants.  

**Related:**  
- Code: `supabase/migrations/20251112174406_create_ops_hub_schema.sql`, `src/components/TravelApprovalForm.tsx`, `src/components/ParticipantTimeline.tsx`, `src/components/QRScanner.tsx`, `src/components/PayoutConsole.tsx`, `src/components/ActivityFeed.tsx`  
- Threats: `THREAT_MODEL.md` (upcoming entries for attestation spoofing, QR token abuse)  

## ADR-002: Privy Wallet Auth + Service-Role Proxy
**Status:** Accepted  
**Date:** 2025-11-13  

**Context:**  
- Supabase RLS currently permits anon inserts for speed; we must tighten auth while keeping wallet-first UX.  
- The project needs Sign-In with Ethereum (SIWE), magic links, and other non-email flows Privy provides.  
- Ops UI (approvals, payouts) requires authenticated identities while QR scanners/mobile portals should avoid heavy auth but remain trusted.  

**Decision:**  
- Integrate Privy React SDK as the canonical identity layer; every Ops-facing route requires an active Privy session (wallet, email, SMS, etc.).  
- Introduce a serverless proxy (Supabase Edge Function or lightweight server) that runs with Supabase service key, validates Privy access tokens, and performs privileged mutations (travel approvals, payouts, activity log entries).  
- QR scanner flow hits a dedicated proxy endpoint that checks QR tokens + Privy session (or signed scanner credential) before writing `check_ins`.  
- Supabase RLS will be tightened so only the service-role proxy can insert/update sensitive tables; the client uses reads via anon key where safe.  

**Alternatives Considered:**  
- **Use Supabase Auth** — Pros: minimal infra. Cons: no wallet-native auth, duplicates identity flows already planned for hackathon.  
- **Keep anon writes with manual monitoring** — Pros: no new infra. Cons: unacceptable risk for payouts/logistics.  
- **Full custom backend (no Supabase client)** — Pros: total control. Cons: longer build time; duplicates Supabase features currently working.  

**Consequences:**  
- Positive: wallet login + Privy features (embedded wallets, SIWE, passkeys) align with hackathon expectations.  
- Positive: service-role proxy centralizes validation and is future home for Aqua SDK calls.  
- Negative: added operational surface (Privy availability, proxy deployment) and need to manage Privy API keys.  
- Negative: QR scanner must handle Privy session or receive delegated token, increasing mobile complexity.  

- **Related:**  
- Code: `src/main.tsx`, `src/components/AuthGate.tsx`, `supabase/functions/ops-proxy/index.ts`  
- Threats: `THREAT_MODEL.md` entries for Privy dependency, proxy compromise, token replay.  

## ADR-003: Participant Onboarding Portal
**Status:** Accepted  
**Date:** 2025-11-13  

**Context:**  
- Ops needed a way to issue invite tokens and let travelers submit itineraries/stipend requests without granting anon writes.  
- Participants should authenticate with Privy (wallet/email) and reuse the same Supabase backend without introducing a second service.  
- Invite lifecycle must feed the existing `travel_approvals` table so Ops can review pending submissions.  

**Decision:**  
- Store invites in a dedicated `onboarding_invites` table with RLS read-only policies; write access flows through the ops proxy.  
- Ops side uses a Privy-gated modal to create invites via the proxy, which logs the action in `activity_log`.  
- Participants visit `/apply`, authenticate with Privy, load their invite token (read via anon select), and submit the onboarding form; the proxy validates the token, creates/links participants and pending travel approvals, and records the submission event.  
- Aqua attestations are minted for onboarding submissions so the resulting travel approvals share the same trust guarantees.  

**Alternatives Considered:**  
- **Direct Supabase writes from the `/apply` page** — rejected due to tightened RLS and lack of Privy verification.  
- **Separate backend service for onboarding** — more surface area to operate; reusing the ops proxy keeps auth + Aqua integration centralized.  

**Consequences:**  
- Positive: external participants and internal ops share the same Privy login + proxy infrastructure.  
- Positive: invites provide a simple rollback path (status tracking via `onboarding_invites`).  
- Negative: more proxy actions to maintain/test; invite tokens become a sensitive asset (tracked in the threat model).  

**Related:**  
- Code: `supabase/migrations/20251113152000_create_onboarding_invites.sql`, `supabase/functions/ops-proxy/index.ts`, `src/components/InviteManager.tsx`, `src/components/OnboardingPortal.tsx`.  
- Threats: `THREAT_MODEL.md` entries for invite token leakage.  
