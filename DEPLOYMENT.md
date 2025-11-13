# Deployment Guide

## 1. Prerequisites
- Node.js 20.x (matches Vite 7 + React 19 toolchain) and npm 10+.  
- Supabase project (hosted) or Supabase CLI `>=1.187` for local development.  
- Access to the Aqua Protocol test credentials if you intend to mint attestations (not yet wired, but hashes are stored per row).  
- Git, pnpm/nvm optional but ensure `npm install` is available.  

## 2. Environment Variables
Create `.env` (or configure your host) with the following vars:  

- `VITE_SUPABASE_URL` — Supabase project REST endpoint. Example: `https://<project-id>.supabase.co`.  
- `VITE_SUPABASE_SUPABASE_ANON_KEY` — anon service key copied from Supabase dashboard → Project Settings → API. (The double `SUPABASE` prefix is intentional to match existing imports in `src/lib/supabase.ts`.)  
- `VITE_PRIVY_APP_ID` — Privy application ID for the React SDK.  
- `VITE_SUPABASE_FUNCTIONS_URL` — Base URL for Supabase Edge Functions (e.g., `https://<project>.functions.supabase.co`).  
- `PRIVY_APP_SECRET` — used by the ops proxy to validate Privy access tokens.  
- `SUPABASE_SERVICE_ROLE_KEY` (proxy only) — grants the proxy insert/update access when running via Supabase Edge Functions.  

Restart the dev server whenever these values change; Vite only injects `import.meta.env` at build/start.  

## 3. Smart Contracts
Not applicable yet. Aqua attestations are handled off-chain through the JS SDK; contract deployments will be documented once on-chain components exist.  

## 4. Backend / Frontend
1. Install dependencies:  
   ```bash
   npm install
   ```  
2. Start local dev server with hot reload:  
   ```bash
   npm run dev
   ```  
3. Build production assets (outputs to `dist/`):  
   ```bash
   npm run build
   ```  
4. Preview a production build locally:  
   ```bash
   npm run preview
   ```  
5. Deploy the `dist/` folder to your static host (Vercel, Netlify, Cloudflare Pages, etc.) and supply the two env vars above.  
6. Deploy the service-role proxy / Supabase Edge Function with `SUPABASE_SERVICE_ROLE_KEY`, `PRIVY_APP_SECRET`, and any Aqua credentials; ensure its endpoint is reachable from the frontend.  

## 7. Ops Proxy (Supabase Edge Function)
- Deploy from the repo root once Supabase CLI is linked:  
  ```bash
  supabase functions deploy ops-proxy --project-ref <ref> --no-verify-jwt
  ```  
- Provide the secrets required by the function (Supabase URL, service role key, Privy credentials):  
  ```bash
  supabase secrets set \
    SUPABASE_URL=<https://project.supabase.co> \
    SUPABASE_SERVICE_ROLE_KEY=<service-role> \
    PRIVY_APP_ID=<app-id> \
    PRIVY_APP_SECRET=<app-secret> \
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

## 6. Common Deployment Pitfalls
- **Missing env vars:** The app throws `Missing Supabase environment variables` during start/build if either `VITE_SUPABASE_URL` or `VITE_SUPABASE_SUPABASE_ANON_KEY` is absent. Double-check host-level config.  
- **Anon policies:** Current RLS policies allow `anon` to insert/update critical tables for rapid prototyping. When deploying publicly, tighten these policies and document the change in `ADR.md` + `RUNBOOK.md`.  
- **QR token collisions:** Tokens default to UUIDs generated client-side. If you disable the Web Crypto API in a given environment, fall back to Node polyfills or server-generated tokens to avoid rejected inserts.  
