/* eslint-disable @next/next/no-img-element */
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase, type Participant } from '../lib/supabase';
import { generateQRCode, createQRPayload } from '../lib/qr';
import { issueTravelApprovalRequest, type IssueApprovalParams } from '../lib/opsProxy';

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

export default function TravelApprovalForm({ onClose, onSuccess }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    participantId: '',
    participantName: '',
    participantEmail: '',
    participantRole: 'Hacker',
    itinerary: '',
    stipendAmount: '',
    sponsorNotes: '',
    isNewParticipant: true,
  });
  const { getAccessToken } = usePrivy();

  useEffect(() => {
    loadParticipants();
  }, []);

  async function loadParticipants() {
    const { data } = await supabase
      .from('participants')
      .select('*')
      .order('name');

    setParticipants(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Unable to fetch Privy access token. Please re-authenticate.');
      }

      const stipendAmount = parseFloat(formData.stipendAmount);
      if (Number.isNaN(stipendAmount)) {
        throw new Error('Enter a valid stipend amount.');
      }

      let participantPayload: IssueApprovalParams['participant'];

      if (formData.isNewParticipant) {
        participantPayload = {
          name: formData.participantName,
          email: formData.participantEmail,
          role: formData.participantRole,
          photo_url: null,
        };
      } else {
        const existing = participants.find((p) => p.id === formData.participantId);
        if (!existing) {
          throw new Error('Select an existing participant before issuing approval.');
        }
        participantPayload = {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          role: existing.role,
          photo_url: existing.photo_url ?? null,
        };
      }

      await issueTravelApprovalRequest(accessToken, {
        participant: participantPayload,
        itinerary: formData.itinerary,
        stipendAmount,
        sponsorNotes: formData.sponsorNotes || undefined,
        status: 'approved',
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating approval:', error);
      if ((error as { message?: string })?.message) {
        setErrorMessage((error as { message: string }).message);
      } else {
        setErrorMessage('Failed to create approval. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const generatePreviewQR = useCallback(async () => {
    if (formData.itinerary) {
      const tempToken = crypto.randomUUID();
      const payload = createQRPayload('preview', tempToken);
      const qrCode = await generateQRCode(payload);
      setQrPreview(qrCode);
    }
  }, [formData.itinerary]);

  useEffect(() => {
    generatePreviewQR();
  }, [generatePreviewQR]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Issue Travel Approval</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={formData.isNewParticipant}
                    onChange={(e) => setFormData({ ...formData, isNewParticipant: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">New Participant</span>
                </label>
              </div>

              {formData.isNewParticipant ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.participantName}
                      onChange={(e) => setFormData({ ...formData, participantName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.participantEmail}
                      onChange={(e) => setFormData({ ...formData, participantEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Role
                    </label>
                    <select
                      value={formData.participantRole}
                      onChange={(e) => setFormData({ ...formData, participantRole: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Hacker">Hacker</option>
                      <option value="Volunteer">Volunteer</option>
                      <option value="Speaker">Speaker</option>
                      <option value="Organizer">Organizer</option>
                      <option value="Sponsor">Sponsor</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Select Participant
                  </label>
                  <select
                    required
                    value={formData.participantId}
                    onChange={(e) => setFormData({ ...formData, participantId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a participant...</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Itinerary
                </label>
                <textarea
                  required
                  value={formData.itinerary}
                  onChange={(e) => setFormData({ ...formData, itinerary: e.target.value })}
                  rows={3}
                  placeholder="Departure city, arrival city, dates..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Stipend Amount (USD)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.stipendAmount}
                  onChange={(e) => setFormData({ ...formData, stipendAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sponsor Notes (Optional)
                </label>
                <textarea
                  value={formData.sponsorNotes}
                  onChange={(e) => setFormData({ ...formData, sponsorNotes: e.target.value })}
                  rows={2}
                  placeholder="Internal notes, special requirements..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">QR Token Preview</h3>
              {qrPreview ? (
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                  <img src={qrPreview} alt="QR Code Preview" className="w-full" />
                  <p className="text-xs text-slate-600 text-center mt-2">
                    Ready for printing or sharing
                  </p>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-400">
                  Fill in details to see QR preview
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {loading ? 'Issuing...' : 'Issue Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
