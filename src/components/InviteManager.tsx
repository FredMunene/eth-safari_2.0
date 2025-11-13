import { useEffect, useState } from 'react';
import { X, MailPlus, Copy, RefreshCw } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '../lib/supabase';
import { createInviteRequest } from '../lib/opsProxy';

type Props = {
  onClose: () => void;
};

type Invite = {
  id: string;
  name: string;
  email: string;
  role: string;
  token: string;
  status: 'pending' | 'submitted' | 'approved' | 'cancelled';
  created_at: string;
  submitted_at?: string | null;
};

const ROLE_OPTIONS = ['Hacker', 'Volunteer', 'Speaker', 'Organizer', 'Sponsor'];

export default function InviteManager({ onClose }: Props) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState({ name: '', email: '', role: ROLE_OPTIONS[0] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestToken, setLatestToken] = useState<string | null>(null);
  const { getAccessToken } = usePrivy();

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('onboarding_invites')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setInvites((data as Invite[]) || []);
    } catch (loadError) {
      console.error('Error loading invites:', loadError);
      setError('Failed to load invites');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvite(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Unable to fetch Privy access token. Please re-authenticate.');
      }

      const response = await createInviteRequest(accessToken, {
        name: formState.name,
        email: formState.email,
        role: formState.role,
      });

      setLatestToken(response.token);
      setFormState({ name: '', email: '', role: ROLE_OPTIONS[0] });
      await loadInvites();
    } catch (inviteError) {
      console.error('Error creating invite:', inviteError);
      setError((inviteError as { message?: string })?.message ?? 'Failed to create invite');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setLatestToken(token);
    } catch (copyError) {
      console.error('Failed to copy token', copyError);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Participant Invites</p>
            <h2 className="text-2xl font-bold text-slate-900">Manage Onboarding Tokens</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-6">
          <div className="border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <MailPlus className="h-4 w-4 text-sage-600" />
              Send new invite
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Generate a unique token and share it with the participant. Tokens can be used on the `/apply` portal.
            </p>
            <form onSubmit={handleCreateInvite} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={formState.role}
                  onChange={(e) => setFormState({ ...formState, role: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-500"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-sage-600 py-2 text-white font-semibold hover:bg-sage-700 transition-colors disabled:opacity-50"
              >
                <MailPlus className="h-4 w-4" />
                {submitting ? 'Sending…' : 'Send Invite'}
              </button>
              {latestToken && (
                <div className="rounded-lg border border-sage-200 bg-sage-50 px-3 py-2 text-sm text-sage-900">
                  <p className="font-semibold">Latest token</p>
                  <div className="mt-1 flex items-center justify-between gap-2 font-mono text-xs">
                    <span className="truncate">{latestToken}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyToken(latestToken)}
                      className="inline-flex items-center gap-1 text-sage-700 hover:text-sage-900"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </form>
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Recent invites</h3>
              <button
                onClick={loadInvites}
                className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
            <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : invites.length === 0 ? (
                <p className="text-sm text-slate-500">No invites created yet.</p>
              ) : (
                invites.map((invite) => (
                  <div key={invite.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{invite.name}</p>
                        <p className="text-xs text-slate-500">{invite.email}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        invite.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : invite.status === 'submitted'
                          ? 'bg-blue-100 text-blue-700'
                          : invite.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {invite.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{new Date(invite.created_at).toLocaleDateString()}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyToken(invite.token)}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800"
                      >
                        <Copy className="h-3 w-3" /> Token
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
