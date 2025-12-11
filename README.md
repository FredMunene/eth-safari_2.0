# ETH Safari 2025 Ops Hub


## Demo

[![Watch the demo](https://img.youtube.com/vi/ExB94irX7-o/hqdefault.jpg)](https://youtu.be/ExB94irX7-o)


Web-based operations hub for the ETH Safari hackathon. It lets organizers issue travel approvals, scan on-site check-ins, track stipend payouts, and give participants a self-serve onboarding portal. Every critical action can be anchored to Aqua Protocol attestations for verifiable audit trails.

## What It Does
- Travel approvals with stipend metadata, QR tokens, and Aqua hashes.
- QR scanner + manual entry to record arrivals tied to approvals.
- Finance console to mark payouts with proofs (receipt/tx hash/bank transfer).
- Participant timeline and activity feed stitching approvals, check-ins, and payouts.
- Invite-driven onboarding portal (`/apply`) so travelers submit itineraries via Privy auth.
- Service-role Supabase Edge Function proxy; browser only reads via anon key.

## Architecture at a Glance
- `web/`: Vite + React + Tailwind SPA with Privy auth, Supabase client, and ops UI components.
  - `src/lib/opsProxy.ts`: calls the Supabase Edge Function (`ops-proxy`) with Privy access tokens.
  - `supabase/functions/ops-proxy`: service-role proxy that validates Privy JWTs, writes to tables, and delegates Aqua attestation minting.
  - `supabase/migrations`: schema for participants, travel approvals, check-ins, payouts, activity log, and onboarding invites; RLS hardening.
  - Docs: `README.md`, `DEPLOYMENT.md`, `RUNBOOK.md`, `THREAT_MODEL.md`, `ADR.md`, `docs/` (roadmap, milestones).
- `aqua-server/`: Node/Express microservice that runs `aqua-js-sdk` and (optionally) writes hashes back to Supabase via a shared secret (`AQUA_SERVICE_TOKEN`).

## Prerequisites
- Node.js 20+ and npm 10+.
- Supabase project (for Postgres + Edge Functions).
- Privy app (React SDK + server token verification).
- Aqua test credentials (mnemonic/seed) if you want server-side attestation minting.

## Setup
1. Install dependencies:
   ```bash
   cd web && npm install
   cd ../aqua-server && npm install
   cd ..
   ```
2. Create `web/.env`:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_SUPABASE_ANON_KEY=<anon-key>
   VITE_PRIVY_APP_ID=<privy-app-id>
   VITE_SUPABASE_FUNCTIONS_URL=https://<project>.functions.supabase.co
   ```
3. Create `aqua-server/.env`:
   ```
   PORT=8787
   AQUA_SERVICE_TOKEN=<strong-shared-secret>
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   AQUA_MNEMONIC="<seed words for aqua-js-sdk>"
   ```
4. Provision database:
   ```bash
   # requires Supabase CLI linked to your project
   supabase db push   # applies migrations in web/supabase/migrations
   ```
5. Set Supabase Edge Function secrets (proxy + Aqua service):
   ```bash
   supabase secrets set \
     PROJECT_URL=https://<project>.supabase.co \
     SERVICE_ROLE_KEY=<service-role-key> \
     PRIVY_APP_ID=<privy-app-id> \
     PRIVY_APP_SECRET=<privy-app-secret> \
     AQUA_SERVICE_URL=https://<aqua-server-domain>/attest \
     AQUA_SERVICE_TOKEN=<same-shared-secret>
   ```

## Running Locally
- Frontend: `cd web && npm run dev` (http://localhost:5173).
- Aqua attestation service: `cd aqua-server && npm run dev` (http://localhost:8787).
- Supabase Edge Function (proxy): `cd web && supabase functions serve ops-proxy --env-file .env` (or deploy to Supabase and point `VITE_SUPABASE_FUNCTIONS_URL` at it).

## Data Model (Supabase)
- `participants`: immutable profile rows referenced by approvals.
- `travel_approvals`: status, stipend amount, sponsor notes, QR token, Aqua hash.
- `check_ins`: QR scans with location/timestamp and optional Aqua hash.
- `payouts`: pending/processing/completed/failed with proof type/data and Aqua hash.
- `activity_log`: append-only feed with `aqua_verified` flags for UI badges.
- `onboarding_invites`: invite tokens used by the `/apply` portal; links submissions to approvals.
- RLS: anon reads only; mutations go through the service-role proxy after applying `20251113140000_tighten_rls.sql`.

## Trust & Security Notes
- Privy React SDK gates all ops and portal routes; clients fetch a Privy access token and send it to `ops-proxy`.
- `ops-proxy` validates Privy JWTs, performs Supabase mutations with the service-role key, and logs activity.
- Aqua integration: browser can mint lightweight proofs via `src/lib/attestations.ts`; production flow proxies attestation payloads to `aqua-server` for reliable hashing.
- See `THREAT_MODEL.md` for known risks (QR token replay, proxy compromise, attestation spoofing) and mitigations.

## Useful Docs
- Ops hub details: `web/README.md`
- Deployment steps: `web/DEPLOYMENT.md`
- Operations runbook: `web/RUNBOOK.md`
- Architecture decisions: `web/ADR.md`
- Roadmap/milestones: `web/docs/roadmap.md`, `web/docs/milestones.md`
- Debug history: `web/DEBUG.md`

## Submission Context
Built for the ETH-Safari Hackathon 2025 as a logistics + trust layer for approvals, check-ins, and payouts anchored by Aqua Protocol proofs.
