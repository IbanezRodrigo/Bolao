import React, { useState } from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import MatchCard from './MatchCard';
import PredictionModal from './PredictionModal';
import { useMatches } from '../hooks/useMatches';
import { usePredictions } from '../hooks/usePredictions';
import { Match, Prediction } from '../types';
import { supabase } from '../supabase';

interface MatchListProps {
  lang: Language;
  groupId: string | null;
}

type Phase = 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL';

const PHASE_ORDER: Phase[] = ['GROUP', 'R32', 'R16', 'QF', 'SF', 'FINAL'];

const PHASE_LABELS: Record<Phase, Record<string, string>> = {
  GROUP: { pt: 'Fase de Grupos',   en: 'Group Stage',     es: 'Fase de Grupos'     },
  R32:   { pt: 'Round of 32',      en: 'Round of 32',     es: 'Round of 32'        },
  R16:   { pt: 'Oitavas de Final', en: 'Round of 16',     es: 'Octavos de Final'   },
  QF:    { pt: 'Quartas de Final', en: 'Quarter-Finals',  es: 'Cuartos de Final'   },
  SF:    { pt: 'Semifinais',       en: 'Semi-Finals',     es: 'Semifinales'        },
  FINAL: { pt: 'Final',            en: 'Final',           es: 'Final'              },
};

