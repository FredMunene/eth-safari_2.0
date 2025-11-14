import { useEffect, useState } from 'react';
import { CheckCircle, DollarSign, UserCheck, Shield, Activity } from 'lucide-react';
import { supabase, type ActivityLog } from '../lib/supabase';

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();

    const channel = supabase
      .channel('activity_log_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
        loadActivities();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadActivities() {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  }

  function getEventIcon(eventType: string) {
    switch (eventType) {
      case 'approval':
        return UserCheck;
      case 'check_in':
        return CheckCircle;
      case 'payout':
        return DollarSign;
      case 'verification':
        return Shield;
      default:
        return Activity;
    }
  }

  function getEventColor(eventType: string) {
    switch (eventType) {
      case 'approval':
        return 'text-blue-600 bg-blue-50';
      case 'check_in':
        return 'text-green-600 bg-green-50';
      case 'payout':
        return 'text-amber-600 bg-amber-50';
      case 'verification':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  }

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Activity Feed</h2>
        <p className="text-sm text-slate-600 mt-1">Real-time event stream</p>
      </div>

      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading activity...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No recent activity</div>
        ) : (
          activities.map((activity) => {
            const Icon = getEventIcon(activity.event_type);
            const colorClass = getEventColor(activity.event_type);

            return (
              <div key={activity.id} className="flex gap-3">
                <div className={`flex-shrink-0 h-8 w-8 rounded-full ${colorClass} flex items-center justify-center`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">
                      {formatTimestamp(activity.created_at)}
                    </span>
                    {activity.aqua_verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <Shield className="h-3 w-3" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
