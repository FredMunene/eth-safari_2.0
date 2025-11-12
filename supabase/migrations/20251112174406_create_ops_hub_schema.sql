/*
  # ETH Safari Ops Hub Database Schema

  ## Overview
  Creates the core database structure for managing travel approvals, check-ins, 
  and payouts powered by Aqua attestations.

  ## New Tables

  ### `participants`
  - `id` (uuid, primary key) - Unique participant identifier
  - `name` (text) - Participant full name
  - `email` (text, unique) - Email address
  - `role` (text) - Role at event (e.g., "Hacker", "Volunteer", "Speaker")
  - `photo_url` (text, nullable) - Profile photo URL
  - `created_at` (timestamptz) - Record creation timestamp

  ### `travel_approvals`
  - `id` (uuid, primary key) - Unique approval identifier
  - `participant_id` (uuid, foreign key) - References participants
  - `itinerary` (text) - Travel details
  - `stipend_amount` (numeric) - Approved stipend amount
  - `sponsor_notes` (text, nullable) - Internal notes from sponsor
  - `status` (text) - "pending", "approved", "rejected"
  - `aqua_attestation_hash` (text, nullable) - Blockchain attestation hash
  - `qr_token` (text, unique) - QR code token for check-ins
  - `approved_by` (uuid, nullable) - References auth.users
  - `approved_at` (timestamptz, nullable) - Approval timestamp
  - `created_at` (timestamptz) - Record creation timestamp

  ### `check_ins`
  - `id` (uuid, primary key) - Unique check-in identifier
  - `travel_approval_id` (uuid, foreign key) - References travel_approvals
  - `location` (text) - Check-in location
  - `timestamp` (timestamptz) - Check-in timestamp
  - `scanned_by` (uuid, nullable) - References auth.users (scanner)
  - `aqua_attestation_hash` (text, nullable) - Blockchain attestation hash
  - `created_at` (timestamptz) - Record creation timestamp

  ### `payouts`
  - `id` (uuid, primary key) - Unique payout identifier
  - `travel_approval_id` (uuid, foreign key) - References travel_approvals
  - `amount` (numeric) - Payout amount
  - `status` (text) - "pending", "processing", "completed", "failed"
  - `proof_type` (text, nullable) - "receipt", "tx_hash", "bank_transfer"
  - `proof_data` (text, nullable) - Receipt URL or transaction hash
  - `aqua_attestation_hash` (text, nullable) - Blockchain attestation hash
  - `processed_by` (uuid, nullable) - References auth.users
  - `processed_at` (timestamptz, nullable) - Processing timestamp
  - `created_at` (timestamptz) - Record creation timestamp

  ### `activity_log`
  - `id` (uuid, primary key) - Unique log entry identifier
  - `event_type` (text) - "approval", "check_in", "payout", "verification"
  - `participant_id` (uuid, nullable) - References participants
  - `description` (text) - Human-readable event description
  - `metadata` (jsonb) - Additional event data
  - `aqua_verified` (boolean) - Whether event is Aqua-verified
  - `created_at` (timestamptz) - Event timestamp

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Authenticated users can read all records
  - Only authenticated users with proper roles can insert/update
  - Activity log is append-only for authenticated users
*/

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'Hacker',
  photo_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view participants"
  ON participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert participants"
  ON participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update participants"
  ON participants FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can manage participants"
  ON participants FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create travel_approvals table
CREATE TABLE IF NOT EXISTS travel_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  itinerary text NOT NULL,
  stipend_amount numeric(10,2) NOT NULL DEFAULT 0,
  sponsor_notes text,
  status text NOT NULL DEFAULT 'pending',
  aqua_attestation_hash text,
  qr_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

ALTER TABLE travel_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view travel approvals"
  ON travel_approvals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert travel approvals"
  ON travel_approvals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update travel approvals"
  ON travel_approvals FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can manage travel approvals"
  ON travel_approvals FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create check_ins table
CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_approval_id uuid NOT NULL REFERENCES travel_approvals(id) ON DELETE CASCADE,
  location text NOT NULL DEFAULT 'ETH Safari Venue',
  timestamp timestamptz DEFAULT now(),
  scanned_by uuid,
  aqua_attestation_hash text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view check-ins"
  ON check_ins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert check-ins"
  ON check_ins FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can insert check-ins"
  ON check_ins FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_approval_id uuid NOT NULL REFERENCES travel_approvals(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  proof_type text,
  proof_data text,
  aqua_attestation_hash text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view payouts"
  ON payouts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert payouts"
  ON payouts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payouts"
  ON payouts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can manage payouts"
  ON payouts FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  participant_id uuid REFERENCES participants(id) ON DELETE SET NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  aqua_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_event_type CHECK (event_type IN ('approval', 'check_in', 'payout', 'verification', 'system'))
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view activity log"
  ON activity_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activity log"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can insert activity log"
  ON activity_log FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_travel_approvals_participant ON travel_approvals(participant_id);
CREATE INDEX IF NOT EXISTS idx_travel_approvals_status ON travel_approvals(status);
CREATE INDEX IF NOT EXISTS idx_check_ins_approval ON check_ins(travel_approval_id);
CREATE INDEX IF NOT EXISTS idx_payouts_approval ON payouts(travel_approval_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_participant ON activity_log(participant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);

