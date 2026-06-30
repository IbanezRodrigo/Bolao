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

// ── Mapeamento external_id (football-data.org) → FIFA Match ID ───────────────
// Fonte: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
// URL padrão: https://www.fifa.com/en/match-centre/match/17/285023/289273/{FIFA_ID}
const FIFA_ID_MAP: Record<string, string> = {
  // GROUP A
  '537327': '400021443', // MEX x RSA
  '537328': '400021441', // KOR x CZE
  '537329': '400021440', // CZE x RSA
  '537330': '400021442', // MEX x KOR
  '537331': '400021445', // RSA x KOR
  '537332': '400021444', // CZE x MEX
  // GROUP B
  '537333': '400021449', // CAN x BIH
  '537334': '400021447', // QAT x SUI
  '537335': '400021446', // SUI x BIH
  '537336': '400021450', // CAN x QAT
  '537337': '400021451', // SUI x CAN
  '537338': '400021448', // BIH x QAT
  // GROUP C
  '537339': '400021456', // BRA x MAR
  '537340': '400021453', // HAI x SCO
  '537341': '400021457', // BRA x HAI
  '537342': '400021454', // SCO x MAR
  '537343': '400021455', // SCO x BRA
  '537344': '400021452', // MAR x HAI
  // GROUP D
  '537345': '400021458', // USA x PAR
  '537346': '400021463', // AUS x TUR
  '537347': '400021460', // TUR x PAR
  '537348': '400021462', // USA x AUS
  '537349': '400021459', // TUR x USA
  '537350': '400021461', // PAR x AUS
  // GROUP E
  '537351': '400021464', // GER x CUW
  '537352': '400021467', // CIV x ECU
  '537353': '400021469', // GER x CIV
  '537354': '400021465', // ECU x CUW
  '537355': '400021466', // ECU x GER
  '537356': '400021468', // CUW x CIV
  // GROUP F
  '537357': '400021470', // NED x JPN
  '537358': '400021474', // SWE x TUN
  '537359': '400021472', // NED x SWE
  '537360': '400021475', // TUN x JPN
  '537361': '400021473', // TUN x NED
  '537362': '400021471', // JPN x SWE
  // GROUP G
  '537363': '400021478', // BEL x EGY
  '537364': '400021476', // IRN x NZL
  '537365': '400021477', // BEL x IRN
  '537366': '400021480', // NZL x EGY
  '537367': '400021481', // NZL x BEL
  '537368': '400021479', // EGY x IRN
  // GROUP H
  '537369': '400021482', // ESP x CPV
  '537370': '400021486', // KSA x URY
  '537371': '400021483', // ESP x KSA
  '537372': '400021487', // URY x CPV
  '537373': '400021484', // URY x ESP
  '537374': '400021485', // CPV x KSA
  // GROUP I
  '537391': '400021490', // FRA x SEN
  '537392': '400021488', // IRQ x NOR
  '537393': '400021491', // NOR x SEN
  '537394': '400021492', // FRA x IRQ
  '537395': '400021489', // NOR x FRA
  '537396': '400021493', // SEN x IRQ
  // GROUP J
  '537397': '400021496', // ARG x ALG
  '537398': '400021498', // AUT x JOR
  '537399': '400021494', // ARG x AUT
  '537400': '400021499', // JOR x ALG
  '537401': '400021495', // JOR x ARG
  '537402': '400021497', // ALG x AUT
  // GROUP K
  '537403': '400021502', // POR x COD
  '537404': '400021504', // UZB x COL
  '537405': '400021503', // POR x UZB
  '537406': '400021501', // COL x COD
  '537407': '400021505', // COL x POR
  '537408': '400021500', // COD x UZB
  // GROUP L
  '537409': '400021507', // ENG x CRO
  '537410': '400021510', // GHA x PAN
  '537411': '400021506', // ENG x GHA
  '537412': '400021511', // PAN x CRO
  '537413': '400021508', // PAN x ENG
  '537414': '400021509', // CRO x GHA
  // ROUND OF 32 — validado manualmente jogo a jogo em 30/06/2026
  '537415': '400021522', // GER x PAR
  '537416': '400021523', // FRA x SWE
  '537417': '400021513', // RSA x CAN
  '537418': '400021518', // NED x MAR
  '537419': '400021526', // POR x CRO
  '537420': '400021519', // ESP x AUT
  '537421': '400021524', // USA x BIH
  '537422': '400021525', // BEL x SEN
  '537423': '400021516', // BRA x JPN
  '537424': '400021514', // CIV x NOR
  '537425': '400021520', // MEX x ECU
  '537426': '400021512', // ENG x COD
  '537427': '400021521', // ARG x CPV
  '537428': '400021515', // AUS x EGY
  '537429': '400021527', // SUI x ALG
  '537430': '400021517', // COL x GHA
  // ROUND OF 16
  '537375': '400021533', // R16 Jul 4
  '537376': '400021530', // R16 Jul 4
  '537377': '400021532', // R16 Jul 5
  '537378': '400021531', // R16 Jul 6
  '537379': '400021529', // R16 Jul 6
  '537380': '400021534', // R16 Jul 7
  '537381': '400021528', // R16 Jul 7
  '537382': '400021535', // R16 Jul 7
  // QUARTER FINALS
  '537383': '400021536', // QF Jul 9
  '537384': '400021538', // QF Jul 10
  '537385': '400021539', // QF Jul 11
  '537386': '400021537', // QF Jul 12
  // SEMI FINALS
  '537387': '400021541', // SF Jul 14
  '537388': '400021540', // SF Jul 15
  '537389': '400021542', // 3rd place Jul 18
  // FINAL
  '537390': '400021543', // Final Jul 19
};

