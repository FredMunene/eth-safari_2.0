import { useEffect, useState } from 'react';
import { Search, Eye } from 'lucide-react';
import { supabase, type Participant, type TravelApproval, type CheckIn, type Payout } from '../lib/supabase';

type ParticipantRow = Participant & {
  travel_approval?: TravelApproval;
  latest_check_in?: CheckIn;
  payout?: Payout;
};

type Props = {
  onUpdate: () => void;
  onViewParticipant?: (participant: ParticipantRow) => void;
};

export default function ParticipantsTable({ onViewParticipant }: Props) {
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadParticipants();
  }, []);

  async function loadParticipants() {
    try {
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .order('created_at', { ascending: false });

      if (participantsError) throw participantsError;

      const participantsWithDetails = await Promise.all(
        (participantsData || []).map(async (participant) => {
          const [approvalRes, checkInRes, payoutRes] = await Promise.all([
            supabase
              .from('travel_approvals')
              .select('*')
              .eq('participant_id', participant.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('check_ins')
              .select('*')
              .order('timestamp', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('payouts')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          return {
            ...participant,
            travel_approval: approvalRes.data || undefined,
            latest_check_in: checkInRes.data || undefined,
            payout: payoutRes.data || undefined,
          };
        })
      );

      setParticipants(participantsWithDetails);
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function getStatusBadge(status?: string) {
    if (!status) return <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600">No Status</span>;

    const variants = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      processing: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${variants[status as keyof typeof variants] || 'bg-slate-100 text-slate-600'}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Participants</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                Participant
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                Travel Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                Stipend Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                Last Check-in
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading participants...
                </td>
              </tr>
            ) : filteredParticipants.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No participants found
                </td>
              </tr>
            ) : (
              filteredParticipants.map((participant) => (
                <tr key={participant.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium">
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-slate-900">{participant.name}</div>
                        <div className="text-sm text-slate-500">{participant.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(participant.travel_approval?.status)}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(participant.payout?.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-900">
                      {participant.latest_check_in
                        ? new Date(participant.latest_check_in.timestamp).toLocaleDateString()
                        : 'Never'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewParticipant?.(participant)}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
