import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { supabase } from '../supabase';

interface GroupDashboardProps {
  lang: Language;
  groupId: string;
  currentUserId: string;
  onNavigateToMatches: () => void;
  onBack: () => void;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  exact_scores: number;
}

interface GroupInfo {
  id: string;
  name: string;
  code: string;
  description: string | null;
  photo_url: string | null;
}

const GroupDashboard: React.FC<GroupDashboardProps> = ({ 
  lang, 
  groupId, 
  currentUserId,
  onNavigateToMatches,
  onBack 
}) => {
  // DEFENSIVE: Log component mounting
  console.log('🎯 GroupDashboard MOUNTED');
  console.log('  - Group ID:', groupId);
  console.log('  - Current User ID:', currentUserId);
  console.log('  - Language:', lang);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const t = TRANSLATIONS[lang];

  // DEFENSIVE: Check for missing groupId
  if (!groupId) {
    console.error('❌ GroupDashboard: No groupId provided!');
    return (
      <div className="space-y-4 pb-20">
        <div className="flex justify-center items-center py-12">
          <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-8 text-center">
            <p className="text-red-600 font-bold text-lg">⚠️ Error: No Group ID</p>
            <p className="text-red-500 text-sm mt-2">Cannot load dashboard without a group ID.</p>
            <button 
              onClick={onBack}
              className="mt-4 bg-red-500 text-white px-6 py-2 rounded-xl font-bold"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchGroupData();
  }, [groupId]);

  const fetchGroupData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch group info
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, name, code, description, photo_url')
        .eq('id', groupId)
        .single();

      if (groupError) {
        console.error('❌ Error fetching group:', groupError);
        setError('Failed to load group information');
        return;
      }

      setGroupInfo(groupData);

      // Fetch leaderboard from view
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('group_id', groupId)
        .order('total_points', { ascending: false });

      if (leaderboardError) {
        console.error('❌ Error fetching leaderboard:', leaderboardError);
        setError('Failed to load leaderboard');
        return;
      }

      setLeaderboard(leaderboardData || []);
      console.log('✅ Loaded group dashboard:', {
        group: groupData.name,
        members: leaderboardData?.length || 0
      });

    } catch (err: any) {
      console.error('❌ Unexpected error loading group dashboard:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!groupInfo) return;
    
    try {
      await navigator.clipboard.writeText(groupInfo.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  if (loading) {
    console.log('⏳ GroupDashboard: Loading state active');
    return (
      <div className="space-y-4 pb-20">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-bold text-sm">
            {lang === 'pt' ? 'Voltar' : lang === 'es' ? 'Volver' : 'Back'}
          </span>
        </button>
        
        <div className="flex flex-col justify-center items-center py-20">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <div className="text-slate-700 font-bold text-lg">
            {lang === 'pt' ? '🔄 Carregando Dashboard...' : lang === 'es' ? '🔄 Cargando Dashboard...' : '🔄 Loading Dashboard...'}
          </div>
          <div className="text-slate-400 text-sm mt-2">
            Group ID: {groupId}
          </div>
        </div>
      </div>
    );
  }

  if (error || !groupInfo) {
    console.error('❌ GroupDashboard: Error or no group info');
    console.error('  - Error:', error);
    console.error('  - GroupInfo:', groupInfo);
    return (
      <div className="space-y-4 pb-20">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-bold text-sm">
            {lang === 'pt' ? 'Voltar' : lang === 'es' ? 'Volver' : 'Back'}
          </span>
        </button>
        <div className="flex justify-center items-center py-12">
          <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-8 text-center max-w-md">
            <p className="text-red-600 font-bold text-lg mb-2">⚠️ {error || 'Group not found'}</p>
            <p className="text-red-500 text-sm">Group ID: {groupId}</p>
            <button
              onClick={() => {
                console.log('🔄 Retrying fetch...');
                fetchGroupData();
              }}
              className="mt-4 bg-red-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-600"
            >
              {lang === 'pt' ? 'Tentar Novamente' : lang === 'es' ? 'Intentar de Nuevo' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentUserRank = leaderboard.findIndex(entry => entry.user_id === currentUserId);
  const currentUserEntry = currentUserRank >= 0 ? leaderboard[currentUserRank] : null;

  console.log('✅ GroupDashboard: Rendering successfully');
  console.log('  - Group:', groupInfo.name);
  console.log('  - Members:', leaderboard.length);
  console.log('  - Current User Rank:', currentUserRank + 1);

  return (
    <div className="space-y-6 pb-20">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="font-bold text-sm">
          {lang === 'pt' ? 'Meus Grupos' : lang === 'es' ? 'Mis Grupos' : 'My Groups'}
        </span>
      </button>

      {/* Group Header */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        </div>

        <div className="relative z-10 space-y-4">
          {/* Group Name */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-black tracking-tight mb-1">{groupInfo.name}</h1>
              {groupInfo.description && (
                <p className="text-blue-100 text-sm opacity-90">{groupInfo.description}</p>
              )}
            </div>
            {groupInfo.photo_url && (
              <img 
                src={groupInfo.photo_url} 
                alt={groupInfo.name}
                className="w-16 h-16 rounded-2xl border-2 border-white/30 shadow-lg object-cover"
              />
            )}
          </div>

          {/* Invite Code */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mb-1">
                {lang === 'pt' ? 'Código do Grupo' : lang === 'es' ? 'Código del Grupo' : 'Group Code'}
              </p>
              <p className="text-2xl font-black tracking-wider font-mono">{groupInfo.code}</p>
            </div>
            <button
              onClick={handleCopyCode}
              className="bg-white text-blue-600 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all hover:scale-105 shadow-lg"
            >
              {copiedCode ? (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  {lang === 'pt' ? 'Copiado!' : lang === 'es' ? '¡Copiado!' : 'Copied!'}
                </span>
              ) : (
                lang === 'pt' ? 'Copiar' : lang === 'es' ? 'Copiar' : 'Copy'
              )}
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-bold">
                {leaderboard.length} {lang === 'pt' ? 'membros' : lang === 'es' ? 'miembros' : 'members'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <button
        onClick={onNavigateToMatches}
        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-lg py-5 rounded-[2rem] shadow-xl shadow-green-500/30 hover:shadow-2xl hover:scale-[1.02] transition-all uppercase tracking-wide flex items-center justify-center gap-3"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {lang === 'pt' ? 'Fazer Palpites' : lang === 'es' ? 'Hacer Predicciones' : 'Make Predictions'}
      </button>

      {/* Leaderboard */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-1">
          <h2 className="font-black text-slate-900 uppercase tracking-widest text-sm">
            {lang === 'pt' ? 'Classificação' : lang === 'es' ? 'Clasificación' : 'Leaderboard'}
          </h2>
          <div className="flex-1 h-px bg-slate-200"></div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-[2rem] p-12 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-blue-800 font-black text-lg mb-2 uppercase tracking-tight">
              {lang === 'pt' ? 'Convide Amigos!' : lang === 'es' ? '¡Invita Amigos!' : 'Invite Friends!'}
            </h3>
            <p className="text-blue-600 text-sm max-w-xs mx-auto">
              {lang === 'pt' 
                ? 'Compartilhe o código do grupo para começar a competição!' 
                : lang === 'es'
                ? '¡Comparte el código del grupo para comenzar la competencia!'
                : 'Share the group code to start the competition!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, index) => {
              const isCurrentUser = entry.user_id === currentUserId;
              const rank = index + 1;
              
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                    isCurrentUser 
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-500 shadow-lg scale-[1.02]' 
                      : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* Rank */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                    rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-lg' :
                    rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-lg' :
                    rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-lg' :
                    isCurrentUser ? 'bg-blue-500 text-white' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                  </div>

                  {/* Avatar */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                    {entry.photo_url ? (
                      <img src={entry.photo_url} alt={`${entry.name} ${entry.surname}`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-600 font-black text-lg">
                        {`${entry.name} ${entry.surname}`.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-black text-sm truncate ${isCurrentUser ? 'text-blue-900' : 'text-slate-900'}`}>
                      {`${entry.name} ${entry.surname}`}
                      {isCurrentUser && (
                        <span className="ml-2 text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full">
                          {lang === 'pt' ? 'VOCÊ' : lang === 'es' ? 'TÚ' : 'YOU'}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold">
                      {entry.exact_scores} {lang === 'pt' ? 'placares exatos' : lang === 'es' ? 'resultados exactos' : 'exact scores'}
                    </p>
                  </div>

                  {/* Points */}
                  <div className={`flex-shrink-0 text-right ${isCurrentUser ? 'scale-110' : ''}`}>
                    <p className={`text-2xl font-black ${isCurrentUser ? 'text-blue-600' : 'text-slate-900'}`}>
                      {entry.total_points}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {lang === 'pt' ? 'pts' : lang === 'es' ? 'pts' : 'pts'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Current User Summary (if not in top visible) */}
      {currentUserEntry && currentUserRank >= 5 && (
        <div className="sticky bottom-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-4 shadow-2xl border-2 border-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg font-black text-sm">
                #{currentUserRank + 1}
              </span>
              <div>
                <p className="font-black text-sm">
                  {lang === 'pt' ? 'Sua Posição' : lang === 'es' ? 'Tu Posición' : 'Your Position'}
                </p>
                <p className="text-xs text-blue-100">{currentUser`${entry.name} ${entry.surname}`}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black">{currentUserEntry.total_points}</p>
              <p className="text-[9px] font-bold text-blue-100 uppercase">pts</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDashboard;
