
import React, { useState, useEffect } from 'react';
import { Language, Group } from '../types';
import { TRANSLATIONS } from '../constants';
import { supabase } from '../supabase';

interface GroupSelectorProps {
  lang: Language;
  userGroupIds: string[];
  activeGroupId: string | null;
  currentUserEmail: string;
  onSelectGroup: (id: string) => void;
  onJoinGroup: (id: string) => void;
  onCreateGroup: (group: Group) => void;
}

const generateGroupCode = (existingGroups: Group[]): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (existingGroups.some(g => g.code === code));
  return code;
};

const GroupSelector: React.FC<GroupSelectorProps> = ({ 
  lang, 
  userGroupIds, 
  activeGroupId, 
  currentUserEmail,
  onSelectGroup, 
  onJoinGroup,
  onCreateGroup 
}) => {
  const [view, setView] = useState<'list' | 'join' | 'create' | 'success'>('list');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  
  // Create Form State
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLang, setNewLang] = useState<Language>(lang);
  const [newPhoto, setNewPhoto] = useState<string | undefined>(undefined);
  const [lastCreatedGroup, setLastCreatedGroup] = useState<Group | null>(null);

  const t = TRANSLATIONS[lang];

// Fetch groups quando userGroupIds muda (ex: após criar/entrar num grupo)
useEffect(() => {
  fetchGroups();
}, [userGroupIds.length]);

  const fetchGroups = async () => {
    try {
      console.log('📡 Fetching groups from Supabase...');
      const { data, error: fetchError } = await supabase
        .from('groups')
        .select('*');

      if (fetchError) {
        console.error('❌ Error fetching groups:', fetchError);
        setAllGroups([]);
        return;
      }

      // Map snake_case database columns to camelCase TypeScript types
      const mappedGroups = (data || []).map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        description: row.description,
        photoUrl: row.photo_url,
        initials: row.initials,
        languageDefault: row.language_default || 'pt',
        ownerUserId: row.owner_user_id,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
        isPrivate: row.is_private || false,
        status: row.status || 'ACTIVE'
      }));

      console.log('✅ Groups fetched:', mappedGroups.length, 'groups');
      setAllGroups(mappedGroups);
    } catch (err) {
      console.error('❌ Unexpected error fetching groups:', err);
      setAllGroups([]);
    }
  };

  const myGroups = allGroups.filter(g => userGroupIds.includes(g.id));

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!joinCode.trim()) {
      setError('Please enter a group code.');
      return;
    }

    try {
      console.log('🔍 Searching for group with code:', joinCode.toUpperCase());

      // Query Supabase for the group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, name, code')
        .eq('code', joinCode.toUpperCase())
        .maybeSingle();

      if (groupError) {
        console.error('❌ Group search error:', groupError);
        setError('Error searching for group.');
        return;
      }

      if (!group) {
        console.warn('⚠️ Group not found with code:', joinCode);
        setError('Invalid Group Code.');
        return;
      }

      console.log('✅ Group found:', group.id);

      // Check if user is already a member
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) {
        setError('You must be logged in to join a group.');
        return;
      }

      const userId = session.session.user.id;

      const { data: existingMember, error: memberError } = await supabase
        .from('user_groups')
        .select('id')
        .eq('user_id', userId)
        .eq('group_id', group.id)
        .maybeSingle();

      if (memberError) {
        console.error('❌ Membership check error:', memberError);
        setError('Error checking membership.');
        return;
      }

      if (existingMember) {
        console.warn('⚠️ User already member of group:', group.id);
        setError('You are already a member of this group.');
        return;
      }

      // Insert user into group
      console.log('📝 Adding user to group with payload:', {
        user_id: userId,
        group_id: group.id,
        role: 'MEMBER',
        is_active: true
      });
      
      const { error: joinError } = await supabase
        .from('user_groups')
        .insert({
          user_id: userId,
          group_id: group.id,
          role: 'MEMBER',
          is_active: true
        });

      if (joinError) {
        console.error('❌ SUPABASE ERROR joining group:');
        console.error('  Code:', joinError.code);
        console.error('  Message:', joinError.message);
        console.error('  Details:', joinError.details);
        console.error('  Full Error:', JSON.stringify(joinError, null, 2));
        
        if (joinError.code === '23505') {
          setError('You are already a member of this group.');
        } else if (joinError.code === '42501') {
          setError('Permission denied. You do not have permission to join groups.');
        } else {
          setError(`Error joining group: ${joinError.message}`);
        }
        return;
      }

      console.log('✅ Successfully joined group:', group.name);
      onJoinGroup(group.id);
      setJoinCode('');
      setError('');
      setView('list');
    } catch (err) {
      console.error('❌ Unexpected error joining group:', err);
      setError('An unexpected error occurred.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!newName.trim()) {
      setError('Group name is required.');
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Checking if group name already exists:', newName);

      // Query Supabase for duplicate name
      const { data: existingGroup, error: checkError } = await supabase
        .from('groups')
        .select('id')
        .eq('name', newName.trim())
        .maybeSingle();

      if (checkError) {
        console.error('❌ Error checking group name:', checkError);
        setError('Error checking group name. Please try again.');
        setLoading(false);
        return;
      }

      if (existingGroup) {
        console.warn('⚠️ Group name already taken:', newName);
        setError('Group name already taken. Please choose a different name.');
        setLoading(false);
        return;
      }

      console.log('✅ Group name is available. Creating group...');

      // Get current user ID with enhanced diagnostics
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) {
        setError('You must be logged in to create a group.');
        setLoading(false);
        return;
      }

      const code = generateGroupCode(allGroups);
      const userId = session.session.user.id;
      
      console.log('🔐 Auth Session Debug:');
      console.log('  User ID:', userId);
      console.log('  Auth Role:', session.session.user.role);
      console.log('  Email:', session.session.user.email);
      console.log('  Session exists:', !!session.session);
      console.log('  Token exists:', !!session.session.access_token);

      // Generate initials from group name
      const generateInitials = (name: string): string => {
        const trimmed = name.trim();
        // Split by spaces and get first letter of each word
        const words = trimmed.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return trimmed.substring(0, 2).toUpperCase();
        
        // Take first letter of each word, up to 3 characters
        const initials = words.map(w => w.charAt(0).toUpperCase()).join('').substring(0, 3);
        return initials || trimmed.substring(0, 2).toUpperCase();
      };
      
      const initials = generateInitials(newName);

      console.log('📝 Inserting group with payload:', {
        code,
        name: newName.trim(),
        owner_user_id: userId,
        initials
      });

      // Insert group into Supabase - ONLY required fields
      const { data: createdGroup, error: createError } = await supabase
        .from('groups')
        .insert({
          code: code,
          name: newName.trim(),
          description: newDesc || null,
          owner_user_id: userId,
          language_default: newLang,
          initials: initials,
          is_private: false,
          status: 'ACTIVE'
        })
        .select()
        .maybeSingle();

      if (createError) {
        console.error('❌ SUPABASE ERROR creating group:');
        console.error('  Code:', createError.code);
        console.error('  Message:', createError.message);
        console.error('  Details:', createError.details);
        console.error('  Full Error:', JSON.stringify(createError, null, 2));
        
        // Check if it's a unique constraint error
        if (createError.code === '23505') {
          setError('Group name already taken. Please choose a different name.');
        } else if (createError.code === '42501') {
          setError('Permission denied. You do not have permission to create groups.');
        } else {
          setError(`Error creating group: ${createError.message}`);
        }
        setLoading(false);
        return;
      }

      console.log('✅ Group created successfully:', createdGroup);
      
      // Map database response to TypeScript type
      const mappedGroup: Group = {
        id: createdGroup.id,
        code: createdGroup.code,
        name: createdGroup.name,
        description: createdGroup.description,
        photoUrl: createdGroup.photo_url,
        initials: createdGroup.initials,
        languageDefault: createdGroup.language_default || 'pt',
        ownerUserId: createdGroup.owner_user_id,
        createdAt: createdGroup.created_at ? new Date(createdGroup.created_at).getTime() : 0,
        updatedAt: createdGroup.updated_at ? new Date(createdGroup.updated_at).getTime() : 0,
        isPrivate: createdGroup.is_private || false,
        status: createdGroup.status || 'ACTIVE'
      };
      
      // STEP 2: Add creator as member of the new group
      console.log('📝 STEP 2: Adding creator to user_groups with payload:', {
        user_id: userId,
        group_id: createdGroup.id,
        role: 'OWNER',
        is_active: true
      });
      const { error: memberError } = await supabase
        .from('user_groups')
        .insert({
          user_id: userId,
          group_id: createdGroup.id,
          role: 'OWNER',
          is_active: true
        });

      if (memberError) {
        console.error('❌ STEP 2 ERROR - Failed to add creator to group:');
        console.error('  Code:', memberError.code);
        console.error('  Message:', memberError.message);
        console.error('  Details:', memberError.details);
        console.error('  Hint:', memberError.hint);
        console.error('🔍 Full Error Object:', JSON.stringify(memberError, null, 2));
        console.error('⚠️ Group was created (ID:', createdGroup.id + '), but creator not added as member');
        console.error('💡 LIKELY CAUSE: RLS policy missing or incorrect on user_groups table');
        console.error('💡 FIX: Verify user_groups RLS policies allow INSERT for authenticated users');
        // Continue anyway - the group exists, just the membership failed
        // In production, you'd want to delete the group and retry
      } else {
        console.log('✅ Creator added to group successfully');
      }
      
      // STEP 3: Refresh groups list to show in "My Groups"
      console.log('🔄 STEP 3: Refreshing groups list...');
      await fetchGroups();
      
      // STEP 4: UPDATE APP STATE - Call onCreateGroup to sync user.groupIds
      console.log('🔄 STEP 4: Updating App.tsx state with new group...');
      onCreateGroup(mappedGroup);
      
      // Reset form
      setNewName('');
      setNewDesc('');
      setNewPhoto(undefined);
      setLastCreatedGroup(createdGroup);
      
      setView('success');
    } catch (err) {
      console.error('❌ Unexpected error creating group:', err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setNewPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Código copiado!');
  };

  if (view === 'success' && lastCreatedGroup) {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
          ✓
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Grupo Criado!</h2>
        <p className="text-sm text-slate-500 mb-8 font-medium">Compartilhe o código abaixo com seus amigos para eles entrarem no bolão.</p>
        
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-6 rounded-3xl mb-8 group cursor-pointer active:scale-95 transition-transform" onClick={() => copyToClipboard(lastCreatedGroup.code)}>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Código do Grupo</span>
          <span className="text-4xl font-black text-blue-600 tracking-widest">{lastCreatedGroup.code}</span>
          <span className="text-[10px] font-bold text-blue-400 block mt-4 group-hover:underline">Clique para copiar</span>
        </div>

        <button 
          onClick={() => setView('list')}
          className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl transition transform active:scale-95"
        >
          Ir para Meus Grupos
        </button>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in slide-in-from-right-4 duration-500">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{t.createGroup}</h3>
          <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="flex flex-col items-center mb-4">
            <div className="relative group cursor-pointer">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 overflow-hidden relative shadow-inner">
                {newPhoto ? (
                  <img src={newPhoto} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[9px] font-bold text-center px-2 uppercase tracking-widest">Foto do Grupo</span>
                )}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">Nome do Grupo*</label>
            <input 
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
              placeholder="Ex: Família & Futebol"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">Descrição (Opcional)</label>
            <textarea 
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm"
              placeholder="Fale um pouco sobre o grupo..."
              rows={2}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">Idioma Padrão</label>
            <select 
              value={newLang}
              onChange={(e) => setNewLang(e.target.value as Language)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none font-bold"
            >
              <option value="pt">Português (PT)</option>
              <option value="en">English (EN)</option>
              <option value="es">Español (ES)</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/20 transition transform active:scale-95"
          >
            {t.createGroup}
          </button>
        </form>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 animate-in slide-in-from-left-4 duration-500">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{t.joinGroup}</h3>
          <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <input 
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-5 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-black uppercase tracking-[0.3em] text-center text-xl"
            placeholder="XXXXXXX"
            autoFocus
          />
          {error && <p className="text-xs font-bold text-red-500 text-center">{error}</p>}
          <button 
            type="submit"
            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl transition transform active:scale-95"
          >
            Confirmar Entrada
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* List Section */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{t.myGroups}</h3>
          <div className="flex gap-2">
            <button onClick={() => setView('join')} className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all" title={t.joinGroup}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button onClick={() => setView('create')} className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all" title={t.createGroup}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="grid gap-3">
          {myGroups.map(group => (
            <button
              key={group.id}
              onClick={() => onSelectGroup(group.id)}
              className={`p-5 rounded-3xl border-2 transition-all flex justify-between items-center group ${
                activeGroupId === group.id 
                  ? 'border-blue-500 bg-blue-50/30 shadow-md' 
                  : 'border-slate-50 hover:border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black overflow-hidden shadow-sm transition-transform group-hover:scale-110 ${activeGroupId === group.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {group.photoUrl ? (
                    <img src={group.photoUrl} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    group.initials
                  )}
                </div>
                <div className="text-left">
                  <div className="font-black text-slate-800 tracking-tight leading-none mb-1">{group.name}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">#{group.code}</div>
                    {group.ownerUserId === currentUserEmail && (
                      <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1 py-0.5 rounded-md uppercase">Dono</span>
                    )}
                  </div>
                </div>
              </div>
              {activeGroupId === group.id && (
                <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-500/30 animate-in zoom-in-50 duration-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
          {myGroups.length === 0 && (
            <div className="py-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{t.noGroups}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupSelector;
