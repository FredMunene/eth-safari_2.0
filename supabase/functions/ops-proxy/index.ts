import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from 'https://esm.sh/@supabase/functions-js@2.4.1/dist/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { PrivyClient } from 'https://esm.sh/@privy-io/server-auth@1.32.5?target=deno';
import { z } from 'https://esm.sh/zod@3.23.8';
import Aquafier from 'npm:aqua-js-sdk';

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ||
  Deno.env.get('PROJECT_URL') ||
  Deno.env.get('APP_SUPABASE_URL');
const supabaseServiceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
  Deno.env.get('SERVICE_ROLE_KEY') ||
  Deno.env.get('APP_SUPABASE_SERVICE_KEY');
const privyAppId = Deno.env.get('PRIVY_APP_ID');
const privyAppSecret = Deno.env.get('PRIVY_APP_SECRET');
const aquaEnabled = Deno.env.get('AQUA_ENABLED') !== 'false';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase service-role configuration for ops proxy');
}

if (!privyAppId || !privyAppSecret) {
  throw new Error('Missing Privy credentials for ops proxy');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const privy = new PrivyClient(privyAppId, privyAppSecret);
const aquafier = aquaEnabled ? new Aquafier() : null;

const issueApprovalSchema = z.object({
  participant: z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    email: z.string().email(),
    role: z.string().min(1),
    photo_url: z.string().url().optional().nullable(),
  }),
  itinerary: z.string().min(1),
  stipendAmount: z.number().nonnegative(),
  sponsorNotes: z.string().optional().nullable(),
  status: z.enum(['pending', 'approved', 'rejected']).default('approved'),
});

type IssueApprovalInput = z.infer<typeof issueApprovalSchema>;

const recordCheckInSchema = z.object({
  token: z.string().min(1),
  location: z.string().min(1).default('ETH Safari Venue'),
});

type RecordCheckInInput = z.infer<typeof recordCheckInSchema>;

const completePayoutSchema = z.object({
  payoutId: z.string().uuid(),
  proofType: z.enum(['receipt', 'tx_hash', 'bank_transfer']).optional(),
  proofData: z.string().optional().nullable(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('completed'),
});

type CompletePayoutInput = z.infer<typeof completePayoutSchema>;

const createInviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
});

type CreateInviteInput = z.infer<typeof createInviteSchema>;

const submitOnboardingSchema = z.object({
  token: z.string().uuid(),
  itinerary: z.string().min(1),
  stipendAmount: z.number().nonnegative(),
  notes: z.string().optional().nullable(),
});

type SubmitOnboardingInput = z.infer<typeof submitOnboardingSchema>;

type ProxyPayload =
  | {
      action: 'issue_travel_approval';
      payload: IssueApprovalInput;
    }
  | {
      action: 'record_check_in';
      payload: RecordCheckInInput;
    }
  | {
      action: 'complete_payout';
      payload: CompletePayoutInput;
    }
  | {
      action: 'create_onboarding_invite';
      payload: CreateInviteInput;
    }
  | {
      action: 'submit_onboarding';
      payload: SubmitOnboardingInput;
    }
  | {
      action: 'health';
    };

type JsonValue = Record<string, unknown>;

async function authenticate(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return null;
  }
  try {
    const claims = await privy.verifyAuthToken(token);
    return claims;
  } catch (error) {
    console.error('Privy token verification failed', error);
    return null;
  }
}

