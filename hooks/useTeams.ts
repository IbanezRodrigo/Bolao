import { useState, useEffect } from 'react';
import { Team } from '../types';
import { supabase } from '../supabase';

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

interface UseTeamsReturn {
  teamsById: Record<string, Team>;
  loading: boolean;
  error: string | null;
}

/**
 * Reference data: the full teams table, keyed by id (TLA). Read-only, fetched
 * once. Used by the knockout bracket to render hardcoded R32 teams that may not
 * appear in any match yet (e.g. teams the API hasn't assigned to a fixture).
 */
export const useTeams = (): UseTeamsReturn => {
  const [teamsById, setTeamsById] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const fetchTeams = async () => {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('id, name_pt, name_en, name_es, flag, color');

      if (!active) return;

      if (fetchError) {
        console.error('❌ Error fetching teams:', fetchError);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const map: Record<string, Team> = {};
      for (const t of (data ?? []) as DBTeam[]) map[t.id] = dbTeamToFrontend(t);
      setTeamsById(map);
      setLoading(false);
    };

    fetchTeams();
    return () => { active = false; };
  }, []);

  return { teamsById, loading, error };
};
