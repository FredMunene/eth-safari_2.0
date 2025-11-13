import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Plus, QrCode, DollarSign } from 'lucide-react';
import Dashboard from './components/Dashboard';
import TravelApprovalForm from './components/TravelApprovalForm';
import QRScanner from './components/QRScanner';
import PayoutConsole from './components/PayoutConsole';
import ParticipantTimeline from './components/ParticipantTimeline';
import type { Participant, TravelApproval } from './lib/supabase';
import AuthGate from './components/AuthGate';

type ParticipantRow = Participant & {
  travel_approval?: TravelApproval;
};

function formatWallet(address?: string) {
  if (!address) return null;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function AppShell() {
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showPayoutConsole, setShowPayoutConsole] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { user, logout } = usePrivy();

  function handleSuccess() {
    setShowApprovalForm(false);
    setShowQRScanner(false);
    setShowPayoutConsole(false);
    setRefreshKey(prev => prev + 1);
  }

  const primaryIdentifier =
    formatWallet(user?.wallet?.address) ??
    user?.email?.address ??
    'Authenticated Operator';

  const secondaryIdentifier = user?.email?.address && user?.wallet?.address
    ? user.email.address
    : user?.wallet?.chainType
      ? `Connected via ${user.wallet.chainType}`
      : undefined;

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between py-4">
            <div className="flex items-center justify-between lg:justify-start">
              <h1 className="text-xl font-bold text-slate-900">ETH Safari Ops Hub</h1>
            </div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowApprovalForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New Approval
                </button>
                <button
                  onClick={() => setShowQRScanner(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <QrCode className="h-4 w-4" />
                  Scan QR
                </button>
                <button
                  onClick={() => setShowPayoutConsole(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <DollarSign className="h-4 w-4" />
                  Payouts
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{primaryIdentifier}</p>
                  {secondaryIdentifier && (
                    <p className="text-xs text-slate-500">{secondaryIdentifier}</p>
                  )}
                </div>
                <button
                  onClick={() => logout()}
                  className="px-3 py-2 border border-slate-200 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Dashboard
          key={refreshKey}
          onUpdate={() => setRefreshKey(prev => prev + 1)}
          onViewParticipant={setSelectedParticipant}
        />
      </main>

      {showApprovalForm && (
        <TravelApprovalForm
          onClose={() => setShowApprovalForm(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showQRScanner && (
        <QRScanner
          onClose={() => setShowQRScanner(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showPayoutConsole && (
        <PayoutConsole
          onClose={() => setShowPayoutConsole(false)}
          onSuccess={handleSuccess}
        />
      )}

      {selectedParticipant && (
        <ParticipantTimeline
          participant={selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}
