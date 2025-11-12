import { useEffect, useState } from 'react';
import { DollarSign, CheckCircle, X, AlertCircle } from 'lucide-react';
import { supabase, type Payout, type TravelApproval, type Participant } from '../lib/supabase';

type PayoutWithDetails = Payout & {
  travel_approval?: TravelApproval & {
    participant?: Participant;
  };
};

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

export default function PayoutConsole({ onClose, onSuccess }: Props) {
  const [payouts, setPayouts] = useState<PayoutWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<PayoutWithDetails | null>(null);
  const [proofType, setProofType] = useState<'receipt' | 'tx_hash' | 'bank_transfer'>('tx_hash');
  const [proofData, setProofData] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPayouts();
  }, []);

  async function loadPayouts() {
    try {
      const { data: payoutsData, error } = await supabase
        .from('payouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const payoutsWithDetails = await Promise.all(
        (payoutsData || []).map(async (payout) => {
          const { data: approval } = await supabase
            .from('travel_approvals')
            .select('*, participants(*)')
            .eq('id', payout.travel_approval_id)
            .maybeSingle();

          return {
            ...payout,
            travel_approval: approval ? {
              ...approval,
              participant: approval.participants,
            } : undefined,
          };
        })
      );

      setPayouts(payoutsWithDetails);
    } catch (error) {
      console.error('Error loading payouts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAsPaid(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPayout) return;

    setProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from('payouts')
        .update({
          status: 'completed',
          proof_type: proofType,
          proof_data: proofData,
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedPayout.id);

      if (updateError) throw updateError;

      await supabase.from('activity_log').insert({
        event_type: 'payout',
        participant_id: selectedPayout.travel_approval?.participant?.id,
        description: `Payout of $${selectedPayout.amount} marked as completed`,
        metadata: {
          payout_id: selectedPayout.id,
          proof_type: proofType,
          amount: selectedPayout.amount,
        },
        aqua_verified: false,
      });

      setSelectedPayout(null);
      setProofData('');
      await loadPayouts();
      onSuccess();
    } catch (error) {
      console.error('Error processing payout:', error);
      alert('Failed to process payout. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  function getStatusBadge(status: string) {
    const variants = {
      pending: { class: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
      processing: { class: 'bg-blue-100 text-blue-700', icon: DollarSign },
      completed: { class: 'bg-green-100 text-green-700', icon: CheckCircle },
      failed: { class: 'bg-red-100 text-red-700', icon: X },
    };

    const variant = variants[status as keyof typeof variants] || variants.pending;
    const Icon = variant.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${variant.class}`}>
        <Icon className="h-3 w-3" />
        {status}
      </span>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Finance Payout Console</h2>
            <p className="text-sm text-slate-600 mt-1">Manage stipend disbursements</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {selectedPayout ? (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-2">Payout Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Participant:</span>
                    <span className="font-medium">
                      {selectedPayout.travel_approval?.participant?.name || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Amount:</span>
                    <span className="font-bold text-lg text-green-600">
                      ${selectedPayout.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Status:</span>
                    {getStatusBadge(selectedPayout.status)}
                  </div>
                </div>
              </div>

              <form onSubmit={handleMarkAsPaid} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Proof Type
                  </label>
                  <select
                    value={proofType}
                    onChange={(e) => setProofType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tx_hash">Transaction Hash</option>
                    <option value="receipt">Receipt</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {proofType === 'tx_hash' && 'Transaction Hash'}
                    {proofType === 'receipt' && 'Receipt URL or ID'}
                    {proofType === 'bank_transfer' && 'Transfer Reference'}
                  </label>
                  <input
                    type="text"
                    required
                    value={proofData}
                    onChange={(e) => setProofData(e.target.value)}
                    placeholder={
                      proofType === 'tx_hash'
                        ? '0x...'
                        : proofType === 'receipt'
                        ? 'https://...'
                        : 'REF-...'
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPayout(null);
                      setProofData('');
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {processing ? 'Processing...' : 'Mark as Paid'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8 text-slate-500">Loading payouts...</div>
              ) : payouts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No payouts found</div>
              ) : (
                payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900">
                            {payout.travel_approval?.participant?.name || 'Unknown Participant'}
                          </h3>
                          {getStatusBadge(payout.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span className="font-bold text-green-600">${payout.amount.toFixed(2)}</span>
                          <span>•</span>
                          <span>{new Date(payout.created_at).toLocaleDateString()}</span>
                          {payout.proof_type && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{payout.proof_type.replace('_', ' ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {payout.status === 'pending' && (
                        <button
                          onClick={() => setSelectedPayout(payout)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Process
                        </button>
                      )}
                    </div>
                    {payout.proof_data && (
                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <p className="text-xs text-slate-500">
                          Proof: <span className="font-mono">{payout.proof_data}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
