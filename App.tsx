import React, { useState, useEffect } from 'react';
import { User, Language, Group, ScoringConfig } from './types';
import { TRANSLATIONS, SCORING_RULES as INITIAL_SCORING_RULES } from './constants';
import Login from './components/Auth';
import MatchList from './components/MatchList';
import ProfileSetup from './components/ProfileSetup';
import Leaderboard from './components/Leaderboard';
import GroupSelector from './components/GroupSelector';
import GroupDashboard from './components/GroupDashboard';
import Rules from './components/Rules';
import { supabase } from './supabase';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('pt');
  const [user, setUser] = useState<User | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<'matches' | 'ranking' | 'groups' | 'rules'>('matches');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [viewingGroupDashboard, setViewingGroupDashboard] = useState(false);
  const [scoringRules, setScoringRules] = useState<ScoringConfig>(INITIAL_SCORING_RULES);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);

  const t = TRANSLATIONS[lang];

  // ── Fetch scoring rules ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchScoringRules = async () => {
      try {
        const { data, error } = await supabase
          .from('scoring_rules')
          .select('exact_score, winner, correct_draw, goal_diff, one_team_score, mult_group, mult_r16, mult_qf, mult_sf, mult_final')
          .eq('id', 'current')
          .single();
        if (error) throw error;
        if (data) {
          setScoringRules({
            exactScore:   data.exact_score,
            winner:       data.winner,
            correctDraw:  data.correct_draw,
            goalDiff:     data.goal_diff,
            oneTeamScore: data.one_team_score,
            multGroup:    data.mult_group,
            multR16:      data.mult_r16,
            multQF:       data.mult_qf,
            multSF:       data.mult_sf,
            multFinal:    data.mult_final,
          });
          console.log('✅ Scoring rules loaded from Supabase');
        }
      } catch (err) {
        console.error('❌ Failed to fetch scoring rules, using defaults:', err);
        setScoringRules(INITIAL_SCORING_RULES);
      }
    };
    fetchScoringRules();
  }, []);

  // ── Fetch grupo ativo ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeGroupId) { setCurrentGroup(null); return; }
    const fetchGroup = async () => {
      const { data, error } = await supabase.from('groups').select('*').eq('id', activeGroupId).single();
      if (!error && data) {
        setCurrentGroup({
          id: data.id, code: data.code, name: data.name,
          description: data.description, photoUrl: data.photo_url,
          initials: data.initials, languageDefault: data.language_default,
          ownerUserId: data.owner_user_id, isPrivate: data.is_private,
          status: data.status,
          createdAt: new Date(data.created_at).getTime(),
          updatedAt: new Date(data.updated_at).getTime(),
        });
      }
    };
    fetchGroup();
  }, [activeGroupId]);

  // ── Restore session ───────────────────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        await loadUserProfile(data.session.user.id, data.session.user.email || '');
      }
    };
    restoreSession();
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); setActiveGroupId(null); }
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  // ── Helper: recarregar grupos do user ────────────────────────────────────
  const reloadUserGroups = async (userId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', userId)
      .eq('is_active', true);
    return data?.map((m: any) => m.group_id) || [];
  };

  // ── Helper: carregar profile ──────────────────────────────────────────────
  const loadUserProfile = async (userId: string, email: string) => {
    let profile = null;
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (data) { profile = data; break; }
      await new Promise(r => setTimeout(r, 200 * (i + 1)));
    }
    if (!profile) {
      const { data } = await supabase
        .from('profiles')
        .upsert({ id: userId, email, name: 'User', surname: '', updated_at: new Date() }, { onConflict: 'id' })
        .select().maybeSingle();
      profile = data;
    }
    if (!profile) throw new Error('Could not load profile');

    const groupIds = await reloadUserGroups(userId);

    const loggedUser: User = {
      id: userId, email: profile.email,
      name: profile.name || 'User', surname: profile.surname || '',
      preferredTeam: profile.preferred_team || '',
      groupIds, predictions: {},
    };
    setUser(loggedUser);
    if (groupIds.length > 0) setActiveGroupId(groupIds[0]);
    return loggedUser;
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (loginEmail: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) throw error;
    if (data?.user?.id) await loadUserProfile(data.user.id, loginEmail);
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async (registerEmail: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email: registerEmail, password });
    if (error) throw error;
    if (!data?.user?.id) throw new Error('Signup failed');
    if (data.session) {
      await loadUserProfile(data.user.id, registerEmail);
      setShowProfileSetup(true);
    } else {
      alert(`✅ Registo bem-sucedido!\n\nVerifica o teu email: ${registerEmail}\nClica no link para confirmar o registo.`);
    }
  };

  // ── Profile complete ──────────────────────────────────────────────────────
  const handleProfileComplete = async (profileData: Partial<User>) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ name: profileData.name, surname: profileData.surname, preferred_team: profileData.preferredTeam, updated_at: new Date() })
      .eq('id', user.id);
    if (error) throw error;
    setUser(prev => prev ? { ...prev, ...profileData } : prev);
    setShowProfileSetup(false);
    setActiveTab('groups');
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setActiveGroupId(null);
    setCurrentGroup(null);
  };

  // ── Criar grupo ───────────────────────────────────────────────────────────
  const handleCreateGroup = async (newGroup: Group) => {
    if (!user?.id) return;
    const { data, error } = await supabase.from('groups').insert({
      code: newGroup.code, name: newGroup.name,
      description: newGroup.description, initials: newGroup.initials,
      language_default: newGroup.languageDefault,
      owner_user_id: user.id, is_private: newGroup.isPrivate,
    }).select().single();
    if (error) throw error;
    await supabase.from('user_groups').insert({ user_id: user.id, group_id: data.id, role: 'OWNER' });
    const groupIds = await reloadUserGroups(user.id);
    setUser(prev => prev ? { ...prev, groupIds } : prev);
    setActiveGroupId(data.id);
  };

  // ── Entrar em grupo ───────────────────────────────────────────────────────
  const handleJoinGroup = async (groupId: string) => {
    if (!user?.id || user.groupIds.includes(groupId)) return;
    await supabase.from('user_groups').insert({ user_id: user.id, group_id: groupId, role: 'MEMBER' });
    const groupIds = await reloadUserGroups(user.id);
    setUser(prev => prev ? { ...prev, groupIds } : prev);
    setActiveGroupId(groupId);
    setActiveTab('matches');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 pb-32 flex flex-col">
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 px-4 py-3 flex justify-between items-center border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center cursor-pointer" onClick={() => setActiveTab('matches')}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-red-500 to-green-600 rounded-lg rotate-3 shadow-lg opacity-80"></div>
            <div className="relative bg-white rounded-lg w-9 h-9 flex items-center justify-center text-slate-900 shadow-sm border border-slate-100">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-blue-600" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a10 10 0 0 1 10 10M12 22a10 10 0 0 1-10-10" stroke="red" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.2"/>
                <path d="M12 2v20M2 12h20" stroke="green" strokeWidth="1" strokeDasharray="2 2"/>
              </svg>
            </div>
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-red-600">BOLÃO</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              {currentGroup ? currentGroup.name : 'UNITED 2026'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={lang}
            onChange={e => setLang(e.target.value as Language)}
            className="text-xs font-bold bg-slate-100 border-none rounded-full px-3 py-1.5 outline-none cursor-pointer hover:bg-slate-200 transition appearance-none text-center"
          >
            <option value="pt">PT</option>
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
          {user && (
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title={t.logout}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <main className={`flex-1 ${!user && !showProfileSetup ? '' : 'max-w-xl mx-auto px-4 mt-6 w-full'}`}>
        {!user && !showProfileSetup && (
          <Login lang={lang} onLogin={handleLogin} onRegister={handleRegister} />
        )}
        {showProfileSetup && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ProfileSetup lang={lang} onComplete={handleProfileComplete} />
          </div>
        )}
        {user && !showProfileSetup && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {activeTab === 'matches' && (
              <>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
                  <div className="flex items-center gap-5 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl overflow-hidden shadow-inner border border-blue-200/50">
                      {user.photo
                        ? <img src={user.photo} alt="Avatar" className="w-full h-full object-cover" />
                        : <span>{user.name?.[0]}{user.surname?.[0]}</span>
                      }
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-800 tracking-tight">{t.welcome}, {user.name}!</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest border border-slate-200/50">
                          {user.preferredTeam}
                        </span>
                        {currentGroup && (
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-widest border border-blue-100">
                            {currentGroup.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {user.groupIds.length === 0 ? (
                  <div className="bg-blue-50 border border-blue-100 p-8 rounded-[2.5rem] text-center">
                    <h3 className="text-blue-800 font-black mb-2 uppercase tracking-tight">{t.noGroups}</h3>
                    <button onClick={() => setActiveTab('groups')} className="bg-blue-600 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-blue-500/20">
                      {t.joinGroup}
                    </button>
                  </div>
                ) : (
                  <MatchList lang={lang} groupId={activeGroupId} />
                )}
              </>
            )}
            {activeTab === 'ranking' && (
              <Leaderboard lang={lang} groupId={activeGroupId} />
            )}
            {activeTab === 'groups' && !viewingGroupDashboard && (
              <GroupSelector
                lang={lang}
                userGroupIds={user.groupIds}
                activeGroupId={activeGroupId}
                currentUserEmail={user.email}
                onSelectGroup={id => { setActiveGroupId(id); setViewingGroupDashboard(true); }}
                onJoinGroup={handleJoinGroup}
                onCreateGroup={handleCreateGroup}
              />
            )}
            {activeTab === 'groups' && viewingGroupDashboard && activeGroupId && (
              <GroupDashboard
                lang={lang}
                groupId={activeGroupId}
                currentUserId={user.id || 'unknown'}
                onNavigateToMatches={() => { setViewingGroupDashboard(false); setActiveTab('matches'); }}
                onBack={() => setViewingGroupDashboard(false)}
              />
            )}
            {activeTab === 'rules' && (
              <Rules lang={lang} scoringConfig={scoringRules} />
            )}
          </div>
        )}
      </main>

      {user && !showProfileSetup && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] max-w-sm bg-white/90 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-2xl p-1.5 flex gap-1 z-50">
          {(['matches', 'ranking', 'groups', 'rules'] as const).map(tab => {
            const icons: Record<string, string> = {
              matches: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
              ranking: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
              groups:  'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
              rules:   'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
            };
            const labels: Record<string, string> = {
              matches: t.matches, ranking: t.ranking, groups: t.groups, rules: t.rules,
            };
            return (
              <button
                key={tab}
                onClick={() => { if (tab === 'groups') setViewingGroupDashboard(false); setActiveTab(tab); }}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl text-[9px] font-black transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg scale-105' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={icons[tab]} />
                </svg>
                {labels[tab].toUpperCase()}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};

export default App;
