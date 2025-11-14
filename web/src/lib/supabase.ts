import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Participant = {
  id: string;
  name: string;
  email: string;
  role: string;
  photo_url?: string;
  created_at: string;
};

export type TravelApproval = {
  id: string;
  participant_id: string;
  itinerary: string;
  stipend_amount: number;
  sponsor_notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  aqua_attestation_hash?: string;
  qr_token: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
};

export type CheckIn = {
  id: string;
  travel_approval_id: string;
  location: string;
  timestamp: string;
  scanned_by?: string;
  aqua_attestation_hash?: string;
  created_at: string;
};

export type Payout = {
  id: string;
  travel_approval_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  proof_type?: string;
  proof_data?: string;
  aqua_attestation_hash?: string;
  processed_by?: string;
  processed_at?: string;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  event_type: 'approval' | 'check_in' | 'payout' | 'verification' | 'system';
  participant_id?: string;
  description: string;
  metadata: Record<string, any>;
  aqua_verified: boolean;
  created_at: string;
};
