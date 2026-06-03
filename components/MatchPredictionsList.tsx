import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

interface Prediction {
  id: string;
  user_id: string;
  home_score: number;
  away_score: number;
  is_joker: boolean;
  points?: number;
}

interface Profile {
  id: string;
  name: string;
  photo_url?: string;
}

interface PredictionWithUser extends Prediction {
  profile: Profile;
}

interface Props {
  matchId: string;
  groupId: string;
  currentUserId?: string;
  matchStatus: 'SCHEDULED' | 'LIVE' | 'FINISHED';
}

const MatchPredictionsList = ({ matchId, groupId, currentUserId, matchStatus }: Props) => {
  const [predictions, setPredictions] = useState<PredictionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPredictions();
  }, [matchId, groupId]);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all users in the group
      const { data: groupMembers, error: groupError } = await supabase
        .from('user_groups')
        .select('user_id')
        .eq('group_id', groupId);

      if (groupError) throw groupError;

      const userIds = groupMembers?.map(m => m.user_id) || [];

      if (userIds.length === 0) {
        setPredictions([]);
        setLoading(false);
        return;
      }

      // Fetch predictions for this match from group members
      const { data: preds, error: predsError } = await supabase
        .from('predictions')
        .select(`
          id,
          user_id,
          home_score,
          away_score,
          is_joker,
          points
        `)
        .eq('match_id', matchId)
        .in('user_id', userIds);

      if (predsError) throw predsError;

      if (!preds || preds.length === 0) {
        setPredictions([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for all users who made predictions
      const predUserIds = preds.map(p => p.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, photo_url')
        .in('id', predUserIds);

      if (profilesError) throw profilesError;

      // Merge predictions with profiles
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const predsWithUsers: PredictionWithUser[] = preds
        .map(pred => ({
          ...pred,
          profile: profilesMap.get(pred.user_id) || { 
            id: pred.user_id, 
            name: 'Unknown User' 
          }
        }))
        // Filter out current user's prediction
        .filter(p => p.user_id !== currentUserId)
        // Sort by points (if available) or alphabetically
        .sort((a, b) => {
          if (matchStatus === 'FINISHED' && a.points !== undefined && b.points !== undefined) {
            return (b.points || 0) - (a.points || 0);
          }
          return a.profile.name.localeCompare(b.profile.name);
        });

      setPredictions(predsWithUsers);
    } catch (err) {
      console.error('Error fetching predictions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-[10px] text-red-500 text-center">{error}</p>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 italic text-center">No other predictions found.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
        Other Players ({predictions.length})
      </h4>
      <div className="space-y-2">
        {predictions.map((pred) => (
          <div 
            key={pred.id} 
            className="flex items-center justify-between bg-slate-50/50 p-2 rounded-xl border border-slate-100"
          >
            <div className="flex items-center gap-2">
              {pred.profile.photo_url ? (
                <img 
                  src={pred.profile.photo_url} 
                  alt={pred.profile.name}
                  className="w-6 h-6 rounded-md object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-md bg-slate-200 flex items-center justify-center text-[8px] font-black text-slate-500">
                  {pred.profile.name[0]?.toUpperCase() || '?'}
                </div>
              )}
              <span className="text-[10px] font-bold text-slate-700">{pred.profile.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-900">
                {pred.home_score}-{pred.away_score} {pred.is_joker && '🃏'}
              </span>
              {matchStatus === 'FINISHED' && pred.points !== undefined && (
                <span className="text-[9px] font-black text-blue-600">+{pred.points}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MatchPredictionsList;
