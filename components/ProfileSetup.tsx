import React, { useState } from 'react';
import { Language, User } from '../types';
import { TRANSLATIONS, TEAMS } from '../constants';

interface ProfileSetupProps {
  lang: Language;
  onComplete: (data: Partial<User>) => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ lang, onComplete }) => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [preferredTeam, setPreferredTeam] = useState('');

  const t = TRANSLATIONS[lang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !surname || !preferredTeam) return;
    onComplete({ name, surname, preferredTeam });
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">
        {lang === 'pt' ? 'Complete seu Perfil' : lang === 'es' ? 'Completa tu Perfil' : 'Complete your Profile'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t.name}*</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t.surname}*</label>
            <input
              required
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t.preferredTeam}*</label>
          <p className="text-[10px] text-slate-400 italic mb-2 leading-tight">{t.prefTeamInfo}</p>
          <select
            required
            value={preferredTeam}
            onChange={(e) => setPreferredTeam(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 appearance-none outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
          >
            <option value="">
              {lang === 'pt' ? 'Selecione...' : lang === 'es' ? 'Seleccione...' : 'Select...'}
            </option>
            {Object.values(TEAMS).map((team) => (
              <option key={team.id} value={team.name[lang]}>
                {team.flag} {team.name[lang]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/30 transition"
        >
          {t.save}
        </button>
      </form>
    </div>
  );
};

export default ProfileSetup;