// CORRIGIDO: usa horário local do browser (não UTC) para agrupar por data
const getLocalDateKey = (startTime: string): string => {
  const d = new Date(startTime);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const groupMatchesByPhaseAndDate = (matches: Match[]): Record<string, Record<string, Match[]>> => {
  const result: Record<string, Record<string, Match[]>> = {};
  matches.forEach(m => {
    const phase = (m.phase || 'GROUP') as Phase;
    if (!result[phase]) result[phase] = {};
    const dateKey = getLocalDateKey(m.startTime);
    if (!result[phase][dateKey]) result[phase][dateKey] = [];
    result[phase][dateKey].push(m);
  });
  return result;
};

const formatDateHeader = (dateKey: string, lang: Language): string => {
  const date = new Date(dateKey + 'T12:00:00');
  const locale = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';
  const dayName = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).toUpperCase();
  const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date).toUpperCase();
  return `${dayMonth} - ${dayName}`;
};

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const MatchList: React.FC<MatchListProps> = ({ lang, groupId }) => {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const [showFinished, setShowFinished] = useState(false);
  const [openFinishedPhases, setOpenFinishedPhases] = useState<Record<string, boolean>>({});
  const [openUpcomingPhases, setOpenUpcomingPhases] = useState<Record<string, boolean>>({ GROUP: true });

  const [currentUserId, setCurrentUserId] = useState<string>('');

  const { matches, loading: matchesLoading, error: matchesError } = useMatches();
  const { predictions, loading: predictionsLoading, submitPrediction } = usePredictions(groupId || '');
  const t = TRANSLATIONS[lang];

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user?.id) setCurrentUserId(data.session.user.id);
    });
  }, []);

  const finishedMatches = matches
    .filter(m => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const upcomingMatches = matches
    .filter(m => m.status !== 'FINISHED')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const finishedByPhase = groupMatchesByPhaseAndDate(finishedMatches);
  const upcomingByPhase = groupMatchesByPhaseAndDate(upcomingMatches);

  const toggleFinishedPhase = (phase: string) =>
    setOpenFinishedPhases(prev => ({ ...prev, [phase]: !prev[phase] }));

  const toggleUpcomingPhase = (phase: string) =>
    setOpenUpcomingPhases(prev => ({ ...prev, [phase]: !prev[phase] }));

  const handleSavePrediction = async (pred: Prediction) => {
    if (!selectedMatch) return;
    try {
      await submitPrediction(selectedMatch.id, pred.homeScore, pred.awayScore);
      setSelectedMatch(null);
    } catch (error) {
      console.error('Failed to save prediction:', error);
    }
  };

  if (matchesLoading || predictionsLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (matchesError) {
    return <div className="text-red-500 text-sm p-4">Erro: {matchesError}</div>;
  }

  return (
    <div className="space-y-6 pb-20">

      <div className="flex justify-between items-center px-1">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">{t.predictions}</h3>
        <p className="text-[10px] text-slate-400 font-medium">{t.matchStartMessage}</p>
      </div>

      {/* ── JOGOS FINALIZADOS — topo, recolhido por padrão ── */}
      {finishedMatches.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowFinished(!showFinished)}
            className="w-full flex items-center justify-between px-1 py-2 hover:bg-slate-50 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3">
              <h4 className="font-black text-slate-500 uppercase tracking-widest text-xs group-hover:text-slate-800 transition-colors">
                {lang === 'pt' ? 'Jogos Finalizados' : lang === 'es' ? 'Partidos Terminados' : 'Finished Matches'}
              </h4>
              <span className="bg-slate-200 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded-full">
                {finishedMatches.length}
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showFinished ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFinished && (
            <div className="space-y-3">
              {[...PHASE_ORDER].reverse().filter(phase => finishedByPhase[phase]).map(phase => (
                <div key={phase} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                  <button
                    onClick={() => toggleFinishedPhase(phase)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                        {PHASE_LABELS[phase][lang]}
                      </span>
                      <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full">
                        {Object.values(finishedByPhase[phase]).flat().length}
                      </span>
                    </div>
                    <ChevronIcon open={!!openFinishedPhases[phase]} />
                  </button>

                  {openFinishedPhases[phase] && (
                    <div className="px-3 pb-4 space-y-4">
                      {Object.keys(finishedByPhase[phase])
                        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                        .map(dateKey => (
                          <div key={dateKey} className="space-y-3">
                            <div className="bg-gradient-to-r from-slate-100 to-slate-50 border-l-4 border-slate-400 px-4 py-2 rounded-r-lg">
                              <h5 className="font-black text-slate-600 text-[11px] tracking-widest">
                                {formatDateHeader(dateKey, lang)}
                              </h5>
                            </div>
                            <div className="grid gap-3">
                              {finishedByPhase[phase][dateKey].map(match => (
                                <MatchCard
                                  key={match.id}
                                  match={match}
                                  lang={lang}
                                  prediction={predictions[match.id]}
                                  groupId={groupId}
                                  currentUserId={currentUserId}
                                  onClick={() => setSelectedMatch(match)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PRÓXIMOS JOGOS — por fase, GROUP aberto por padrão ── */}
      {upcomingMatches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">
              {lang === 'pt' ? 'Próximos Jogos' : lang === 'es' ? 'Próximos Partidos' : 'Upcoming Matches'}
            </h4>
            <span className="bg-blue-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
              {upcomingMatches.length}
            </span>
          </div>

          <div className="space-y-3">
            {PHASE_ORDER.filter(phase => upcomingByPhase[phase]).map(phase => (
              <div key={phase} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleUpcomingPhase(phase)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      {PHASE_LABELS[phase][lang]}
                    </span>
                    <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-full">
                      {Object.values(upcomingByPhase[phase]).flat().length}
                    </span>
                  </div>
                  <ChevronIcon open={!!openUpcomingPhases[phase]} />
                </button>

                {openUpcomingPhases[phase] && (
                  <div className="px-3 pb-4 space-y-4">
                    {Object.keys(upcomingByPhase[phase])
                      .sort()
                      .map(dateKey => (
                        <div key={dateKey} className="space-y-3">
                          <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 px-4 py-2 rounded-r-lg shadow-sm">
                            <h5 className="font-black text-blue-900 text-[11px] tracking-widest">
                              {formatDateHeader(dateKey, lang)}
                            </h5>
                          </div>
                          <div className="grid gap-4">
                            {upcomingByPhase[phase][dateKey].map(match => (
                              <MatchCard
                                key={match.id}
                                match={match}
                                lang={lang}
                                prediction={predictions[match.id]}
                                groupId={groupId}
                                currentUserId={currentUserId}
                                onClick={() => setSelectedMatch(match)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedMatch && (
        <PredictionModal
          lang={lang}
          match={selectedMatch}
          existingPrediction={predictions[selectedMatch.id]}
          onClose={() => setSelectedMatch(null)}
          onSave={handleSavePrediction}
        />
      )}
    </div>
  );
};

export default MatchList;
