import React, { useState, useMemo } from 'react';
import { Language } from '../types';
import { useMatches } from '../hooks/useMatches';

interface Props {
  lang: Language;
}

type KnockoutRound = 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL';

const KNOCKOUT_ROUNDS: KnockoutRound[] = ['R32', 'R16', 'QF', 'SF', 'FINAL'];

const ROUND_PILL: Record<KnockoutRound, Record<Language, string>> = {
  R32:   { pt: 'R32',     en: 'R32',     es: 'R32'     },
  R16:   { pt: 'Oitavas', en: 'R16',     es: 'Octavos' },
  QF:    { pt: 'Quartas', en: 'QF',      es: 'Cuartos' },
  SF:    { pt: 'Semis',   en: 'SF',      es: 'Semis'   },
  FINAL: { pt: 'Final',   en: 'Final',   es: 'Final'   },
};

const ROUND_FULL: Record<KnockoutRound, Record<Language, string>> = {
  R32:   { pt: 'Round de 32',       en: 'Round of 32',    es: 'Ronda de 32'      },
  R16:   { pt: 'Oitavas de Final',  en: 'Round of 16',    es: 'Octavos de Final' },
  QF:    { pt: 'Quartas de Final',  en: 'Quarter-Finals', es: 'Cuartos de Final' },
  SF:    { pt: 'Semifinais',        en: 'Semi-Finals',    es: 'Semifinales'      },
  FINAL: { pt: 'Final',             en: 'Final',          es: 'Final'            },
};

const LOCALE_MAP: Record<Language, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

const KnockoutBracket: React.FC<Props> = ({ lang }) => {
  const { matches, loading } = useMatches();

  const knockoutMatches = useMemo(
    () => matches.filter(m => m.phase !== 'GROUP'),
    [matches],
  );

  const availableRounds = useMemo(
    () => KNOCKOUT_ROUNDS.filter(r => knockoutMatches.some(m => m.phase === r)),
    [knockoutMatches],
  );

  const defaultRound = useMemo((): KnockoutRound => {
    if (availableRounds.length === 0) return 'R32';
    for (const round of availableRounds) {
      if (knockoutMatches.some(m => m.phase === round && (m.status === 'LIVE' || m.status === 'SCHEDULED'))) {
        return round;
      }
    }
    return availableRounds[availableRounds.length - 1];
  }, [availableRounds, knockoutMatches]);

  const [selectedRound, setSelectedRound] = useState<KnockoutRound | null>(null);
  const activeRound = selectedRound ?? defaultRound;

  const roundMatches = useMemo(
    () =>
      knockoutMatches
        .filter(m => m.phase === activeRound)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [knockoutMatches, activeRound],
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (knockoutMatches.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
          {lang === 'pt'
            ? 'Fase eliminatória ainda não iniciou.'
            : lang === 'es'
            ? 'La fase eliminatoria aún no ha comenzado.'
            : 'Knockout stage has not started yet.'}
        </p>
      </div>
    );
  }

  const locale = LOCALE_MAP[lang];

  return (
    <div className="pb-4">
      {/* Round selector */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {KNOCKOUT_ROUNDS.map(round => {
          const hasMatches = availableRounds.includes(round);
          const isActive = round === activeRound;
          return (
            <button
              key={round}
              onClick={() => hasMatches && setSelectedRound(round)}
              disabled={!hasMatches}
              className={`flex-shrink-0 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : hasMatches
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-slate-50 text-slate-200 cursor-default'
              }`}
            >
              {ROUND_PILL[round][lang]}
            </button>
          );
        })}
      </div>

      {/* Round title */}
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 text-center">
        {ROUND_FULL[activeRound][lang]}
      </p>

      {/* Match cards */}
      <div className="space-y-2">
        {roundMatches.map(match => {
          const isFinished = match.status === 'FINISHED';
          const isLive = match.status === 'LIVE';
          const hasScore =
            match.actualHomeScore !== undefined && match.actualAwayScore !== undefined;
          const homeWins = isFinished && hasScore && match.actualHomeScore! > match.actualAwayScore!;
          const awayWins = isFinished && hasScore && match.actualAwayScore! > match.actualHomeScore!;

          const matchDate = new Date(match.startTime);
          const dateStr = matchDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
          const timeStr = matchDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={match.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              {/* Home team */}
              <div className={`flex items-center px-4 py-3 ${homeWins ? 'bg-green-50/50' : ''}`}>
                <span className="text-xl leading-none flex-shrink-0 w-8">{match.homeTeam.flag}</span>
                <span className={`flex-1 text-[13px] font-bold truncate mx-2 ${homeWins ? 'text-slate-900' : 'text-slate-600'}`}>
                  {match.homeTeam.name[lang]}
                </span>
                {(isFinished || isLive) && hasScore && (
                  <span className={`text-lg font-black w-6 text-right flex-shrink-0 ${homeWins ? 'text-slate-900' : 'text-slate-400'}`}>
                    {match.actualHomeScore}
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-50 mx-4" />

              {/* Away team */}
              <div className={`flex items-center px-4 py-3 ${awayWins ? 'bg-green-50/50' : ''}`}>
                <span className="text-xl leading-none flex-shrink-0 w-8">{match.awayTeam.flag}</span>
                <span className={`flex-1 text-[13px] font-bold truncate mx-2 ${awayWins ? 'text-slate-900' : 'text-slate-600'}`}>
                  {match.awayTeam.name[lang]}
                </span>
                {(isFinished || isLive) && hasScore && (
                  <span className={`text-lg font-black w-6 text-right flex-shrink-0 ${awayWins ? 'text-slate-900' : 'text-slate-400'}`}>
                    {match.actualAwayScore}
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className={`px-4 py-1.5 flex items-center justify-between border-t border-slate-50 ${isLive ? 'bg-red-50' : 'bg-slate-50/30'}`}>
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest truncate max-w-[55%]">
                  {match.venue}
                </span>
                {isLive ? (
                  <span className="text-[9px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                    Live
                  </span>
                ) : isFinished ? (
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {lang === 'pt' ? 'Encerrado' : lang === 'es' ? 'Finalizado' : 'Full Time'}
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-slate-400 flex-shrink-0">
                    {dateStr} · {timeStr}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-widest pt-3">
        {ROUND_FULL[activeRound][lang]}
      </p>
    </div>
  );
};

export default KnockoutBracket;
