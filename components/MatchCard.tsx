import React, { useState, useEffect } from 'react';
import { Match, Language, Prediction } from '../types';
import { TRANSLATIONS } from '../constants';
import { supabase } from '../supabase';

interface MatchCardProps {
  match: Match;
  lang: Language;
  prediction?: Prediction;
  groupId: string | null;
  currentUserId: string;
  onClick: () => void;
}

type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED';

interface OtherPrediction {
  name: string;
  homeScore: number;
  awayScore: number;
  ptsFinal: number | null;
}

// Formata horário no timezone local do browser do usuário
const formatLocalTime = (date: Date): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(date);
};

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  lang,
  prediction,
  groupId,
  currentUserId,
  onClick,
}) => {
  const [showOthers, setShowOthers] = useState(false);
  const [others, setOthers] = useState<OtherPrediction[]>([]);
  const [loadingOthers, setLoadingOthers] = useState(false);

  const t = TRANSLATIONS[lang];
  const startTime = new Date(match.startTime);
  const now = new Date();

  // ── Status ────────────────────────────────────────────────────────────────
  const getMatchStatus = (): MatchStatus => {
    if (match.status) {
      const s = match.status.toUpperCase();
      if (s === 'FINISHED') return 'FINISHED';
      if (s === 'LIVE' || s === 'IN_PLAY' || s === 'PAUSED') return 'LIVE';
      if (['POSTPONED', 'SUSPENDED', 'CANCELLED'].includes(s)) return 'FINISHED';
    }
    if (now >= startTime) return 'LIVE';
    return 'SCHEDULED';
  };

  const status = getMatchStatus();

  // ── Visibilidade dos palpites ─────────────────────────────────────────────
  const predictionsVisible = status === 'LIVE' || status === 'FINISHED' || now >= startTime;

  // ── Deadline de palpites (10 min antes) ───────────────────────────────────
  const deadlinePassed = now >= new Date(startTime.getTime() - 10 * 60 * 1000);

  // ── Buscar palpites dos outros ────────────────────────────────────────────
  const fetchOtherPredictions = async () => {
    if (!groupId || !predictionsVisible) return;
    setLoadingOthers(true);
    try {
      const { data, error } = await supabase
        .from('predictions')
        .select(`
          home_score,
          away_score,
          pts_final,
          profiles!predictions_user_id_fkey(name, surname)
        `)
        .eq('match_id', match.id)
        .eq('group_id', groupId)
        .neq('user_id', currentUserId);

      if (error) { console.error('❌ Error fetching others:', error); return; }

      const mapped: OtherPrediction[] = (data || []).map((d: any) => ({
        name: `${d.profiles.name} ${d.profiles.surname?.[0] || ''}.`,
        homeScore: d.home_score,
        awayScore: d.away_score,
        ptsFinal: d.pts_final,
      }));
      setOthers(mapped);
    } catch (err) {
      console.error('❌ Unexpected error:', err);
    } finally {
      setLoadingOthers(false);
    }
  };

  useEffect(() => {
    if (showOthers) fetchOtherPredictions();
  }, [showOthers]);

  return (
    <div className={`relative w-full overflow-hidden rounded-[2.5rem] border transition-all duration-500 shadow-sm ${
      status === 'LIVE' ? 'ring-2 ring-red-500 ring-offset-2 bg-white' : 'border-slate-100'
    } ${status === 'FINISHED' ? 'bg-slate-50/50 opacity-75' : 'bg-white'}`}>

      {/* Color bar */}
      <div
        className="h-1.5 w-full opacity-80"
        style={{ background: `linear-gradient(to right, ${match.homeTeam.color}, ${match.awayTeam.color})` }}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{match.group}</span>
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">{match.venue}</span>
          </div>
          <div className="flex gap-2 items-center">
            {status === 'LIVE' && (
              <div className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                <span className="text-[10px] font-black uppercase tracking-widest">AO VIVO</span>
              </div>
            )}
            {status === 'FINISHED' && (
              <div className="bg-slate-800 text-white px-3 py-1 rounded-full">
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {lang === 'pt' ? 'ENCERRADO' : lang === 'es' ? 'TERMINADO' : 'FT'}
                </span>
              </div>
            )}
            {status === 'SCHEDULED' && (
              <div className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full">
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {formatLocalTime(startTime)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Score Area */}
        <div className="flex items-center justify-between gap-4 mb-6">
          {/* Home */}
          <div className="flex flex-col items-center flex-1">
            <div className="text-5xl mb-3 drop-shadow-md">{match.homeTeam.flag}</div>
            <span className="font-black text-[11px] text-center text-slate-800 uppercase tracking-tight">{match.homeTeam.name[lang]}</span>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center min-w-[120px]">
            {status !== 'SCHEDULED' ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-black text-slate-900">{match.actualHomeScore ?? 0}</span>
                  <span className="text-slate-200 font-bold text-2xl">-</span>
                  <span className="text-4xl font-black text-slate-900">{match.actualAwayScore ?? 0}</span>
                </div>
                {prediction && (
                  <div className="mt-2 flex items-center gap-1.5 bg-blue-50 px-2 py-0.5 rounded-lg">
                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">
                      {lang === 'pt' ? 'Palpite:' : lang === 'es' ? 'Pronóstico:' : 'Guess:'}
                    </span>
                    <span className="text-[10px] font-black text-blue-600">{prediction.homeScore}-{prediction.awayScore}</span>
                  </div>
                )}
                {status === 'FINISHED' && prediction?.ptsFinal !== undefined && (
                  <div className="mt-1">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full ${(prediction.ptsFinal ?? 0) > 0 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      +{prediction.ptsFinal ?? 0} PTS
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={onClick} disabled={deadlinePassed} className="group flex flex-col items-center gap-1">
                {prediction ? (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-black text-blue-600">{prediction.homeScore}</span>
                      <span className="text-slate-200 font-bold">-</span>
                      <span className="text-3xl font-black text-blue-600">{prediction.awayScore}</span>
                    </div>
                    {!deadlinePassed && (
                      <span className="text-[9px] font-bold text-slate-300 uppercase mt-1 group-hover:text-blue-500 transition-colors">
                        {lang === 'pt' ? 'EDITAR PLACAR' : lang === 'es' ? 'EDITAR' : 'EDIT'}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className={`px-6 py-3 bg-slate-50 border-2 border-dashed rounded-2xl text-xs font-black transition-all ${
                    deadlinePassed
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-slate-200 text-slate-400 group-hover:border-blue-300 group-hover:text-blue-500'
                  }`}>
                    {deadlinePassed
                      ? (lang === 'pt' ? 'FECHADO' : lang === 'es' ? 'CERRADO' : 'LOCKED')
                      : (lang === 'pt' ? 'PALPITAR' : lang === 'es' ? 'APOSTAR' : 'PREDICT')}
                  </div>
                )}
              </button>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center flex-1">
            <div className="text-5xl mb-3 drop-shadow-md">{match.awayTeam.flag}</div>
            <span className="font-black text-[11px] text-center text-slate-800 uppercase tracking-tight">{match.awayTeam.name[lang]}</span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
          {!predictionsVisible ? (
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">
              {lang === 'pt' ? 'Palpites fecham 10 min antes do jogo' : lang === 'es' ? 'Pronósticos cierran 10 min antes' : 'Predictions close 10 mins before kick-off'}
            </span>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="text-xs">🔒</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {lang === 'pt' ? 'FECHADO' : lang === 'es' ? 'CERRADO' : 'LOCKED'}
                </span>
              </div>
              <button
                onClick={() => setShowOthers(!showOthers)}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
              >
                <span>{showOthers
                  ? (lang === 'pt' ? 'Ocultar' : lang === 'es' ? 'Ocultar' : 'Hide')
                  : (lang === 'pt' ? 'Ver Palpites' : lang === 'es' ? 'Ver Apuestas' : 'See Predictions')}
                </span>
                <span className="text-xs">👁️</span>
              </button>
            </div>
          )}
        </div>

        {/* Outros palpites */}
        {showOthers && predictionsVisible && (
          <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
              {lang === 'pt' ? 'Palpites dos Participantes' : lang === 'es' ? 'Pronósticos de Participantes' : 'Other Players'}
            </h4>
            {loadingOthers ? (
              <p className="text-[10px] text-slate-400 italic">
                {lang === 'pt' ? 'Carregando...' : 'Loading...'}
              </p>
            ) : (
              <div className="space-y-2">
                {others.length > 0 ? others.map((o, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-slate-200 flex items-center justify-center text-[8px] font-black text-slate-500">
                        {o.name[0]}
                      </div>
                      <span className="text-[10px] font-bold text-slate-700">{o.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-900">{o.homeScore}-{o.awayScore}</span>
                      {status === 'FINISHED' && o.ptsFinal !== null && (
                        <span className="text-[9px] font-black text-blue-600">+{o.ptsFinal} pts</span>
                      )}
                    </div>
                  </div>
                )) : (
                  <p className="text-[10px] text-slate-400 italic">
                    {lang === 'pt' ? 'Nenhum palpite encontrado.' : lang === 'es' ? 'Sin pronósticos.' : 'No predictions found.'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
