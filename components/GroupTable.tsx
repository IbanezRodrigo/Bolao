import React, { useMemo } from 'react';
import { Language, Match } from '../types';
import { useMatches } from '../hooks/useMatches';

interface Props {
  lang: Language;
}

interface TeamStanding {
  teamId: string;
  name: Record<'pt' | 'en' | 'es', string>;
  flag: string;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

function buildStandings(matches: Match[]): [string, TeamStanding[]][] {
  const groupTeams: Record<string, Record<string, TeamStanding>> = {};

  // Register every team from every GROUP phase match (even unplayed ones show 0s)
  for (const m of matches) {
    if (m.phase !== 'GROUP') continue;
    if (!groupTeams[m.group]) groupTeams[m.group] = {};
    if (!groupTeams[m.group][m.homeTeam.id]) {
      groupTeams[m.group][m.homeTeam.id] = {
        teamId: m.homeTeam.id, name: m.homeTeam.name, flag: m.homeTeam.flag,
        mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0,
      };
    }
    if (!groupTeams[m.group][m.awayTeam.id]) {
      groupTeams[m.group][m.awayTeam.id] = {
        teamId: m.awayTeam.id, name: m.awayTeam.name, flag: m.awayTeam.flag,
        mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0,
      };
    }
  }

  const finished = matches.filter(
    m => m.phase === 'GROUP' && m.status === 'FINISHED' &&
         m.actualHomeScore !== undefined && m.actualAwayScore !== undefined,
  );

  for (const m of finished) {
    const hs = m.actualHomeScore!;
    const aw = m.actualAwayScore!;
    const home = groupTeams[m.group][m.homeTeam.id];
    const away = groupTeams[m.group][m.awayTeam.id];
    home.mp++; home.gf += hs; home.ga += aw;
    away.mp++; away.gf += aw; away.ga += hs;
    if (hs > aw)      { home.w++; home.pts += 3; away.l++; }
    else if (aw > hs) { away.w++; away.pts += 3; home.l++; }
    else              { home.d++; home.pts += 1; away.d++; away.pts += 1; }
  }

  const sorted: [string, TeamStanding[]][] = Object.entries(groupTeams).map(([groupName, map]) => {
    const teams = Object.values(map);

    teams.sort((a, b) => {
      // 1. Points
      if (b.pts !== a.pts) return b.pts - a.pts;
      // 2. Goal difference
      if ((b.gf - b.ga) !== (a.gf - a.ga)) return (b.gf - b.ga) - (a.gf - a.ga);
      // 3. Goals scored
      if (b.gf !== a.gf) return b.gf - a.gf;
      // 4-6. Head-to-head (pts → GD → GF) among tied pair
      const h2h = finished.filter(m =>
        (m.homeTeam.id === a.teamId && m.awayTeam.id === b.teamId) ||
        (m.homeTeam.id === b.teamId && m.awayTeam.id === a.teamId),
      );
      let aPts = 0, bPts = 0, aGF = 0, bGF = 0, aGA = 0, bGA = 0;
      for (const m of h2h) {
        const hs = m.actualHomeScore!;
        const aw = m.actualAwayScore!;
        const aIsHome = m.homeTeam.id === a.teamId;
        const [ag, bg] = aIsHome ? [hs, aw] : [aw, hs];
        aGF += ag; aGA += bg; bGF += bg; bGA += ag;
        if (ag > bg) aPts += 3;
        else if (bg > ag) bPts += 3;
        else { aPts += 1; bPts += 1; }
      }
      if (bPts !== aPts) return bPts - aPts;
      if ((bGF - bGA) !== (aGF - aGA)) return (bGF - bGA) - (aGF - aGA);
      if (bGF !== aGF) return bGF - aGF;
      return 0;
    });

    return [groupName, teams];
  });

  sorted.sort(([a], [b]) => a.localeCompare(b));
  return sorted;
}

const GroupTable: React.FC<Props> = ({ lang }) => {
  const { matches, loading } = useMatches();

  const standings = useMemo(() => buildStandings(matches), [matches]);

  const groupLabel = (raw: string) => {
    const letter = raw.replace(/^(Grupo|Group)\s*/i, '').trim() || raw;
    return lang === 'en' ? `Group ${letter}` : `Grupo ${letter}`;
  };

  const cols = {
    mp:  'MP',
    w:   lang === 'pt' ? 'V' : lang === 'es' ? 'G' : 'W',
    d:   'E',
    l:   lang === 'pt' ? 'D' : lang === 'es' ? 'P' : 'L',
    pts: 'Pts',
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {standings.map(([groupName, teams]) => (
        <div key={groupName} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              {groupLabel(groupName)}
            </span>
          </div>

          {/* Column headers */}
          <div className="flex items-center px-4 py-1.5 border-b border-slate-50">
            <span className="flex-1 text-[9px] font-black text-slate-300 uppercase tracking-widest">
              {lang === 'pt' ? 'Equipe' : lang === 'es' ? 'Equipo' : 'Team'}
            </span>
            {(['mp', 'w', 'd', 'l', 'pts'] as const).map(col => (
              <span
                key={col}
                className={`text-[9px] font-black uppercase tracking-widest text-center ${
                  col === 'pts' ? 'w-8 text-blue-500' : 'w-7 text-slate-300'
                }`}
              >
                {cols[col]}
              </span>
            ))}
          </div>

          {/* Team rows */}
          {teams.map((team, idx) => (
            <div
              key={team.teamId}
              className={`flex items-center px-4 py-2.5 ${idx < teams.length - 1 ? 'border-b border-slate-50' : ''} ${idx < 2 ? 'bg-green-50/40' : ''}`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[10px] font-black text-slate-300 w-3 flex-shrink-0">{idx + 1}</span>
                <span className="text-base leading-none flex-shrink-0">{team.flag}</span>
                <span className="text-[11px] font-bold text-slate-700 truncate">{team.name[lang]}</span>
              </div>
              <span className="w-7 text-center text-[11px] font-bold text-slate-400">{team.mp}</span>
              <span className="w-7 text-center text-[11px] font-bold text-slate-400">{team.w}</span>
              <span className="w-7 text-center text-[11px] font-bold text-slate-400">{team.d}</span>
              <span className="w-7 text-center text-[11px] font-bold text-slate-400">{team.l}</span>
              <span className="w-8 text-center text-[13px] font-black text-slate-800">{team.pts}</span>
            </div>
          ))}
        </div>
      ))}

      <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest pt-1">
        {lang === 'pt'
          ? 'Desempate: DG → GP → H2H · Fase de grupos'
          : lang === 'es'
          ? 'Desempate: DG → GF → H2H · Fase de grupos'
          : 'Tiebreak: GD → GF → H2H · Group stage'}
      </p>
    </div>
  );
};

export default GroupTable;