const getFifaUrl = (externalId: string | undefined): string | null => {
  if (!externalId) return null;
  const fifaId = FIFA_ID_MAP[externalId];
  if (!fifaId) return null;
  // Fase de grupos usa o segmento 289273; a partir do R32 (mata-mata) a FIFA usa 289287
  const stageSegment = Number(fifaId) >= 400021512 ? '289287' : '289273';
  return `https://www.fifa.com/en/match-centre/match/17/285023/${stageSegment}/${fifaId}`;
};

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

  // ── Link FIFA ─────────────────────────────────────────────────────────────
  const fifaUrl = getFifaUrl(match.externalId);

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
        name: `${d.profiles.name} ${d.profiles.surname || ''}`.trim(),
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
        {/* ── Header: [grupo/estádio] [status/hora] ── */}
        <div className="flex justify-between items-start mb-3">

          {/* Esquerda: grupo */}
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{match.group}</span>
          </div>

          {/* Direita: status (hora / AO VIVO / ENCERRADO) */}
          <div className="flex gap-2 items-center flex-shrink-0 ml-2">
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
                  {new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(startTime)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Botão DETALHES DO JOGO — linha própria, full width ── */}
        {fifaUrl && (
          <a
            href={fifaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 mb-4 rounded-xl border border-slate-200 hover:border-[#326295] hover:bg-[#326295] group transition-all duration-200"
          >
            <span
              className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 group-hover:text-white transition-colors"
              style={{ fontFamily: "'Anton', 'Impact', 'Arial Black', sans-serif" }}
            >
              {lang === 'pt' ? 'DETALHES DO JOGO' : lang === 'es' ? 'DETALLES DEL PARTIDO' : 'MATCH DETAILS'}
            </span>
            <svg
              width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className="text-slate-300 group-hover:text-white transition-colors flex-shrink-0"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        )}

        {/* Score Area */}
        <div className="flex items-center justify-between gap-4 mb-2">
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

        {/* Estádio centralizado */}
        {match.venue && (
          <div className="text-center mb-4">
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">{match.venue}</span>
          </div>
        )}

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
                {others.length > 0 ? (status === 'FINISHED' ? [...others].sort((a, b) => (b.ptsFinal ?? 0) - (a.ptsFinal ?? 0)) : others).map((o, idx) => (
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
