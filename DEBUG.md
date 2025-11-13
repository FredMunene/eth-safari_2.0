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
