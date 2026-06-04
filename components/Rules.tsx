import React from 'react';
import { Language, ScoringConfig } from '../types';
import { TRANSLATIONS } from '../constants';

interface RulesProps {
  lang: Language;
  scoringConfig: ScoringConfig;
}

const Rules: React.FC<RulesProps> = ({ lang, scoringConfig }) => {
  const t = TRANSLATIONS[lang];

  const scenarios = [
    {
      label:  lang === 'pt' ? 'Placar Exato' : lang === 'es' ? 'Marcador Exacto' : 'Exact Score',
      pts:    scoringConfig.exactScore,
      icon:   '🎯',
      desc:   lang === 'pt' ? 'Acerta o placar exato dos dois times.' : lang === 'es' ? 'Acierta el marcador exacto.' : 'Exact score of both teams.',
      example: lang === 'pt' ? 'Ex: Palpite 2×1 → Resultado 2×1' : lang === 'es' ? 'Ej: Pronóstico 2×1 → Resultado 2×1' : 'e.g. Guess 2×1 → Result 2×1',
    },
    {
      label:  lang === 'pt' ? 'Vencedor da Partida' : lang === 'es' ? 'Ganador del Partido' : 'Match Winner',
      pts:    scoringConfig.winner,
      icon:   '🏆',
      desc:   lang === 'pt' ? 'Acerta o vencedor, mas erra o placar.' : lang === 'es' ? 'Acierta el ganador, pero no el marcador.' : 'Correct winner, wrong score.',
      example: lang === 'pt' ? 'Ex: Palpite 3×0 → Resultado 1×0' : lang === 'es' ? 'Ej: Pronóstico 3×0 → Resultado 1×0' : 'e.g. Guess 3×0 → Result 1×0',
    },
    {
      label:  lang === 'pt' ? 'Empate Correto' : lang === 'es' ? 'Empate Correcto' : 'Correct Draw',
      pts:    scoringConfig.correctDraw,
      icon:   '🤝',
      desc:   lang === 'pt' ? 'Acerta que o jogo termina empatado, mas erra o placar.' : lang === 'es' ? 'Acierta el empate, pero no el marcador.' : 'Correct draw, wrong score.',
      example: lang === 'pt' ? 'Ex: Palpite 1×1 → Resultado 0×0' : lang === 'es' ? 'Ej: Pronóstico 1×1 → Resultado 0×0' : 'e.g. Guess 1×1 → Result 0×0',
    },
    {
      label:  lang === 'pt' ? 'Saldo de Gols' : lang === 'es' ? 'Diferencia de Goles' : 'Goal Difference',
      pts:    scoringConfig.goalDiff,
      icon:   '⚖️',
      desc:   lang === 'pt' ? 'Acerta a diferença de gols, mas não o placar.' : lang === 'es' ? 'Acierta la diferencia de goles, pero no el marcador.' : 'Correct goal difference, wrong score.',
      example: lang === 'pt' ? 'Ex: Palpite 3×1 (dif.2) → Resultado 2×0 (dif.2)' : lang === 'es' ? 'Ej: 3×1 (dif.2) → 2×0 (dif.2)' : 'e.g. 3×1 (diff 2) → 2×0 (diff 2)',
    },
    {
      label:  lang === 'pt' ? 'Gols de Um Time' : lang === 'es' ? 'Goles de Un Equipo' : 'One Team Score',
      pts:    scoringConfig.oneTeamScore,
      icon:   '⚽',
      desc:   lang === 'pt' ? 'Acerta os gols de apenas um dos times.' : lang === 'es' ? 'Acierta los goles de un equipo.' : 'Correct score for one team only.',
      example: lang === 'pt' ? 'Ex: Palpite 2×1 → Resultado 2×0' : lang === 'es' ? 'Ej: 2×1 → 2×0' : 'e.g. Guess 2×1 → Result 2×0',
    },
  ];

  const multipliers = [
    { phase: lang === 'pt' ? 'Fase de Grupos' : lang === 'es' ? 'Fase de Grupos' : 'Group Stage', mult: scoringConfig.multGroup },
    { phase: lang === 'pt' ? 'Round of 32' : 'Round of 32', mult: scoringConfig.multR32 ?? 1.2 },
    { phase: lang === 'pt' ? 'Oitavas de Final' : lang === 'es' ? 'Octavos de Final' : 'Round of 16', mult: scoringConfig.multR16 },
    { phase: lang === 'pt' ? 'Quartas de Final' : lang === 'es' ? 'Cuartos de Final' : 'Quarter-Finals', mult: scoringConfig.multQF },
    { phase: lang === 'pt' ? 'Semifinal' : 'Semi-Final', mult: scoringConfig.multSF },
    { phase: lang === 'pt' ? 'Final' : 'Final', mult: scoringConfig.multFinal },
  ];

  const tiebreakers = [
    lang === 'pt' ? 'Maior número de placares exatos' : lang === 'es' ? 'Mayor número de marcadores exactos' : 'Most exact scores',
    lang === 'pt' ? 'Maior número de acertos de vencedor' : lang === 'es' ? 'Mayor número de ganadores correctos' : 'Most correct winners',
    lang === 'pt' ? 'Menor tempo médio de envio dos palpites' : lang === 'es' ? 'Menor tiempo promedio de envío' : 'Lowest average submission time',
    lang === 'pt' ? 'Sorteio' : lang === 'es' ? 'Sorteo' : 'Draw',
  ];

  return (
    <div className="space-y-6 pb-24">

      {/* Pontuação */}
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
            {lang === 'pt' ? '⚡ Pontuação acumulativa — critérios independentes somam-se entre si.' : lang === 'es' ? '⚡ Puntuación acumulativa — los criterios se suman.' : '⚡ Cumulative scoring — criteria are independent and add up.'}
          </p>
        </div>
      </div>

      {/* Multiplicadores */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          {lang === 'pt' ? 'Multiplicador por Fase' : lang === 'es' ? 'Multiplicador por Fase' : 'Phase Multiplier'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {multipliers.map((m, idx) => (
            <div key={idx} className={`p-3 rounded-xl flex justify-between items-center border ${m.mult >= 2 ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-100'}`}>
              <span className="text-xs font-bold text-slate-700">{m.phase}</span>
              <span className={`text-sm font-black ${m.mult >= 2 ? 'text-yellow-600' : 'text-slate-500'}`}>{m.mult}×</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 font-medium mt-3">
          {lang === 'pt' ? 'Ex: Placar exato na Final → 10 × 2.0 = 20 pts' : lang === 'es' ? 'Ej: Marcador exacto en Final → 10 × 2.0 = 20 pts' : 'e.g. Exact score in Final → 10 × 2.0 = 20 pts'}
        </p>
      </div>

      {/* Prazo */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-600"></span>
          {lang === 'pt' ? 'Prazo para Palpites' : lang === 'es' ? 'Plazo para Pronósticos' : 'Prediction Deadline'}
        </h3>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-2">
          <p className="text-xs text-red-800 font-bold">
            {lang === 'pt' ? '🔒 Palpites fecham no horário de início da partida.' : lang === 'es' ? '🔒 Los pronósticos cierran al inicio del partido.' : '🔒 Predictions close at match kick-off time.'}
          </p>
          <p className="text-xs text-red-700 font-medium">
            {lang === 'pt' ? '✏️ Pode editar o palpite até o fechamento.' : lang === 'es' ? '✏️ Puede editar hasta el cierre.' : '✏️ You can edit until closing time.'}
          </p>
          <p className="text-xs text-red-700 font-medium">
            {lang === 'pt' ? '📊 Considera tempo regulamentar + prorrogação. Pênaltis NÃO contam.' : lang === 'es' ? '📊 Tiempo regular + prórroga. Penales NO cuentan.' : '📊 Regular time + extra time. Penalties do NOT count.'}
          </p>
          <p className="text-xs text-red-700 font-medium">
            {lang === 'pt' ? '👁️ Palpites ficam ocultos até o jogo começar.' : lang === 'es' ? '👁️ Pronósticos ocultos hasta el inicio.' : '👁️ Predictions hidden until match starts.'}
          </p>
        </div>
      </div>

      {/* Desempate */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-600"></span>
          {lang === 'pt' ? 'Critérios de Desempate' : lang === 'es' ? 'Criterios de Desempate' : 'Tiebreakers'}
        </h3>
        <div className="space-y-2">
          {tiebreakers.map((tb, idx) => (
            <div key={idx} className="text-xs text-slate-600 font-bold bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
              <span className="w-5 h-5 bg-white rounded-md flex items-center justify-center text-[10px] shadow-sm text-slate-400 border border-slate-100 flex-shrink-0">{idx + 1}</span>
              {tb}
            </div>
          ))}
        </div>
      </div>

      <div className="text-center px-6">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">United 2026 • FIFA World Cup Predictor</p>
      </div>
    </div>
  );
};

export default Rules;
