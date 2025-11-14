# Runbook

## 1. System Overview
- **Ops Hub Web App (Vite + React):** Provides Ops Lead panel, participant portal, QR scanner, payout console. Reads directly via anon key but routes privileged mutations through the `ops-proxy` Supabase Edge Function using Privy access tokens.  
- **Supabase Postgres:** Hosts tables defined in `supabase/migrations/20251112174406_create_ops_hub_schema.sql` plus RLS policies for participants, travel approvals, check-ins, payouts, and activity log.  
- **Aqua Attestation Hooks:** Ops proxy delegates attestation payloads to a Node-based service (`AQUA_SERVICE_URL`) that runs `aqua-js-sdk` and writes hashes back to Supabase.  
- **Participant Onboarding Portal:** `/apply` route where invitees authenticate with Privy, fetch their `onboarding_invites` row, and submit travel/stipend details that create pending `travel_approvals`.  

## 2. Routine Procedures

### 2.1 Restarting Services
1. **Frontend:**  
   - Local/dev: stop the Vite server (Ctrl+C) and rerun `npm run dev`.  
   - Production (static host): redeploy the latest `dist/` bundle (Vercel/Netlify redeploy button).  
   - Verify by loading `/` and confirming the Ops Lead metrics render without network errors in DevTools.  
2. **Supabase Edge Functions / DB:**  
   - Not in use yet. Monitor Supabase dashboard → Database → Status for incidents.  

### 2.2 Rotating Keys / Secrets
1. Generate a new Supabase anon key from Project Settings → API.  
2. Update `VITE_SUPABASE_SUPABASE_ANON_KEY` wherever the frontend is deployed.  
3. Restart/redeploy the frontend so `import.meta.env` is rebuilt.  
4. Smoke test: issue a travel approval in the UI; check browser console for 403/401 errors.  

### 2.3 Running Database Migrations
1. Install/upgrade Supabase CLI (`brew upgrade supabase/tap/supabase`).  
2. Link the project: `supabase link --project-ref <ref>`.  
3. Apply migrations: `supabase db push`.  
4. Confirm the new tables/indexes exist via Supabase dashboard or `supabase db remote commit`.  

### 2.4 Rotating Privy Keys / Handling Outages
1. Visit Privy dashboard → Settings → API Keys; create a new **Client ID** / secret pair.  
2. Update frontend env vars (`VITE_PRIVY_APP_ID`, etc.) and redeploy.  
3. Update service-role proxy secrets so it can verify Privy tokens (usually `PRIVY_APP_SECRET`).  
4. Revoke the old key in Privy dashboard once deployments confirm healthy sign-in.  
5. During Privy outages, switch Ops UI into read-only mode (feature flag) and log the incident in `DEBUG.md`; notify team via status channel.  

### 2.5 Deploying / Rolling Back the Ops Proxy
1. Ensure Supabase CLI is linked to the project (`supabase link --project-ref <ref>`).  
2. Deploy the Edge Function: `supabase functions deploy ops-proxy --project-ref <ref> --no-verify-jwt`.  
3. Update function secrets when credentials rotate:  
   ```bash
   supabase secrets set SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<service-role> PRIVY_APP_ID=<id> PRIVY_APP_SECRET=<secret>
   ```  
4. Verify health by calling `GET https://<project>.functions.supabase.co/ops-proxy` (should return `{status:"ok"}`).  
5. Roll back by redeploying the previous commit or using `supabase functions deploy ops-proxy --import-map <old>` if needed.  

### 2.6 Managing Onboarding Invites
1. Ops app → `Invites` button opens the modal backed by Supabase reads.  
2. Create invite via proxy (`create_onboarding_invite` action). Copy the generated token and share it with the participant.  
3. Participants visit `/apply?token=<token>`, sign in with Privy, and submit their form (proxy action `submit_onboarding`).  
4. Review submissions as pending travel approvals inside the main dashboard.  

### 2.7 Monitoring the Attestation Service
1. Configure your Node hosting provider (Vercel/Render/EC2) to expose health metrics for the Aqua attestation service.  
2. Rotate `AQUA_SERVICE_TOKEN` on both the proxy and Node service if compromise is suspected.  
3. When the service is down, set `AQUA_ENABLED=false` in the proxy secrets and queue pending attestations so you can replay them later.  

## 3. Incident Playbooks

### 3.1 “Timeline Shows No Events”
**Symptoms:**  
- Participant Timeline modal renders “No events found” even though approvals/check-ins/payouts exist.  

**Quick Checks:**  
- Open browser DevTools → Network; verify `travel_approvals`, `check_ins`, `payouts` requests succeed (200s).  
- Inspect Supabase table counts from dashboard; ensure participant IDs match inserted approval records.  
- Confirm RLS policies still allow `authenticated`/`anon` reads.  

**Mitigation:**  
- If requests fail with 401, rotate anon key and redeploy (see §2.2).  
- If approvals reference missing participants, backfill `participant_id` via SQL or reissue approvals through the form.  
- If Supabase outage, queue manual updates in `DEBUG.md` and re-run `loadTimeline` after service recovery.  

**Follow-Up:**  
- Record the outage/bug in `DEBUG.md`.  
- Evaluate whether an ADR is needed for caching or API layer changes.  

### 3.2 “QR Scanner Cannot Save Check-Ins”
**Symptoms:**  
- QR scanner view confirms scan but Supabase insert fails; attendees stay in “Never checked in”.  

**Quick Checks:**  
- Look at console errors for `check_ins` insert failure codes (e.g., 42501 not authorized, 23505 duplicate).  
- Validate that `travel_approval_id` encoded in the QR token matches an existing approval row.  
- Ensure device/browser allows camera usage (permissions prompt).  
- Confirm the ops proxy is reachable (`GET /ops-proxy`) and the client is sending a Privy access token (Network tab should show `Authorization: Bearer …`).  

