import React, { useState, useEffect, useRef } from 'react';
import { Language, ScoringConfig } from '../types';
import { TRANSLATIONS } from '../constants';
import { supabase } from '../supabase';

interface RulesProps {
  lang: Language;
  scoringConfig: ScoringConfig;
  groupId?: string;
  currentUserId?: string;
}

const Rules: React.FC<RulesProps> = ({ lang, scoringConfig, groupId, currentUserId }) => {
  const t = TRANSLATIONS[lang];

  const [prizePool, setPrizePool] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Busca prize_pool e verifica se é admin
  useEffect(() => {
    if (!groupId || !currentUserId) return;

    const fetchGroupData = async () => {
      const { data } = await supabase
        .from('groups')
        .select('prize_pool, owner_user_id')
        .eq('id', groupId)
        .single();

      if (data) {
        setPrizePool(data.prize_pool ?? 0);
        setIsAdmin(data.owner_user_id === currentUserId);
      }
    };

    fetchGroupData();
  }, [groupId, currentUserId]);

  // Foca o input ao entrar em modo de edição
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleEditStart = () => {
    setInputValue(prizePool > 0 ? String(prizePool) : '');
    setEditing(true);
  };

  const handleSave = async () => {
    const newValue = parseFloat(inputValue.replace(',', '.'));
    if (isNaN(newValue) || newValue < 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('groups')
      .update({ prize_pool: newValue })
      .eq('id', groupId);

    if (!error) setPrizePool(newValue);
    setSaving(false);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setEditing(false);
  };

  const prize1 = Math.round(prizePool * 0.6);
  const prize2 = Math.round(prizePool * 0.25);
  const prize3 = Math.round(prizePool * 0.15);

  const scenarios = [
    {
      label:   lang === 'pt' ? 'Placar Exato' : lang === 'es' ? 'Marcador Exacto' : 'Exact Score',
      pts:     scoringConfig.exactScore,
      icon:    '🎯',
      desc:    lang === 'pt' ? 'Acerta o placar exato dos dois times.' : lang === 'es' ? 'Acierta el marcador exacto.' : 'Exact score of both teams.',
      example: lang === 'pt' ? 'Ex: Palpite 2×1 → Resultado 2×1' : lang === 'es' ? 'Ej: Pronóstico 2×1 → Resultado 2×1' : 'e.g. Guess 2×1 → Result 2×1',
    },
    {
      label:   lang === 'pt' ? 'Vencedor da Partida' : lang === 'es' ? 'Ganador del Partido' : 'Match Winner',
      pts:     scoringConfig.winner,
      icon:    '🏆',
      desc:    lang === 'pt' ? 'Acerta o vencedor, mas erra o placar.' : lang === 'es' ? 'Acierta el ganador, pero no el marcador.' : 'Correct winner, wrong score.',
      example: lang === 'pt' ? 'Ex: Palpite 3×0 → Resultado 1×0' : lang === 'es' ? 'Ej: Pronóstico 3×0 → Resultado 1×0' : 'e.g. Guess 3×0 → Result 1×0',
    },
    {
      label:   lang === 'pt' ? 'Empate Correto' : lang === 'es' ? 'Empate Correcto' : 'Correct Draw',
      pts:     scoringConfig.correctDraw,
      icon:    '🤝',
      desc:    lang === 'pt' ? 'Acerta que o jogo termina empatado, mas erra o placar.' : lang === 'es' ? 'Acierta el empate, pero no el marcador.' : 'Correct draw, wrong score.',
      example: lang === 'pt' ? 'Ex: Palpite 1×1 → Resultado 0×0' : lang === 'es' ? 'Ej: Pronóstico 1×1 → Resultado 0×0' : 'e.g. Guess 1×1 → Result 0×0',
    },
    {
      label:   lang === 'pt' ? 'Saldo de Gols' : lang === 'es' ? 'Diferencia de Goles' : 'Goal Difference',
      pts:     scoringConfig.goalDiff,
      icon:    '⚖️',
      desc:    lang === 'pt' ? 'Acerta a diferença de gols, mas não o placar.' : lang === 'es' ? 'Acierta la diferencia de goles, pero no el marcador.' : 'Correct goal difference, wrong score.',
      example: lang === 'pt' ? 'Ex: Palpite 3×1 (dif.2) → Resultado 2×0 (dif.2)' : lang === 'es' ? 'Ej: 3×1 (dif.2) → 2×0 (dif.2)' : 'e.g. 3×1 (diff 2) → 2×0 (diff 2)',
    },
    {
      label:   lang === 'pt' ? 'Gols de Um Time' : lang === 'es' ? 'Goles de Un Equipo' : 'One Team Score',
      pts:     scoringConfig.oneTeamScore,
      icon:    '⚽',
      desc:    lang === 'pt' ? 'Acerta os gols de apenas um dos times.' : lang === 'es' ? 'Acierta los goles de un equipo.' : 'Correct score for one team only.',
      example: lang === 'pt' ? 'Ex: Palpite 2×1 → Resultado 2×0' : lang === 'es' ? 'Ej: 2×1 → 2×0' : 'e.g. Guess 2×1 → Result 2×0',
    },
  ];

  const multipliers = [
    { phase: lang === 'pt' ? 'Fase de Grupos' : lang === 'es' ? 'Fase de Grupos' : 'Group Stage',        mult: scoringConfig.multGroup },
    { phase: 'Round of 32',                                                                                mult: scoringConfig.multR32 ?? 1.2 },
    { phase: lang === 'pt' ? 'Oitavas de Final' : lang === 'es' ? 'Octavos de Final' : 'Round of 16',    mult: scoringConfig.multR16 },
    { phase: lang === 'pt' ? 'Quartas de Final' : lang === 'es' ? 'Cuartos de Final' : 'Quarter-Finals',  mult: scoringConfig.multQF },
    { phase: lang === 'pt' ? 'Semifinal' : lang === 'es' ? 'Semifinal' : 'Semi-Final',                    mult: scoringConfig.multSF },
    { phase: lang === 'pt' ? 'Final' : 'Final',                                                            mult: scoringConfig.multFinal },
  ];

  const tiebreakers = [
    { label: lang === 'pt' ? 'Maior número de placares exatos' : lang === 'es' ? 'Mayor número de marcadores exactos' : 'Most exact scores', icon: '🎯' },
    { label: lang === 'pt' ? 'Maior número de acertos de vencedor' : lang === 'es' ? 'Mayor número de ganadores correctos' : 'Most correct winners', icon: '🏆' },
  ];

  return (
    <div className="space-y-6 pb-24">

      {/* ── PREMIAÇÃO ── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
            {lang === 'pt' ? 'Premiação' : lang === 'es' ? 'Premios' : 'Prize Pool'}
          </h3>
          {isAdmin && !editing && (
            <button
              onClick={handleEditStart}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors"
            >
              ✏️ {lang === 'pt' ? 'Editar' : lang === 'es' ? 'Editar' : 'Edit'}
            </button>
          )}
        </div>

        {/* Pote Total */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl px-6 py-4">
            <span className="text-2xl">💰</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-yellow-700 uppercase tracking-widest">
                {lang === 'pt' ? 'Pote Total' : lang === 'es' ? 'Bote Total' : 'Total Prize'}
              </span>
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="number"
                    min="0"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    className="w-24 text-2xl font-black text-yellow-800 bg-transparent border-b-2 border-yellow-500 outline-none text-center"
                    placeholder="0"
                  />
                  <span className="text-2xl font-black text-yellow-800">€</span>
                </div>
              ) : (
                <span
                  onClick={isAdmin ? handleEditStart : undefined}
                  className={`text-2xl font-black text-yellow-800 ${isAdmin ? 'cursor-pointer hover:text-yellow-600' : ''}`}
                >
                  {prizePool > 0 ? `${prizePool}€` : (isAdmin ? (lang === 'pt' ? 'Definir valor' : lang === 'es' ? 'Definir valor' : 'Set amount') : '—')}
                </span>
              )}
            </div>
            {saving && <span className="text-xs text-yellow-500 animate-pulse">💾</span>}
          </div>
        </div>

        {/* Breakdown 1º / 2º / 3º */}
        <div className="grid gap-3">
          {/* 1º Colocado */}
          <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-100 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-xl">🥇</span>
              <div>
                <p className="text-xs font-black text-yellow-800">
                  {lang === 'pt' ? '1º Colocado' : lang === 'es' ? '1er Lugar' : '1st Place'}
                </p>
                <p className="text-[10px] text-yellow-600 font-medium">
                  {lang === 'pt' ? 'do pote total' : lang === 'es' ? 'del bote total' : 'of total prize'}
                </p>
              </div>
            </div>
            <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-xl font-black text-sm">
              60% {prizePool > 0 && `= ${prize1}€`}
            </div>
          </div>

          {/* 2º Colocado */}
          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-xl">🥈</span>
              <div>
                <p className="text-xs font-black text-slate-700">
                  {lang === 'pt' ? '2º Colocado' : lang === 'es' ? '2do Lugar' : '2nd Place'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {lang === 'pt' ? 'do pote total' : lang === 'es' ? 'del bote total' : 'of total prize'}
                </p>
              </div>
            </div>
            <div className="bg-slate-400 text-white px-4 py-2 rounded-xl font-black text-sm">
              25% {prizePool > 0 && `= ${prize2}€`}
            </div>
          </div>

          {/* 3º Colocado */}
          <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-100 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-xl">🥉</span>
              <div>
                <p className="text-xs font-black text-orange-800">
                  {lang === 'pt' ? '3º Colocado' : lang === 'es' ? '3er Lugar' : '3rd Place'}
                </p>
                <p className="text-[10px] text-orange-400 font-medium">
                  {lang === 'pt' ? 'do pote total' : lang === 'es' ? 'del bote total' : 'of total prize'}
                </p>
              </div>
            </div>
            <div className="bg-orange-400 text-white px-4 py-2 rounded-xl font-black text-sm">
              15% {prizePool > 0 && `= ${prize3}€`}
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 font-medium mt-4 text-center">
          💰 {lang === 'pt' ? 'O pote é definido pelo organizador do grupo antes do início do torneio.' : lang === 'es' ? 'El bote es definido por el organizador del grupo.' : 'The prize pool is set by the group organizer.'}
        </p>
      </div>

      {/* ── PONTUAÇÃO ── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          {lang === 'pt' ? 'Sistema de Pontuação' : lang === 'es' ? 'Sistema de Puntuación' : 'Scoring System'}
        </h3>
        <div className="grid gap-3">
          {scenarios.map((s, idx) => (
            <div key={idx} className="flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-2xl group transition-all hover:bg-white hover:border-blue-200 hover:shadow-md">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <span className="text-xl group-hover:scale-110 transition-transform">{s.icon}</span>
                  <span className="text-xs font-black text-slate-800">{s.label}</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1 rounded-full">
                  <span className="text-sm font-black">{s.pts}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest ml-1">pts</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium pl-8">{s.desc}</p>
              <p className="text-[10px] text-blue-400 font-bold pl-8 mt-1 italic">{s.example}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-[10px] text-blue-700 font-bold">
            {lang === 'pt'
              ? '⚡ Pontuação acumulativa — critérios independentes somam-se entre si.'
              : lang === 'es'
              ? '⚡ Puntuación acumulativa — los criterios se suman.'
              : '⚡ Cumulative scoring — criteria are independent and add up.'}
          </p>
        </div>
      </div>

      {/* ── MULTIPLICADORES ── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          {lang === 'pt' ? 'Multiplicador por Fase' : lang === 'es' ? 'Multiplicador por Fase' : 'Phase Multiplier'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {multipliers.map((m, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl flex justify-between items-center border ${
                m.mult >= 2 ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-100'
              }`}
            >
              <span className="text-xs font-bold text-slate-700">{m.phase}</span>
              <span className={`text-sm font-black ${m.mult >= 2 ? 'text-yellow-600' : 'text-slate-500'}`}>
                {m.mult}×
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 font-medium mt-3">
          {lang === 'pt'
            ? 'Ex: Placar exato na Final → 10 × 2.0 = 20 pts'
            : lang === 'es'
            ? 'Ej: Marcador exacto en Final → 10 × 2.0 = 20 pts'
            : 'e.g. Exact score in Final → 10 × 2.0 = 20 pts'}
        </p>
      </div>

      {/* ── PRAZO ── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-600"></span>
          {lang === 'pt' ? 'Prazo para Palpites' : lang === 'es' ? 'Plazo para Pronósticos' : 'Prediction Deadline'}
        </h3>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-2">
          <p className="text-xs text-red-800 font-bold">
            {lang === 'pt' ? '🔒 Palpites fecham 10 minutos antes do início da partida.' : lang === 'es' ? '🔒 Los pronósticos cierran 10 minutos antes del partido.' : '🔒 Predictions close 10 minutes before kick-off.'}
          </p>
          <p className="text-xs text-red-700 font-medium">
            {lang === 'pt' ? '✏️ Pode editar o palpite até o fechamento.' : lang === 'es' ? '✏️ Puede editar hasta el cierre.' : '✏️ You can edit until closing time.'}
          </p>
          <p className="text-xs text-red-700 font-medium">
            {lang === 'pt' ? '📊 Considera tempo regulamentar + prorrogação. Pênaltis NÃO contam.' : lang === 'es' ? '📊 Tiempo regular + prórroga. Penales NO cuentan.' : '📊 Regular time + extra time. Penalties do NOT count.'}
          </p>
          <p className="text-xs text-red-700 font-medium">
            {lang === 'pt' ? '👁️ Palpites ficam ocultos para os outros participantes até o jogo começar.' : lang === 'es' ? '👁️ Pronósticos ocultos hasta el inicio.' : '👁️ Predictions hidden until match starts.'}
          </p>
        </div>
      </div>

      {/* ── DESEMPATE ── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-600"></span>
          {lang === 'pt' ? 'Critérios de Desempate' : lang === 'es' ? 'Criterios de Desempate' : 'Tiebreakers'}
        </h3>
        <div className="space-y-2">
          {tiebreakers.map((tb, idx) => (
            <div key={idx} className="text-xs text-slate-600 font-bold bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
              <span className="w-5 h-5 bg-white rounded-md flex items-center justify-center text-[10px] shadow-sm text-slate-400 border border-slate-100 flex-shrink-0">
                {idx + 1}
              </span>
              <span className="mr-1">{tb.icon}</span>
              {tb.label}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 font-medium mt-3">
          {lang === 'pt'
            ? 'Em caso de empate em todos os critérios, a posição é decidida por sorteio.'
            : lang === 'es'
            ? 'En caso de empate en todos los criterios, la posición se decide por sorteo.'
            : 'If all criteria are tied, position is decided by draw.'}
        </p>
      </div>

      <div className="text-center px-6">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">United 2026 • FIFA World Cup Predictor</p>
      </div>
    </div>
  );
};

export default Rules;