async function ensureParticipant(participant: IssueApprovalInput['participant']) {
  if (participant.id) {
    return participant.id;
  }

  if (participant.email) {
    const { data: existing } = await supabase
      .from('participants')
      .select('id')
      .eq('email', participant.email)
      .maybeSingle();

    if (existing?.id) {
      return existing.id as string;
    }
  }

  const { data, error } = await supabase
    .from('participants')
    .insert({
      name: participant.name,
      email: participant.email,
      role: participant.role,
      photo_url: participant.photo_url,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create participant: ${error?.message ?? 'unknown error'}`);
  }

  return data.id as string;
}

type AttestationResult = {
  hash: string | null;
};

async function createAquaAttestation(kind: string, payload: Record<string, unknown>): Promise<AttestationResult | null> {
  if (!aquaEnabled || !aquafier) {
    return null;
  }
  try {
    const fileObject = {
      fileName: `${kind}-${crypto.randomUUID()}.json`,
      fileContent: JSON.stringify({ ...payload, kind, timestamp: new Date().toISOString() }),
    };
    const result = await aquafier.createGenesisRevision(fileObject);
    if (result?.tag === 'ok') {
      const hash =
        result.data?.aquaTree?.tree?.hash ??
        result.data?.aquaTree?.treeMapping?.latestHash ??
        null;
      return { hash };
    }
    console.error('Aqua attestation failed', result);
    return null;
  } catch (error) {
    console.error('Aqua attestation error', error);
    return null;
  }
}

async function issueTravelApproval(payload: IssueApprovalInput, operatorId: string) {
  const participantId = await ensureParticipant(payload.participant);
  const qrToken = crypto.randomUUID();

  const { data: approval, error: approvalError } = await supabase
    .from('travel_approvals')
    .insert({
      participant_id: participantId,
      itinerary: payload.itinerary,
      stipend_amount: payload.stipendAmount,
      sponsor_notes: payload.sponsorNotes ?? null,
      status: payload.status,
      qr_token: qrToken,
      approved_at: payload.status === 'approved' ? new Date().toISOString() : null,
    })
    .select('*')
    .single();

  if (approvalError || !approval) {
    throw new Error(`Failed to create travel approval: ${approvalError?.message ?? 'unknown error'}`);
  }

  const attestation = await createAquaAttestation('travel_approval', {
    approvalId: approval.id,
    participantId,
    stipendAmount: payload.stipendAmount,
    status: payload.status,
    operator_privy_user: operatorId,
  });

  if (attestation?.hash) {
    await supabase
      .from('travel_approvals')
      .update({ aqua_attestation_hash: attestation.hash })
      .eq('id', approval.id);
  }

  await supabase.from('activity_log').insert({
    event_type: 'approval',
    participant_id: participantId,
    description: `Travel approval issued via proxy`,
    metadata: {
      approval_id: approval.id,
      stipend_amount: payload.stipendAmount,
      operator_privy_user: operatorId,
      aqua_hash: attestation?.hash ?? null,
    },
    aqua_verified: Boolean(attestation?.hash),
  });

  return { approval };
}

async function recordCheckIn(payload: RecordCheckInInput, operatorId: string) {
  const { data: approval, error } = await supabase
    .from('travel_approvals')
    .select('id, participant_id, status, participants(name, role)')
    .eq('qr_token', payload.token)
    .maybeSingle();

  if (error || !approval) {
    throw new Error('Approval not found or invalid token');
  }

  if (approval.status !== 'approved') {
    throw new Error('Travel approval is not in approved status');
  }

  const { data: checkIn, error: insertError } = await supabase
    .from('check_ins')
    .insert({
      travel_approval_id: approval.id,
      location: payload.location,
      timestamp: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (insertError || !checkIn) {
    throw new Error(insertError.message);
  }

  const attestation = await createAquaAttestation('check_in', {
    travelApprovalId: approval.id,
    participantId: approval.participant_id,
    location: payload.location,
    operator_privy_user: operatorId,
    checkInId: checkIn.id,
  });

  if (attestation?.hash) {
    await supabase
      .from('check_ins')
      .update({ aqua_attestation_hash: attestation.hash })
      .eq('id', checkIn.id);
  }

  await supabase.from('activity_log').insert({
    event_type: 'check_in',
    participant_id: approval.participant_id,
    description: `${approval.participants?.name ?? 'Participant'} checked in`,
    metadata: {
      approval_id: approval.id,
      location: payload.location,
      operator_privy_user: operatorId,
      aqua_hash: attestation?.hash ?? null,
    },
    aqua_verified: Boolean(attestation?.hash),
  });

  return {
    participant: approval.participants,
    aqua_hash: attestation?.hash ?? null,
  };
}

async function completePayout(payload: CompletePayoutInput, operatorId: string) {
  const { data: payout, error } = await supabase
    .from('payouts')
    .select('id, amount, travel_approval_id, travel_approvals(participant_id, participants(name))')
    .eq('id', payload.payoutId)
    .maybeSingle();

  if (error || !payout) {
    throw new Error('Payout not found');
  }

  const { error: updateError } = await supabase
    .from('payouts')
    .update({
      status: payload.status,
      proof_type: payload.proofType ?? null,
      proof_data: payload.proofData ?? null,
      processed_at: payload.status === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', payload.payoutId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const attestation = await createAquaAttestation('payout', {
    payoutId: payout.id,
    travelApprovalId: payout.travel_approval_id,
    amount: payout.amount,
    status: payload.status,
    operator_privy_user: operatorId,
  });

  if (attestation?.hash) {
    await supabase
      .from('payouts')
      .update({ aqua_attestation_hash: attestation.hash })
      .eq('id', payout.id);
  }

  await supabase.from('activity_log').insert({
    event_type: 'payout',
    participant_id: payout.travel_approvals?.participant_id ?? null,
    description: `Payout of $${payout.amount} marked as ${payload.status}`,
    metadata: {
      payout_id: payout.id,
      proof_type: payload.proofType,
      operator_privy_user: operatorId,
      aqua_hash: attestation?.hash ?? null,
    },
    aqua_verified: Boolean(attestation?.hash),
  });

  return { payoutId: payout.id, status: payload.status };
}

async function createOnboardingInvite(payload: CreateInviteInput, operatorId: string) {
  const token = crypto.randomUUID();
  const { data: invite, error } = await supabase
    .from('onboarding_invites')
    .insert({
      name: payload.name,
      email: payload.email,
      role: payload.role,
      token,
    })
    .select('*')
    .single();

  if (error || !invite) {
    throw new Error(error?.message ?? 'Failed to create invite');
  }

  await supabase.from('activity_log').insert({
    event_type: 'system',
    participant_id: null,
    description: `Onboarding invite issued to ${payload.email}`,
    metadata: {
      invite_id: invite.id,
      operator_privy_user: operatorId,
    },
    aqua_verified: false,
  });

  return { token, invite };
}

async function submitOnboarding(payload: SubmitOnboardingInput, operatorId: string) {
  const { data: invite, error } = await supabase
    .from('onboarding_invites')
    .select('*')
    .eq('token', payload.token)
    .maybeSingle();

  if (error || !invite) {
    throw new Error('Invite not found');
  }

  if (invite.status !== 'pending') {
    throw new Error('Invite already submitted');
  }

  const participantId = await ensureParticipant({
    id: invite.participant_id ?? undefined,
    name: invite.name,
    email: invite.email,
    role: invite.role,
    photo_url: null,
  });

  const { data: approval, error: approvalError } = await supabase
    .from('travel_approvals')
    .insert({
      participant_id: participantId,
      itinerary: payload.itinerary,
      stipend_amount: payload.stipendAmount,
      sponsor_notes: payload.notes ?? null,
      status: 'pending',
      qr_token: crypto.randomUUID(),
    })
    .select('*')
    .single();

  if (approvalError || !approval) {
    throw new Error(`Failed to create travel approval: ${approvalError?.message ?? 'unknown error'}`);
  }

  const attestation = await createAquaAttestation('onboarding_submission', {
    approvalId: approval.id,
    participantId,
    itinerary: payload.itinerary,
    stipendAmount: payload.stipendAmount,
    operator_privy_user: operatorId,
  });

  if (attestation?.hash) {
    await supabase
      .from('travel_approvals')
      .update({ aqua_attestation_hash: attestation.hash })
      .eq('id', approval.id);
  }

  await supabase
    .from('onboarding_invites')
    .update({
      status: 'submitted',
      form_data: {
        itinerary: payload.itinerary,
        stipendAmount: payload.stipendAmount,
        notes: payload.notes ?? null,
      },
      participant_id: participantId,
      travel_approval_id: approval.id,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  await supabase.from('activity_log').insert({
    event_type: 'system',
    participant_id: participantId,
    description: `${invite.name} submitted onboarding form`,
    metadata: {
      invite_id: invite.id,
      approval_id: approval.id,
      operator_privy_user: operatorId,
      aqua_hash: attestation?.hash ?? null,
    },
    aqua_verified: Boolean(attestation?.hash),
  });

  return {
    inviteId: invite.id,
    travelApprovalId: approval.id,
    status: 'submitted',
  };
}

async function handleRequest(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method === 'GET') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        service: 'ops-proxy',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  const claims = await authenticate(request);
  if (!claims) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let body: ProxyPayload;
  try {
    body = (await request.json()) as ProxyPayload;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    switch (body.action) {
      case 'issue_travel_approval': {
        const payload = issueApprovalSchema.parse(body.payload);
        const result = await issueTravelApproval(payload, claims.userId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'record_check_in': {
        const payload = recordCheckInSchema.parse(body.payload);
        const result = await recordCheckIn(payload, claims.userId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'complete_payout': {
        const payload = completePayoutSchema.parse(body.payload);
        const result = await completePayout(payload, claims.userId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'create_onboarding_invite': {
        const payload = createInviteSchema.parse(body.payload);
        const result = await createOnboardingInvite(payload, claims.userId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'submit_onboarding': {
        const payload = submitOnboardingSchema.parse(body.payload);
        const result = await submitOnboarding(payload, claims.userId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'health': {
        return new Response(
          JSON.stringify({ status: 'ok', operator: claims.userId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      default:
        return new Response(
          JSON.stringify({ error: 'Unsupported action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
  } catch (error) {
    console.error('Proxy handler error', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}

serve(handleRequest);
