# Deployment Guide

## 1. Prerequisites
- Node.js 20.x (matches Vite 7 + React 19 toolchain) and npm 10+.  
- Supabase project (hosted) or Supabase CLI `>=1.187` for local development.  
- Access to the Aqua Protocol test credentials if you intend to mint attestations (not yet wired, but hashes are stored per row).  
- Git, pnpm/nvm optional but ensure `npm install` is available.  

## 2. Environment Variables
There are now three env scopes to configure:  

1. **`web/.env` (Vite frontend)**  
   - `VITE_SUPABASE_URL` — Supabase project REST endpoint. Example: `https://<project-id>.supabase.co`.  
   - `VITE_SUPABASE_SUPABASE_ANON_KEY` — anon service key copied from Supabase dashboard → Project Settings → API. (The double `SUPABASE` prefix is intentional to match existing imports in `src/lib/supabase.ts`.)  
   - `VITE_PRIVY_APP_ID` — Privy application ID for the React SDK.  
   - `VITE_SUPABASE_FUNCTIONS_URL` — Base URL for Supabase Edge Functions (e.g., `https://<project>.functions.supabase.co`).  

2. **Supabase function secrets (`supabase secrets set …`)**  
   - `PROJECT_URL`/`SERVICE_ROLE_KEY` (aliases for `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).  
   - `PRIVY_APP_ID`, `PRIVY_APP_SECRET`.  
   - `AQUA_SERVICE_URL` — URL of the Node-based attestation microservice (`https://<attest-domain>/api/attest`).  
   - `AQUA_SERVICE_TOKEN` — shared secret header the Node service expects from the proxy.  
   - `AQUA_ENABLED` — optional flag to toggle the local SDK fallback.  

3. **`aqua-server/.env` (Node attestation service)**  
   - `PORT` — local listening port (defaults to 8787).  
   - `AQUA_SERVICE_TOKEN` — must match the shared secret above.  
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — required if the service writes hashes back to Supabase on its own.  
   - `AQUA_MNEMONIC` / `AQUA_SEED` — credentials consumed by `aqua-js-sdk` (see [Aqua docs](https://deepwiki.com/inblockio/aqua-js-sdk)).  

Restart the dev servers whenever these values change; Vite only injects `import.meta.env` at build/start.  

> Supabase CLI forbids secrets that begin with `SUPABASE_`. When setting secrets via `supabase secrets set`, use aliases such as `PROJECT_URL` and `SERVICE_ROLE_KEY`; the ops proxy automatically falls back to those names. Example:  
> ```bash
> supabase secrets set \
>   PROJECT_URL=https://<project>.supabase.co \
>   SERVICE_ROLE_KEY=<service-role-key> \
>   PRIVY_APP_ID=<id> \
>   PRIVY_APP_SECRET=<secret> \
>   AQUA_ENABLED=true
> ```  

## 3. Smart Contracts
Not applicable yet. Aqua attestations are handled off-chain through the JS SDK; contract deployments will be documented once on-chain components exist.  

## 4. Backend / Frontend
1. Install dependencies (frontend + attestor):  
   ```bash
   cd web && npm install
   cd ../aqua-server && npm install
   cd ..
   ```  
2. Start local dev server with hot reload:  
   ```bash
   cd web
   npm run dev
   ```  
3. Build production assets (outputs to `dist/`):  
   ```bash
   cd web
   npm run build
   ```  
4. Preview a production build locally:  
   ```bash
   cd web
   npm run preview
   ```  
5. In parallel, run the Aqua Node service locally for end-to-end tests:  
   ```bash
   cd aqua-server
   npm run dev   # or node index.js / tsx src/index.ts
   ```  
6. Deploy the `web/dist/` folder to your static host (Vercel, Netlify, Cloudflare Pages, etc.) and supply the env vars above.  
7. Deploy the service-role proxy / Supabase Edge Function with `SUPABASE_SERVICE_ROLE_KEY`, `PRIVY_APP_SECRET`, and Aqua service details; ensure its endpoint is reachable from the frontend.  
8. Deploy the **Aqua Node attestation service** inside `aqua-server/` (Next.js API route, Express app, etc.). It should accept attestation payloads from the proxy, call `aqua-js-sdk`, and update Supabase (or return the hash). Provide it with the service role key and shared `AQUA_SERVICE_TOKEN`.  
9. Configure your static host to serve the SPA fallback so `/apply` routes to `index.html`; the participant portal shares the same bundle.  

## 7. Ops Proxy (Supabase Edge Function)
- Deploy from the repo root once Supabase CLI is linked:  
  ```bash
  supabase functions deploy ops-proxy --project-ref <ref> --no-verify-jwt
  ```  
- Provide the secrets required by the function (Supabase URL, service role key, Privy credentials, attestation service details):  
  ```bash
  supabase secrets set \
    SUPABASE_URL=<https://project.supabase.co> \
    SUPABASE_SERVICE_ROLE_KEY=<service-role> \
    PRIVY_APP_ID=<app-id> \
    PRIVY_APP_SECRET=<app-secret> \
    AQUA_SERVICE_URL=<https://attest.yourdomain.com/api/attest> \
    AQUA_SERVICE_TOKEN=<shared-secret> \
    --project-ref <ref>
  ```  
- Test locally with `supabase functions serve ops-proxy --env-file .env.proxy` so you can hit `http://localhost:54321/functions/v1/ops-proxy`.  
- Frontend clients should send a Privy access token (`Authorization: Bearer <token>`) when calling this endpoint; the proxy verifies it before mutating `participants`, `travel_approvals`, or logging activity.  

## 5. Migrations / Seed Data
- Ensure Supabase CLI is authenticated (`supabase login`) and project is linked (`supabase link --project-ref <ref>`).  
- Apply schema from `supabase/migrations/20251112174406_create_ops_hub_schema.sql`:  
  ```bash
  supabase db push
  ```  
- (Optional) Seed participants manually via Supabase dashboard or by inserting rows through the Travel Approval form once the UI is running.  
- Apply the latest RLS hardening migration (`20251113140000_tighten_rls.sql`) so anon clients remain read-only while the service-role proxy handles mutations.  
- Apply the onboarding invite schema (`20251113152000_create_onboarding_invites.sql`) to enable the `/apply` participant portal.  

## 6. Common Deployment Pitfalls
- **Missing env vars:** The app throws `Missing Supabase environment variables` during start/build if either `VITE_SUPABASE_URL` or `VITE_SUPABASE_SUPABASE_ANON_KEY` is absent. Double-check host-level config.  
- **Anon policies:** Current RLS policies allow `anon` to insert/update critical tables for rapid prototyping. When deploying publicly, tighten these policies and document the change in `ADR.md` + `RUNBOOK.md`.  
- **QR token collisions:** Tokens default to UUIDs generated client-side. If you disable the Web Crypto API in a given environment, fall back to Node polyfills or server-generated tokens to avoid rejected inserts.  
