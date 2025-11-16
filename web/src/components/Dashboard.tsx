import { useEffect, useState } from 'react';
import { Users, CheckCircle, DollarSign } from 'lucide-react';
import { supabase, type Participant, type TravelApproval, type CheckIn, type Payout } from '../lib/supabase';
import ParticipantsTable from './ParticipantsTable';
import ActivityFeed from './ActivityFeed';

type Metrics = {
  approvedTravelers: number;
  arrivalsToday: number;
  payoutsPending: number;
};

type ParticipantRow = Participant & {
  travel_approval?: TravelApproval;
  latest_check_in?: CheckIn;
  payout?: Payout;
};

type Props = {
  onUpdate: () => void;
  onViewParticipant?: (participant: ParticipantRow) => void;
};

export default function Dashboard({ onUpdate, onViewParticipant }: Props) {
  const [metrics, setMetrics] = useState<Metrics>({
    approvedTravelers: 0,
    arrivalsToday: 0,
    payoutsPending: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  async function loadMetrics() {
    try {
      const [approvalsRes, checkInsRes, payoutsRes] = await Promise.all([
        supabase
          .from('travel_approvals')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved'),
        supabase
          .from('check_ins')
          .select('id', { count: 'exact', head: true })
          .gte('timestamp', new Date().toISOString().split('T')[0]),
        supabase
          .from('payouts')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      setMetrics({
        approvedTravelers: approvalsRes.count || 0,
        arrivalsToday: checkInsRes.count || 0,
        payoutsPending: payoutsRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  const metricCards = [
    {
      title: 'Approved Travelers',
      value: metrics.approvedTravelers,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Arrivals Today',
      value: metrics.arrivalsToday,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Payouts Pending',
      value: metrics.payoutsPending,
      icon: DollarSign,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">ETH Safari Ops Hub</h1>
        <p className="text-slate-600 mt-1">Manage travel, check-ins, and payouts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metricCards.map((metric) => (
          <div
            key={metric.title}
            className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{metric.title}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {loading ? '...' : metric.value}
                </p>
              </div>
              <div className={`${metric.bgColor} p-3 rounded-lg`}>
                <metric.icon className={`h-6 w-6 ${metric.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ParticipantsTable onUpdate={() => { loadMetrics(); onUpdate(); }} onViewParticipant={onViewParticipant} />
        </div>
        <div>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
