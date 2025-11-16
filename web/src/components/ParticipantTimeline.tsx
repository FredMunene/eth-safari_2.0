import { useCallback, useEffect, useState } from 'react';
import { X, CheckCircle, Clock, DollarSign, AlertCircle, Shield } from 'lucide-react';
import { supabase, type Participant, type TravelApproval, type CheckIn, type Payout } from '../lib/supabase';

type TimelineDetails = TravelApproval | CheckIn | Payout;

type TimelineEvent = {
  id: string;
  type: 'approval' | 'check_in' | 'payout';
  timestamp: string;
  status: string;
  details: TimelineDetails;
};

type Props = {
  participant: Participant & {
    travel_approval?: TravelApproval;
  };
  onClose: () => void;
};

export default function ParticipantTimeline({ participant, onClose }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTimeline = useCallback(async () => {
    try {
      const timelineEvents: TimelineEvent[] = [];

      const { data: approvals } = await supabase
        .from('travel_approvals')
        .select('*')
        .eq('participant_id', participant.id)
        .order('created_at', { ascending: false });

      if (approvals && approvals.length > 0) {
        const approval = approvals[0];
        timelineEvents.push({
          id: approval.id,
          type: 'approval',
          timestamp: approval.approved_at || approval.created_at,
          status: approval.status,
          details: approval,
        });

        const { data: checkIns } = await supabase
          .from('check_ins')
          .select('*')
          .eq('travel_approval_id', approval.id)
          .order('timestamp', { ascending: false });

        if (checkIns) {
          checkIns.forEach((checkIn) => {
            timelineEvents.push({
              id: checkIn.id,
              type: 'check_in',
              timestamp: checkIn.timestamp,
              status: 'completed',
              details: checkIn,
            });
          });
        }

        const { data: payouts } = await supabase
          .from('payouts')
          .select('*')
          .eq('travel_approval_id', approval.id)
          .order('created_at', { ascending: false });

        if (payouts) {
          payouts.forEach((payout) => {
            timelineEvents.push({
              id: payout.id,
              type: 'payout',
              timestamp: payout.processed_at || payout.created_at,
              status: payout.status,
              details: payout,
            });
          });
        }
      }

      timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setEvents(timelineEvents);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoading(false);
    }
  }, [participant.id]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'approved':
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected':
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'processing':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  function getEventIcon(type: string, status: string) {
    if (status === 'pending' || status === 'processing') {
      return <Clock className="h-5 w-5" />;
    }
    if (status === 'rejected' || status === 'failed') {
      return <AlertCircle className="h-5 w-5" />;
    }

    switch (type) {
      case 'approval':
        return <Shield className="h-5 w-5" />;
      case 'check_in':
        return <CheckCircle className="h-5 w-5" />;
      case 'payout':
        return <DollarSign className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  }

  function getEventTitle(event: TimelineEvent) {
    switch (event.type) {
      case 'approval':
        return 'Travel Approval';
      case 'check_in':
        return 'Check-In';
      case 'payout':
        return 'Stipend Payout';
      default:
        return 'Event';
    }
  }

  function getEventDescription(event: TimelineEvent) {
    switch (event.type) {
      case 'approval': {
        const details = event.details as TravelApproval;
        return `Stipend: $${details.stipend_amount} | ${details.itinerary}`;
      }
      case 'check_in': {
        const details = event.details as CheckIn;
        return `Location: ${details.location}`;
      }
      case 'payout': {
        const details = event.details as Payout;
        return `Amount: $${details.amount} ${details.proof_type ? `| ${details.proof_type}` : ''}`;
      }
      default:
        return '';
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Participant Timeline</h2>
            <p className="text-slate-600 mt-1">{participant.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-2xl font-medium">
                {participant.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{participant.name}</h3>
                <p className="text-sm text-slate-600">{participant.email}</p>
                <p className="text-sm text-slate-500">{participant.role}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading timeline...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No events found</div>
          ) : (
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200"></div>
              <div className="space-y-6">
                {events.map((event) => (
                  <div key={event.id} className="relative flex gap-4">
                    <div className={`flex-shrink-0 h-12 w-12 rounded-full border-2 ${getStatusColor(event.status)} flex items-center justify-center z-10 bg-white`}>
                      {getEventIcon(event.type, event.status)}
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-slate-900">{getEventTitle(event)}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(event.status)}`}>
                            {event.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{getEventDescription(event)}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                        {event.details.aqua_attestation_hash && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Shield className="h-3 w-3 text-green-600" />
                              <span className="font-mono text-xs truncate">
                                {event.details.aqua_attestation_hash}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
