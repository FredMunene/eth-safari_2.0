# Debug Log

## [2025-11-13] Issue-ID: schema-inventory-m1
**Context:**  
- Kicked off Milestone M1 by reviewing Supabase migration (`20251112174406_create_ops_hub_schema.sql`) plus client usage (`src/lib/supabase.ts`, TravelApprovalForm, ParticipantTimeline).  

**Error / Symptom:**  
- No runtime error, but discovered RLS policies currently allow `anon` to manage critical tables, and Aqua hashes are write-only without verification.  

**Root Cause:**  
- Prototype defaults favored speed over access control; no middleware or service role enforces auth.  

**Fix / Change:**  
- Documented lifecycle decision in `ADR.md`, added deployment/runbook guidance, opened threats (RLS, QR tokens, attestation spoofing) in `THREAT_MODEL.md`.  

**Notes / Lessons Learned:**  
- Need dedicated ADR for tightening RLS once auth model is finalized.  
- Aqua integration should drive `aqua_verified` flips, otherwise UI must show warnings.  
- Keep recording discoveries even when no code errors occur to preserve institutional knowledge.  

## [2025-11-13] Issue-ID: privy-sdk-install
**Context:**  
- Adding Privy React SDK + AuthGate to enforce wallet-first login per ADR-002. Ran `npm install` after updating dependencies.  

**Error / Symptom:**  
- `npm install` failed with `EAI_AGAIN getaddrinfo registry.npmjs.org` (network DNS issue) on first attempt; second attempt timed out at 100s.  

**Root Cause:**  
- Restricted network sandbox blocked outbound requests until elevated permissions + longer timeout were used.  

**Fix / Change:**  
- Re-ran `npm install` with escalated permissions and increased timeout (200s). Install succeeded; build verified via `npm run build`.  

**Notes / Lessons Learned:**  
- Always note when sandbox/network limits impact dependency work.  
- Large packages such as `@privy-io/react-auth` may require longer install windows; plan for this when scripting CI.  

## [2025-11-13] Issue-ID: ops-proxy-supabase-function
**Context:**  
- Implemented the first cut of the service-role proxy as a Supabase Edge Function (`supabase/functions/ops-proxy`) using Privy token verification.  

**Error / Symptom:**  
- None; main challenge was wiring Privy verification inside Deno.  

**Root Cause:**  
- Edge Functions require remote ESM imports; had to use `https://esm.sh/@privy-io/server-auth` because node_modules aren’t bundled in Supabase Functions.  

**Fix / Change:**  
- Added the function with CORS handling, Privy auth check, participant upsert logic, and travel approval issuance.  
- Updated Deployment + Runbook docs for new secrets, health checks, and redeploy steps; threat model now notes mitigation progress.  

**Notes / Lessons Learned:**  
- Privy server SDK works via esm.sh when targeting Deno.  
- Keep approval inserts free of Supabase auth foreign keys (`approved_by`) until we map Privy IDs to Supabase auth UUIDs.  

## [2025-11-13] Issue-ID: approval-form-proxy-integration
**Context:**  
- Travel approval modal still wrote directly to Supabase from the browser; switched it to use the Privy-authenticated ops proxy.  

**Error / Symptom:**  
- None, but missing access token handling would have caused silent failures once RLS tightens.  

**Root Cause:**  
- Client-side code never fetched Privy access tokens or targeted the Edge Function endpoint.  

**Fix / Change:**  
- Added `src/lib/opsProxy.ts` helper, new `VITE_SUPABASE_FUNCTIONS_URL` env, and updated `TravelApprovalForm` to request an access token via `usePrivy`, call the proxy, and surface meaningful errors.  
- Documented the env var + system overview change in `DEPLOYMENT.md` and `RUNBOOK.md`.  

**Notes / Lessons Learned:**  
- Provide a derivation fallback for the functions URL so local dev works even if the env var is missing (with a console warning).  
- After proxy migration, remaining write paths (QR scanner, payouts) should follow the same pattern before we flip RLS.  

## [2025-11-13] Issue-ID: qr-scanner-proxy-integration
**Context:**  
- Migrated the QR scanner to use the Privy-authenticated ops proxy instead of direct Supabase inserts.  

**Error / Symptom:**  
- None in production, but camera scans would have continued inserting via anon role, blocking the RLS tightening plan.  

**Root Cause:**  
- QR scanner never fetched Privy access tokens or delegated write access to the service-role function.  

**Fix / Change:**  
- Added `record_check_in` action inside `supabase/functions/ops-proxy`, plus a `recordCheckInRequest` helper in `src/lib/opsProxy.ts`.  
- Updated `QRScanner` to request a Privy access token, call the proxy, and display the returned participant metadata / error messages.  

**Notes / Lessons Learned:**  
- Manual QR entry can reuse the same proxy path; no extra Supabase reads are needed in the browser.  
- Once payouts shift to the proxy we can confidently lock RLS to service-role only.  
