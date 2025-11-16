import { useEffect, useMemo, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { submitOnboardingRequest } from '../lib/opsProxy';
import { createBrowserAttestation } from '../lib/attestations';

type Invite = {
  id: string;
  name: string;
  email: string;
  role: string;
  token: string;
  status: 'pending' | 'submitted' | 'approved' | 'cancelled';
  form_data?: Record<string, unknown>;
  submitted_at?: string | null;
};

const queryToken = new URLSearchParams(window.location.search).get('token') ?? '';

export default function OnboardingPortal() {
  const [tokenInput, setTokenInput] = useState(queryToken);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [formState, setFormState] = useState({ itinerary: '', stipendAmount: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    if (queryToken) {
      fetchInvite(queryToken);
    }
  }, []);

  const inviteStatusLabel = useMemo(() => {
    if (!invite) return null;
    switch (invite.status) {
      case 'pending':
        return 'Awaiting submission';
      case 'submitted':
        return 'Form submitted';
      case 'approved':
        return 'Approved';
      case 'cancelled':
        return 'Cancelled';
      default:
        return invite.status;
    }
  }, [invite]);

  async function fetchInvite(token: string) {
    try {
      setLoadingInvite(true);
      setInviteError(null);
      const { data, error } = await supabase
        .from('onboarding_invites')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (error || !data) {
        throw new Error('Invite not found');
      }

      setInvite(data as Invite);
      setFormState({
        itinerary: data.form_data?.itinerary ?? '',
        stipendAmount: data.form_data?.stipendAmount?.toString() ?? '',
        notes: data.form_data?.notes ?? '',
      });
      setSubmitSuccess(false);
    } catch (error) {
      console.error('Error fetching invite:', error);
      setInvite(null);
      setInviteError((error as { message?: string })?.message ?? 'Invite not found');
    } finally {
      setLoadingInvite(false);
    }
  }

  async function handleTokenLookup(event: React.FormEvent) {
    event.preventDefault();
    if (!tokenInput) {
      setInviteError('Enter a valid invite token');
      return;
    }
    fetchInvite(tokenInput);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!invite) return;

    const stipendAmount = parseFloat(formState.stipendAmount);
    if (Number.isNaN(stipendAmount)) {
      setSubmitError('Enter a valid stipend amount');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Unable to fetch Privy access token. Please re-authenticate.');
      }

      const wallet = wallets[0];
      if (!wallet) {
        throw new Error('Connect or create a wallet in Privy before submitting.');
      }

      const attestationPayload = {
        token: invite.token,
        itinerary: formState.itinerary,
        stipendAmount,
        notes: formState.notes || null,
        participant_email: invite.email,
        operator_privy_user: user?.id ?? null,
      };

      const attestation = await createBrowserAttestation('onboarding_submission', attestationPayload, wallet);

      await submitOnboardingRequest(accessToken, {
        token: invite.token,
        itinerary: formState.itinerary,
        stipendAmount,
        notes: formState.notes || undefined,
        attestation,
      });

      setSubmitSuccess(true);
      await fetchInvite(invite.token);
    } catch (error) {
      console.error('Error submitting onboarding form:', error);
      setSubmitError((error as { message?: string })?.message ?? 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Participant Onboarding</h1>
        <p className="text-slate-600 mt-2">
          Use the invite token shared by the ETH Safari ops team to submit your travel details and stipend request.
        </p>
        <form onSubmit={handleTokenLookup} className="mt-6 flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            placeholder="Invite token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-sage-600 px-4 py-2 text-white font-semibold hover:bg-sage-700 transition-colors"
          >
            Load Invite
          </button>
        </form>
        {inviteError && <p className="mt-3 text-sm text-red-600">{inviteError}</p>}
      </div>

      {loadingInvite && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-500">
          Loading invite details…
        </div>
      )}

      {invite && !loadingInvite && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-500">Invite for</p>
              <h2 className="text-2xl font-semibold text-slate-900">{invite.name}</h2>
              <p className="text-sm text-slate-500">{invite.email} • {invite.role}</p>
            </div>
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
              invite.status === 'submitted'
                ? 'bg-blue-100 text-blue-700'
                : invite.status === 'approved'
                ? 'bg-green-100 text-green-700'
                : invite.status === 'cancelled'
                ? 'bg-slate-100 text-slate-600'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {invite.status === 'submitted' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {inviteStatusLabel}
            </div>
          </div>

          {invite.status !== 'pending' ? (
            <div className="mt-6 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              This invite was already {invite.status}. If you need to update details, contact the ops team.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Itinerary</label>
                <textarea
                  required
                  value={formState.itinerary}
                  onChange={(e) => setFormState({ ...formState, itinerary: e.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  placeholder="Flight numbers, arrival/departure cities, dates, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Requested stipend (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formState.stipendAmount}
                  onChange={(e) => setFormState({ ...formState, stipendAmount: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Notes (optional)</label>
                <textarea
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  placeholder="Share travel constraints, visa needs, or sponsor context."
                />
              </div>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
              {submitSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  <CheckCircle className="h-4 w-4" /> Submission received! Ops will follow up soon.
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-sage-600 py-2 text-white font-semibold hover:bg-sage-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit for Review'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
