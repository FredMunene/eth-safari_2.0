import { useState } from 'react';
import { Plus, QrCode, DollarSign } from 'lucide-react';
import Dashboard from './components/Dashboard';
import TravelApprovalForm from './components/TravelApprovalForm';
import QRScanner from './components/QRScanner';
import PayoutConsole from './components/PayoutConsole';
import ParticipantTimeline from './components/ParticipantTimeline';
import type { Participant, TravelApproval } from './lib/supabase';

type ParticipantRow = Participant & {
  travel_approval?: TravelApproval;
};

function App() {
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showPayoutConsole, setShowPayoutConsole] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleSuccess() {
    setShowApprovalForm(false);
    setShowQRScanner(false);
    setShowPayoutConsole(false);
    setRefreshKey(prev => prev + 1);
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-slate-900">ETH Safari Ops Hub</h1>
            </div>
            <div className="flex items-center gap-3">
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

export default App;
