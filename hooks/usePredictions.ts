import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Prediction } from '../types';

interface UsePredictionsReturn {
  predictions: Record<string, Prediction>;
  loading: boolean;
  error: string | null;
  submitPrediction: (matchId: string, homeScore: number, awayScore: number, isJoker?: boolean) => Promise<void>;
}

interface DBPrediction {
  id: string;
  user_id: string;
  group_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  is_joker: boolean;
  pts_exact_score: number;
  pts_winner: number;
  pts_goal_diff: number;
  pts_one_team: number;
  pts_total_base: number;
  pts_multiplier: number;
  pts_final: number;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export const usePredictions = (groupId: string): UsePredictionsReturn => {
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) { setLoading(false); return; }

    const fetchPredictions = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;

        if (!userId) {
          console.warn('⚠️ No authenticated user');
          setPredictions({});
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('predictions')
          .select('*')
          .eq('user_id', userId)
          .eq('group_id', groupId);

        if (fetchError) {
          console.error('❌ Error fetching predictions:', fetchError);
          setError(fetchError.message);
          return;
        }

        if (!data) { setPredictions({}); return; }

        const map: Record<string, Prediction> = {};
        data.forEach((d: DBPrediction) => {
          map[d.match_id] = {
            homeScore:     d.home_score,
            awayScore:     d.away_score,
            timestamp:     new Date(d.submitted_at).getTime(),
            isJoker:       d.is_joker,
            // Pontuação calculada
            ptsExactScore: d.pts_exact_score,
            ptsWinner:     d.pts_winner,
            ptsGoalDiff:   d.pts_goal_diff,
            ptsOneTeam:    d.pts_one_team,
            ptsTotalBase:  d.pts_total_base,
            ptsMultiplier: d.pts_multiplier,
            ptsFinal:      d.pts_final,
          };
        });

        console.log(`✅ Fetched ${data.length} predictions for group ${groupId}`);
        setPredictions(map);
      } catch (err: any) {
        console.error('❌ Unexpected error:', err);
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
  }, [groupId]);

  const submitPrediction = async (
    matchId: string,
    homeScore: number,
    awayScore: number,
    isJoker: boolean = false
  ): Promise<void> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('No authenticated user');

      const now = new Date().toISOString();

      const { error: upsertError } = await supabase
        .from('predictions')
        .upsert(
          {
            user_id:      userId,
            group_id:     groupId,
            match_id:     matchId,
            home_score:   homeScore,
            away_score:   awayScore,
            is_joker:     isJoker,
            submitted_at: now,
            updated_at:   now,
          },
          { onConflict: 'user_id,group_id,match_id' }
        );

      if (upsertError) {
        console.error('❌ Error saving prediction:', upsertError);
        throw upsertError;
      }

      // Atualiza estado local otimisticamente
      setPredictions(prev => ({
        ...prev,
        [matchId]: {
          homeScore,
          awayScore,
          timestamp: Date.now(),
          isJoker,
          ptsExactScore: 0,
          ptsWinner: 0,
          ptsGoalDiff: 0,
          ptsOneTeam: 0,
          ptsTotalBase: 0,
          ptsMultiplier: 1.0,
          ptsFinal: 0,
        },
      }));

      console.log(`✅ Prediction saved: ${matchId} → ${homeScore}-${awayScore}`);
    } catch (err: any) {
      console.error('❌ Failed to submit prediction:', err);
      throw err;
    }
  };

  return { predictions, loading, error, submitPrediction };
};
