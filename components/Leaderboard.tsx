import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { supabase } from '../supabase';
import GroupTable from './GroupTable';
import KnockoutBracket from './KnockoutBracket';

interface LeaderboardProps {
  lang: Language;
  groupId: string | null;
}

interface LeaderboardEntry {
  user_id: string;
  name: string;
  surname: string;
  photo_url: string | null;
  total_points: number;
  exact_count: number;
  winner_count: number;
  total_predictions: number;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

// Trend direction relative to the previous ranking snapshot: 1 = up, -1 = down, 0 = same/new.
type Trend = 1 | -1 | 0;

const positionsStorageKey = (groupId: string) => `ranking_positions_${groupId}`;

// Arrowhead-only indicator (no stem). Up = green, down = red, same = grey dash.
const TrendIndicator: React.FC<{ trend: Trend }> = ({ trend }) => {
  if (trend === 1) {
    return (
      <svg className="w-3 h-3 text-green-500" viewBox="0 0 12 12" fill="currentColor" aria-label="up">
        <path d="M6 2 11 9 1 9 Z" />
      </svg>
    );
  }
  if (trend === -1) {
    return (
      <svg className="w-3 h-3 text-red-500" viewBox="0 0 12 12" fill="currentColor" aria-label="down">
        <path d="M6 10 1 3 11 3 Z" />
      </svg>
    );
  }
  return <span className="block w-2.5 h-0.5 rounded-full bg-slate-300" aria-label="same" />;
};

const Leaderboard: React.FC<LeaderboardProps> = ({ lang, groupId }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [trends, setTrends] = useState<Record<string, Trend>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'ranking' | 'table' | 'knockout'>('ranking');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const t = TRANSLATIONS[lang];

  const fetchLeaderboard = useCallback(async (silent = false) => {
    if (!groupId) return;
    try {
      if (!silent) setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('group_id', groupId)
        .order('total_points', { ascending: false });

      if (fetchError) throw fetchError;

      const rows = (data || []) as LeaderboardEntry[];

      // Compute trends purely on the client by comparing the new positions
      // against the previous snapshot persisted in localStorage.
      try {
        const key = positionsStorageKey(groupId);
        const raw = localStorage.getItem(key);
        const prev: Record<string, number> = raw ? JSON.parse(raw) : {};

        const current: Record<string, number> = {};
        const nextTrends: Record<string, Trend> = {};
        rows.forEach((entry, index) => {
          const pos = index + 1;
          current[entry.user_id] = pos;
          const prevPos = prev[entry.user_id];
          if (prevPos === undefined) {
            nextTrends[entry.user_id] = 0; // newcomer → neutral
          } else if (pos < prevPos) {
            nextTrends[entry.user_id] = 1; // smaller position number → moved up
          } else if (pos > prevPos) {
            nextTrends[entry.user_id] = -1; // moved down
          } else {
            nextTrends[entry.user_id] = 0; // unchanged
          }
        });

        setTrends(nextTrends);
        localStorage.setItem(key, JSON.stringify(current));
      } catch {
        // localStorage unavailable / parse error → just skip trend indicators
        setTrends({});
      }

      setEntries(rows);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar ranking');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) { setLoading(false); return; }

    fetchLeaderboard(false); // primeira carga com spinner

    intervalRef.current = setInterval(() => fetchLeaderboard(true), REFRESH_INTERVAL_MS); // refresh silencioso

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [groupId, fetchLeaderboard]);

  const medalEmoji = (pos: number) => {
    if (pos === 1) return '🥇';
    if (pos === 2) return '🥈';
    if (pos === 3) return '🥉';
    return pos.toString();
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">{t.ranking}</h3>
          {activeView === 'ranking' && (
            <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">
              {entries.length} {entries.length === 1 ? 'membro' : 'membros'}
            </span>
          )}
        </div>
        {/* Pill toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveView('ranking')}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
              activeView === 'ranking' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
            }`}
          >
            {t.ranking}
          </button>
          <button
            onClick={() => setActiveView('table')}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
              activeView === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
            }`}
          >
            {lang === 'pt' ? 'Tabela' : lang === 'es' ? 'Tabla' : 'Table'}
          </button>
          <button
            onClick={() => setActiveView('knockout')}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
              activeView === 'knockout' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
            }`}
          >
            {lang === 'pt' ? 'Mata-mata' : lang === 'es' ? 'Mata-mata' : 'Knockout'}
          </button>
        </div>
      </div>

      {/* Table view */}
      {activeView === 'table' && (
        <div className="p-4">
          <GroupTable lang={lang} />
        </div>
      )}

      {/* Knockout view */}
      {activeView === 'knockout' && (
        <div className="p-4">
          <KnockoutBracket lang={lang} />
        </div>
      )}

      {/* Loading (primeira carga) */}
      {activeView === 'ranking' && loading && (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Error */}
      {activeView === 'ranking' && error && (
        <div className="p-6 text-center text-red-500 text-sm font-bold">{error}</div>
      )}

      {/* Empty */}
      {activeView === 'ranking' && !loading && !error && entries.length === 0 && (
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
            {lang === 'pt' ? 'Nenhum membro neste grupo ainda.' : lang === 'es' ? 'Sin miembros en este grupo.' : 'No members in this group yet.'}
          </p>
        </div>
      )}

      {/* Column headers */}
      {activeView === 'ranking' && !loading && !error && entries.length > 0 && (
        <div>
          <div className="flex items-center px-4 py-2 border-b border-slate-100">
            <span className="w-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pos</span>
            <span className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
              {lang === 'pt' ? 'Jogador' : lang === 'es' ? 'Jugador' : 'Player'}
            </span>
            <span className="w-5 flex-shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-10">
              {lang === 'pt' ? 'Exatos' : lang === 'es' ? 'Exactos' : 'Exact'}
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-14 ml-2">
              Pts
            </span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-50">
            {entries.map((entry, index) => {
              const pos = index + 1;
              const initials = `${entry.name?.[0] || ''}${entry.surname?.[0] || ''}`.toUpperCase();
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center px-4 py-3 transition-colors hover:bg-slate-50/50 ${pos <= 3 ? 'bg-yellow-50/20' : ''}`}
                >
                  {/* Posição */}
                  <div className="w-8 flex-shrink-0">
                    <span className="text-lg">{medalEmoji(pos)}</span>
                  </div>

                  {/* Avatar + Nome */}
                  <div className="flex items-center gap-2 flex-1 min-w-0 ml-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 font-black text-xs overflow-hidden shadow-sm flex-shrink-0">
                      {entry.photo_url ? (
                        <img src={entry.photo_url} alt={entry.name} className="w-full h-full object-cover" />
                      ) : initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{entry.name} {entry.surname}</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {entry.total_predictions} {lang === 'pt' ? 'palpites' : lang === 'es' ? 'pronósticos' : 'predictions'}
                      </p>
                    </div>
                  </div>

                  {/* Tendência */}
                  <div className="w-5 flex-shrink-0 flex items-center justify-center">
                    <TrendIndicator trend={trends[entry.user_id] ?? 0} />
                  </div>

                  {/* Exatos */}
                  <div className="w-10 flex-shrink-0 text-right">
                    <span className="text-xs font-black text-slate-500">{entry.exact_count}</span>
                  </div>

                  {/* Pontos */}
                  <div className="w-14 flex-shrink-0 text-right ml-2">
                    <span className={`text-lg font-black ${pos === 1 ? 'text-yellow-600' : pos === 2 ? 'text-slate-500' : pos === 3 ? 'text-orange-500' : 'text-slate-800'}`}>
                      {Number(entry.total_points).toFixed(1)}
                    </span>
                    <span className="text-[9px] font-black text-slate-300 ml-0.5">pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
