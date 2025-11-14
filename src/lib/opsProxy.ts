import type { Participant } from './supabase';

const DEFAULT_FUNCTIONS_BASE = (() => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return '';
  try {
    const url = new URL(supabaseUrl);
    const projectId = url.host.split('.supabase.co')[0];
    if (!projectId) return '';
    return `https://${projectId}.functions.supabase.co`;
  } catch {
    return '';
  }
})();

const functionsBase =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.replace(/\/$/, '') ||
  DEFAULT_FUNCTIONS_BASE;

if (!functionsBase) {
  // eslint-disable-next-line no-console
  console.warn('Missing Supabase Functions URL; set VITE_SUPABASE_FUNCTIONS_URL for proxy calls');
}

type ParticipantPayload = Pick<Participant, 'name' | 'email' | 'role'> & {
  photo_url?: string | null;
  id?: string;
};

export type IssueApprovalParams = {
  participant: ParticipantPayload;
  itinerary: string;
  stipendAmount: number;
  sponsorNotes?: string;
  status: 'pending' | 'approved' | 'rejected';
};

export type RecordCheckInParams = {
  token: string;
  location?: string;
};

export type CompletePayoutParams = {
  payoutId: string;
  proofType?: 'receipt' | 'tx_hash' | 'bank_transfer';
  proofData?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
};

export type CreateInviteParams = {
  name: string;
  email: string;
  role: string;
};

export type SubmitOnboardingParams = {
  token: string;
  itinerary: string;
  stipendAmount: number;
  notes?: string;
};

export async function issueTravelApprovalRequest(accessToken: string, payload: IssueApprovalParams) {
  if (!functionsBase) {
    throw new Error('Supabase functions URL not configured');
  }

  const response = await fetch(`${functionsBase}/ops-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'issue_travel_approval',
      payload: {
        participant: payload.participant,
        itinerary: payload.itinerary,
        stipendAmount: payload.stipendAmount,
        sponsorNotes: payload.sponsorNotes ?? null,
        status: payload.status,
      },
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Ops proxy request failed';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function createInviteRequest(accessToken: string, payload: CreateInviteParams) {
  if (!functionsBase) {
    throw new Error('Supabase functions URL not configured');
  }

  const response = await fetch(`${functionsBase}/ops-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'create_onboarding_invite',
      payload,
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Ops proxy request failed';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function submitOnboardingRequest(accessToken: string, payload: SubmitOnboardingParams) {
  if (!functionsBase) {
    throw new Error('Supabase functions URL not configured');
  }

  const response = await fetch(`${functionsBase}/ops-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'submit_onboarding',
      payload: {
        token: payload.token,
        itinerary: payload.itinerary,
        stipendAmount: payload.stipendAmount,
        notes: payload.notes ?? null,
      },
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Ops proxy request failed';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function recordCheckInRequest(accessToken: string, payload: RecordCheckInParams) {
  if (!functionsBase) {
    throw new Error('Supabase functions URL not configured');
  }

  const response = await fetch(`${functionsBase}/ops-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'record_check_in',
      payload: {
        token: payload.token,
        location: payload.location ?? 'ETH Safari Venue',
      },
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Ops proxy request failed';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function completePayoutRequest(accessToken: string, payload: CompletePayoutParams) {
  if (!functionsBase) {
    throw new Error('Supabase functions URL not configured');
  }

  const response = await fetch(`${functionsBase}/ops-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: 'complete_payout',
      payload: {
        payoutId: payload.payoutId,
        proofType: payload.proofType,
        proofData: payload.proofData,
        status: payload.status ?? 'completed',
      },
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Ops proxy request failed';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
