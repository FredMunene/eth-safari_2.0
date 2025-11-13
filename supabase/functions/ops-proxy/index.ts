import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from 'https://esm.sh/@supabase/functions-js@2.4.1/dist/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { PrivyClient } from 'https://esm.sh/@privy-io/server-auth@1.32.5?target=deno';
import { z } from 'https://esm.sh/zod@3.23.8';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const privyAppId = Deno.env.get('PRIVY_APP_ID');
const privyAppSecret = Deno.env.get('PRIVY_APP_SECRET');

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

type ProxyPayload =
  | {
      action: 'issue_travel_approval';
      payload: IssueApprovalInput;
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

  await supabase.from('activity_log').insert({
    event_type: 'approval',
    participant_id: participantId,
    description: `Travel approval issued via proxy`,
    metadata: {
      approval_id: approval.id,
      stipend_amount: payload.stipendAmount,
      operator_privy_user: operatorId,
    },
    aqua_verified: false,
  });

  return { approval };
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
