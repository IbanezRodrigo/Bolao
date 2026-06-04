import { useState, useEffect } from 'react';
import { Match, Team, MatchPhase, MatchStatus } from '../types';
import { TEAMS, getTeamFlag } from '../constants';
import { supabase } from '../supabase';

interface UseMatchesReturn {
  matches: Match[];
  loading: boolean;
  error: string | null;
}

interface DBMatch {
  id: string;
  home_team_id: string;
  away_team_id: string;
  actual_home_score: number | null;
  actual_away_score: number | null;
  start_time: string;
  venue: string | null;
  match_group: string | null;
  phase: MatchPhase | null;
  status: MatchStatus | null;
  external_id: string | null;
}

const getTeamObject = (teamId: string): Team => {
  // Tenta achar pelo ID direto (ex: 'BRA', 'USA')
  if (TEAMS[teamId]) return TEAMS[teamId];

  // Tenta achar por nome em qualquer idioma
  const found = Object.values(TEAMS).find(
    t =>
      t.name.pt.toLowerCase() === teamId.toLowerCase() ||
      t.name.en.toLowerCase() === teamId.toLowerCase() ||
      t.name.es.toLowerCase() === teamId.toLowerCase()
  );
  if (found) return found;

  // Fallback
  return {
    id: teamId,
    name: { pt: teamId, en: teamId, es: teamId },
    flag: getTeamFlag(teamId),
    color: '#CCCCCC',
  };
};

export const useMatches = (): UseMatchesReturn => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('matches')
          .select('*')
          .order('start_time', { ascending: true });

        if (fetchError) {
          console.error('❌ Error fetching matches:', fetchError);
          setError(fetchError.message);
          return;
        }

        if (!data) { setMatches([]); return; }

        const transformed: Match[] = data.map((m: DBMatch) => ({
          id:               m.id,
          homeTeam:         getTeamObject(m.home_team_id),
          awayTeam:         getTeamObject(m.away_team_id),
          startTime:        m.start_time,
          venue:            m.venue || '',
          group:            m.match_group || '',
          phase:            m.phase || 'GROUP',
          actualHomeScore:  m.actual_home_score ?? undefined,
          actualAwayScore:  m.actual_away_score ?? undefined,
          status:           m.status || 'SCHEDULED',
          externalId:       m.external_id || undefined,
        }));

        console.log(`✅ Fetched ${transformed.length} matches`);
        setMatches(transformed);
      } catch (err: any) {
        console.error('❌ Unexpected error fetching matches:', err);
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  return { matches, loading, error };
};
