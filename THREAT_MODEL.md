# Threat Model

## 1. Assets
- Participant personal data (name, email, role, itinerary).  
- Travel approval records (stipend amounts, QR tokens, Aqua hashes).  
- Check-in / payout events tied to identity and financial flows.  
- Supabase anon key and any future service keys.  
- Aqua attestation links (hashes, verification flags).  

## 2. Assumptions
- Supabase project is hosted by Supabase; we rely on their managed Postgres and auth.  
- Privy React SDK supplies primary identity (wallet SIWE + optional email/SMS); Privy access tokens are short-lived and verifiable server-side.  
- Frontend still uses Supabase anon key for reads, but privileged writes go through a service-role proxy that validates Privy sessions.  
- The ops proxy is deployed as a Supabase Edge Function (`ops-proxy`) using the service-role key; only this function may mutate sensitive tables once UI calls are migrated.  
- QR tokens are UUIDv4 generated client-side via Web Crypto; uniqueness is assumed.  
- Aqua attestation verification is performed off-app for now; hashes stored in DB are truthful if provided.  

## 3. Threats & Mitigations

### T-001: Overly Permissive RLS Policies
**Description:**  
- Current policies (`Anon can manage ...`) allow unauthenticated inserts/updates on critical tables. An attacker could mass-create approvals, check-ins, or payouts.  

**Impact:** High — bogus records pollute ops dashboards, could trigger real payouts if finance relies on UI only.  
**Likelihood:** High until policies tighten or service-role middle tier exists.  

**Mitigation:**  
- Restrict anon role to read-only; require authenticated/service role for inserts/updates.  
- Introduce Supabase Edge Function or backend API to validate QR tokens + signatures before writing. (In progress via `ops-proxy`.)  
- Monitor activity_log for spikes via Supabase alerts.  

**Status:** Mitigated — anon insert/update policies removed; only service-role proxy can mutate tables.  

### T-002: QR Token Leakage & Replay
**Description:**  
- QR tokens live in `travel_approvals.qr_token` as plaintext. If leaked (screenshots, logs), anyone can submit fake check-ins.  

**Impact:** Medium — attendance tracking compromised; could escalate to stipend payouts if workflow trusts check-ins.  
**Likelihood:** Medium — tokens are random but visible to anyone with DB read access or who receives screenshot.  

**Mitigation:**  
- Shorten token lifetime; rotate on scan.  
- Bind QR payloads to participant wallet/signature and require server verification before accepting.  
- Store hashed tokens or encrypt at rest; display QR only through authenticated portal.  

**Status:** Mitigated — ops proxy now delegates attestation minting to a Node service, and activity logs are marked verified when that service returns hashes.  

### T-003: Attestation Spoofing
**Description:**  
- `aqua_attestation_hash` fields accept arbitrary text. Without verification, UI could mark unverified entries as trusted.  

**Impact:** Medium — stakeholders might believe payouts/approvals are Aqua-verified when they are not.  
**Likelihood:** Medium — depends on operator discipline.  

**Mitigation:**  
- Integrate Aqua JS SDK to mint/check attestations server-side; flip `aqua_verified` only after confirmation.  
- Display warning badges when hashes are missing or unverified.  
- Audit attestation creation process (future ADR).  

**Status:** Open.  

### T-004: Privy Outage or Token Theft
**Description:**  
- If Privy API is down, ops cannot authenticate; if tokens leak, attackers could impersonate users to hit the proxy.  

**Impact:** Medium — blocks ops workflows or enables unauthorized state changes.  
**Likelihood:** Medium — third-party SaaS downtime and phishing exist.  

**Mitigation:**  
- Cache minimal read-only data client-side so ops can view historical info during outages (no writes).  
- Require short-lived Privy tokens + nonce validation in proxy; revoke sessions via Privy dashboard when compromise suspected.  
- Document manual override (e.g., temporarily enable service admin key) in RUNBOOK with approval process.  

**Status:** Open.  

### T-005: Service-Role Proxy Compromise
**Description:**  
- The proxy holding Supabase service key or Aqua credentials could be hijacked, granting full DB write access.  

**Impact:** High — attacker can mint fake approvals/payouts, exfiltrate PII.  
**Likelihood:** Medium — depends on hosting posture (Edge Function vs. server).  

**Mitigation:**  
- Restrict proxy deployment secrets to CI/CD vault; rotate service key regularly.  
- Implement input validation + rate limiting; log every proxy action to `activity_log` and external observability.  
- Least-privilege: split endpoints (approvals vs. payouts) with separate keys/scopes if possible.  

**Status:** Open.  

### T-006: Invite Token Leakage
**Description:**  
- Onboarding tokens grant access to personal submission forms; leaking them lets an attacker impersonate a participant during submission.  

**Impact:** Medium — bogus submissions could block legitimate travel approvals or leak PII.  
**Likelihood:** Medium — tokens may be shared over email/DM and can be copied in the ops UI.  

**Mitigation:**  
- Treat tokens as secrets: display them only once after creation, encourage ops to rotate if shared in insecure channels.  
- Optionally expire tokens after first submission or after a time window.  
- Monitor invite status changes and log unexpected submissions in `activity_log`.  

**Status:** Open.  

### T-007: Attestation Service Compromise
**Description:**  
- The external Node attestation service holds the service-role key and `AQUA_SERVICE_TOKEN`. If compromised, an attacker could forge attestation hashes or tamper with Supabase data.  

**Impact:** High — bogus attestations undermine trust across approvals/check-ins/payouts.  
**Likelihood:** Medium — depends on hosting posture (e.g., Vercel/Render) and secret hygiene.  

**Mitigation:**  
- Restrict network access (allow only proxy IPs) and require a strong shared token or mutual TLS.  
- Log every attestation request and verify hashes server-side; add alarms when the service returns errors.  
- Rotate `AQUA_SERVICE_TOKEN` regularly and store it in a secrets manager (Vault, AWS Secrets Manager).  

**Status:** Open.  

## 4. Known Limitations
- No dedicated auth tier; everything flows through the anon key which can be leaked.  
- No rate limiting or anomaly detection around QR scans or payouts.  
- Aqua attestations are not programmatically validated yet; integrity rests on manual processes.  
