import { useState, useEffect } from 'react';
import { Match, Team, MatchPhase, MatchStatus } from '../types';
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
  home_team: DBTeam;
  away_team: DBTeam;
}

interface DBTeam {
  id: string;
  name_pt: string;
  name_en: string;
  name_es: string;
  flag: string;
  color: string;
}

const dbTeamToFrontend = (t: DBTeam): Team => ({
  id: t.id,
  name: { pt: t.name_pt, en: t.name_en, es: t.name_es },
  flag: t.flag,
  color: t.color,
});

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
          .select(`
            *,
            home_team:teams!matches_home_team_id_fkey(id, name_pt, name_en, name_es, flag, color),
            away_team:teams!matches_away_team_id_fkey(id, name_pt, name_en, name_es, flag, color)
          `)
          .order('start_time', { ascending: true });

        if (fetchError) {
          console.error('❌ Error fetching matches:', fetchError);
          setError(fetchError.message);
          return;
        }

        if (!data) { setMatches([]); return; }

        const transformed: Match[] = data.map((m: DBMatch) => ({
          id:               m.id,
          homeTeam:         dbTeamToFrontend(m.home_team),
          awayTeam:         dbTeamToFrontend(m.away_team),
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