**Mitigation:**  
- Duplicate token: generate a fresh approval (issue new QR) or manually delete the stuck `check_ins` row.  
- RLS denies anon insert: temporarily grant `authenticated` role to scanner app or create a service role function; document in ADR before production change.  
- Camera permission issues: provide manual code entry fallback; instructions already in UI but confirm by testing on a second device.  

**Follow-Up:**  
- Note remediation steps in `DEBUG.md`.  
- If security posture changed (e.g., enabling anon inserts), update `THREAT_MODEL.md` and `ADR.md` accordingly.  

### 3.3 “Privy Login Failures”
**Symptoms:**  
- Users can’t authenticate (stuck on Privy modal, SIWE signature rejected, 5xx from Privy endpoints).  

**Quick Checks:**  
- Check https://status.privy.io and Privy dashboard alerts.  
- Inspect browser console for Privy SDK errors (expired app ID, missing domain).  
- Confirm environment variables (`VITE_PRIVY_APP_ID`, `PRIVY_APP_SECRET`) match the dashboard.  

**Mitigation:**  
- If outage: toggle Ops UI into read-only mode and queue manual approvals; document impacted users.  
- If credentials invalid: rotate app keys (see §2.4) and redeploy frontend + proxy.  
- If SIWE signature fails, ensure connected wallet has correct chain (Ethereum mainnet by default) or update Privy config to allow testnets.  

**Follow-Up:**  
- Record in `DEBUG.md` including root cause and mitigation.  
- Consider adding monitoring/alerting on Privy login failure rate.  

### 3.4 “Ops Proxy Returns 401/500”
**Symptoms:**  
- Frontend calls to `/functions/v1/ops-proxy` fail with 401 (unauthorized) or 500 (internal error); travel approvals stop saving.  

**Quick Checks:**  
- Confirm client is passing `Authorization: Bearer <Privy access token>` (inspect browser network tab).  
- Hit the proxy health endpoint (`GET /ops-proxy`) to verify deployment is alive and secrets are loaded.  
- Run `supabase functions logs ops-proxy --project-ref <ref>` to inspect recent stack traces.  

**Mitigation:**  
- 401s: ensure operators obtain fresh Privy access tokens (`usePrivy().getAccessToken()`), and confirm `PRIVY_APP_SECRET` matches the app in Privy dashboard.  
- 500s: tail logs, fix validation errors (e.g., missing participant fields), and redeploy the function if code regressions are suspected.  
- If secrets rotated, rerun `supabase secrets set ...` and redeploy.  

**Follow-Up:**  
- Document the incident in `DEBUG.md` including root cause.  
- If the proxy logic needs schema or threat-model updates, capture them in `ADR.md` / `THREAT_MODEL.md`.  

### 3.5 “Payout Console Cannot Mark Payouts Completed”
**Symptoms:**  
- Finance console shows “Failed to process payout” toast; status stays `pending`.  

**Quick Checks:**  
- Inspect browser network panel for the `/ops-proxy` request; confirm `Authorization` header is present and the response body contains details.  
- Call the health endpoint (`GET /ops-proxy`) to ensure the Edge Function is live.  
- Verify the payout row exists in Supabase (`payouts` table) and hasn’t already been marked `completed`.  

**Mitigation:**  
- If the proxy returns `Payout not found`, refresh the table (stale UI) or recreate the payout record.  
- For validation errors (missing proof), re-open the modal and ensure proof type/data fields are filled.  
- If the proxy throws 401, re-authenticate via Privy to mint a fresh access token.  

**Follow-Up:**  
- Add a `DEBUG.md` entry describing the failure.  
- If root cause was a schema or ops change, update `ADR.md` / `THREAT_MODEL.md` accordingly.  

### 3.6 “Participant Portal Invite Issues”
**Symptoms:**  
- Participant can’t load their token on `/apply`, sees “Invite not found” or submission fails.  

**Quick Checks:**  
- Confirm the token exists in `onboarding_invites` and status is `pending`.  
- Verify the participant is authenticated via Privy (look for `/ops-proxy` 401/403).  
- Review proxy logs for `submit_onboarding` errors (missing itinerary, stipend parse, etc.).  

**Mitigation:**  
- Re-issue a fresh invite via the ops modal and share the new token.  
- If the invite was accidentally marked `submitted`, set status back to `pending` via SQL and clear `travel_approval_id`.  
- Coach the participant to refresh and resubmit once Privy session is active.  

**Follow-Up:**  
- Document root cause in `DEBUG.md`.  
- Add tests or validation if specific fields (itinerary, stipend) were causing proxy errors.  
### 3.7 “Attestation Service Failures”
**Symptoms:**  
- Ops proxy responses contain `Failed to call Aqua service` and `aqua_verified` remains false.  

**Quick Checks:**  
- Check the Node service logs/health endpoint.  
- Confirm `AQUA_SERVICE_URL` and `AQUA_SERVICE_TOKEN` match between proxy secrets and the Node service config.  
- Re-run the POST request manually with `curl` to retrieve the precise error.  

**Mitigation:**  
- Redeploy/restart the Node service.  
- Temporarily disable attestation in the proxy (`AQUA_ENABLED=false`) and backfill hashes later.  
- If hash writes partially succeeded, rerun the attestation for affected records via a script or queue.  

**Follow-Up:**  
- Document the outage in `DEBUG.md`.  
- Update `THREAT_MODEL.md` if new risks were discovered (e.g., replay attacks on the attestation API).  
