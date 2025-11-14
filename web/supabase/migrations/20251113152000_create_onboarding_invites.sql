-- Onboarding invites table to support participant self-submissions

CREATE TABLE IF NOT EXISTS onboarding_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'Hacker',
  token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'cancelled')),
  form_data jsonb DEFAULT '{}'::jsonb,
  participant_id uuid REFERENCES participants(id) ON DELETE SET NULL,
  travel_approval_id uuid REFERENCES travel_approvals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  submitted_at timestamptz
);

ALTER TABLE onboarding_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view onboarding invites"
  ON onboarding_invites FOR SELECT
  TO anon
  USING (true);
