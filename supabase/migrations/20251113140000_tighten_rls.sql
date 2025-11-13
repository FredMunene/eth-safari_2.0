-- Tighten RLS policies to ensure only service-role proxy can mutate data.

-- Participants
DROP POLICY IF EXISTS "Authenticated users can insert participants" ON participants;
DROP POLICY IF EXISTS "Authenticated users can update participants" ON participants;
DROP POLICY IF EXISTS "Anon can manage participants" ON participants;

CREATE POLICY IF NOT EXISTS "Anon can view participants"
  ON participants FOR SELECT
  TO anon
  USING (true);

-- Travel approvals
DROP POLICY IF EXISTS "Authenticated users can insert travel approvals" ON travel_approvals;
DROP POLICY IF EXISTS "Authenticated users can update travel approvals" ON travel_approvals;
DROP POLICY IF EXISTS "Anon can manage travel approvals" ON travel_approvals;

CREATE POLICY IF NOT EXISTS "Anon can view travel approvals"
  ON travel_approvals FOR SELECT
  TO anon
  USING (true);

-- Check-ins
DROP POLICY IF EXISTS "Authenticated users can insert check-ins" ON check_ins;
DROP POLICY IF EXISTS "Anon can insert check-ins" ON check_ins;

CREATE POLICY IF NOT EXISTS "Anon can view check-ins"
  ON check_ins FOR SELECT
  TO anon
  USING (true);

-- Payouts
DROP POLICY IF EXISTS "Authenticated users can insert payouts" ON payouts;
DROP POLICY IF EXISTS "Authenticated users can update payouts" ON payouts;
DROP POLICY IF EXISTS "Anon can manage payouts" ON payouts;

CREATE POLICY IF NOT EXISTS "Anon can view payouts"
  ON payouts FOR SELECT
  TO anon
  USING (true);

-- Activity log
DROP POLICY IF EXISTS "Authenticated users can insert activity log" ON activity_log;
DROP POLICY IF EXISTS "Anon can insert activity log" ON activity_log;

CREATE POLICY IF NOT EXISTS "Anon can view activity log"
  ON activity_log FOR SELECT
  TO anon
  USING (true);
