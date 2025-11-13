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
