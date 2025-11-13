import type { ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';

type Props = {
  children: ReactNode;
};

export default function AuthGate({ children }: Props) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-sage-600 border-t-transparent mx-auto" />
          <p className="text-slate-600 text-sm">Initializing secure session…</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white/95 rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6 border border-slate-100">
          <div>
            <p className="text-sm uppercase tracking-wide text-sage-600 font-semibold mb-1">ETH Safari Ops Hub</p>
            <h1 className="text-2xl font-bold text-slate-900">Sign in to continue</h1>
            <p className="text-sm text-slate-600 mt-2">
              Connect with your wallet, passkey, or email via Privy. Only authenticated operators can issue approvals or payouts.
            </p>
          </div>

          <button
            onClick={() => login()}
            className="w-full py-3 px-4 bg-sage-600 text-white font-semibold rounded-lg shadow-sm hover:bg-sage-700 transition-colors"
          >
            Launch Privy
          </button>

          <p className="text-xs text-slate-500 text-center">
            Need access? Ping the Ops lead for an invite so your wallet can be provisioned.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
