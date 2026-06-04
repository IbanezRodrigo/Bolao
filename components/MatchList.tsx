import React, { useState } from 'react';
import { Match, Language, Prediction } from '../types';
import { TRANSLATIONS } from '../constants';
import MatchCard from './MatchCard';
import PredictionModal from './PredictionModal';
import { useMatches } from '../hooks/useMatches';
import { usePredictions } from '../hooks/usePredictions';
import { supabase } from '../supabase';

interface MatchListProps {
  lang: Language;
  groupId: string | null;
}

const groupMatchesByDate = (matches: Match[]): Record<string, Match[]> => {
  return matches.reduce((groups, match) => {
    const dateKey = new Date(match.startTime).toISOString().split('T')[0];
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(match);
    return groups;
  }, {} as Record<string, Match[]>);
};

const formatDateHeader = (dateKey: string, lang: Language): string => {
  const date = new Date(dateKey + 'T12:00:00');
  const locale = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';
  const dayName = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).toUpperCase();
  const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date).toUpperCase();
  return `${dayMonth} - ${dayName}`;
};

const MatchList: React.FC<MatchListProps> = ({ lang, groupId }) => {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const { matches, loading: matchesLoading, error: matchesError } = useMatches();
  const { predictions, loading: predictionsLoading, submitPrediction } = usePredictions(groupId || '');
  const t = TRANSLATIONS[lang];

  // Buscar userId atual
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

  const upcomingByDate = groupMatchesByDate(upcomingMatches);
  const finishedByDate = groupMatchesByDate(finishedMatches);

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
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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

      {/* Próximos jogos */}
      {upcomingMatches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">
              {lang === 'pt' ? 'Próximos Jogos' : lang === 'es' ? 'Próximos Partidos' : 'Upcoming Matches'}
            </h4>
            <span className="bg-blue-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{upcomingMatches.length}</span>
          </div>
          <div className="space-y-6">
            {Object.keys(upcomingByDate).sort().map(dateKey => (
              <div key={dateKey} className="space-y-3">
                <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 px-4 py-2 rounded-r-lg shadow-sm">
                  <h5 className="font-black text-blue-900 text-[11px] tracking-widest">{formatDateHeader(dateKey, lang)}</h5>
                </div>
                <div className="grid gap-4">
                  {upcomingByDate[dateKey].map(match => (
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
        </div>
      )}

      {/* Jogos encerrados */}
      {finishedMatches.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowFinished(!showFinished)}
            className="w-full flex items-center justify-between px-1 py-2 hover:bg-slate-50 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3">
              <h4 className="font-black text-slate-600 uppercase tracking-widest text-xs group-hover:text-slate-900 transition-colors">
                {lang === 'pt' ? 'Jogos Encerrados' : lang === 'es' ? 'Partidos Terminados' : 'Finished Matches'}
              </h4>
              <span className="bg-slate-300 text-slate-700 text-[9px] font-black px-2 py-0.5 rounded-full">{finishedMatches.length}</span>
            </div>
            <svg className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showFinished ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showFinished && (
            <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
              {Object.keys(finishedByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(dateKey => (
                <div key={dateKey} className="space-y-3">
                  <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-100 to-slate-50 border-l-4 border-slate-400 px-4 py-2 rounded-r-lg shadow-sm">
                    <h5 className="font-black text-slate-700 text-[11px] tracking-widest">{formatDateHeader(dateKey, lang)}</h5>
                  </div>
                  <div className="grid gap-4">
                    {finishedByDate[dateKey].map(match => (
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
