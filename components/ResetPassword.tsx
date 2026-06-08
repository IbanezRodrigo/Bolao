import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Language } from '../types';

interface ResetPasswordProps {
  lang: Language;
  onComplete: () => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ lang, onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(lang === 'pt' ? 'A senha deve ter pelo menos 6 caracteres.' : lang === 'es' ? 'La contraseña debe tener al menos 6 caracteres.' : 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError(lang === 'pt' ? 'As senhas não coincidem.' : lang === 'es' ? 'Las contraseñas no coinciden.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(onComplete, 2000);
    } catch (err: any) {
      setError(err?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/30 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-black text-white tracking-tighter mb-2">
            UNITED <span className="text-blue-400">20</span><span className="text-red-400">26</span>
          </h2>
          <p className="text-slate-400 font-medium text-sm tracking-wide uppercase">
            {lang === 'pt' ? 'Definir nova senha' : lang === 'es' ? 'Nueva contraseña' : 'Set new password'}
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-black/50 border border-slate-100">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p className="font-black text-slate-800">
                {lang === 'pt' ? 'Senha alterada com sucesso!' : lang === 'es' ? '¡Contraseña actualizada!' : 'Password updated!'}
              </p>
              <p className="text-xs text-slate-400">
                {lang === 'pt' ? 'A redirecionar...' : 'Redirecting...'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'pt' ? 'Nova senha' : lang === 'es' ? 'Nueva contraseña' : 'New password'}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-800"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'pt' ? 'Confirmar senha' : lang === 'es' ? 'Confirmar contraseña' : 'Confirm password'}
                </label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-800"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl transition-all"
              >
                {loading
                  ? (lang === 'pt' ? 'A guardar...' : 'Saving...')
                  : (lang === 'pt' ? 'Guardar nova senha' : lang === 'es' ? 'Guardar contraseña' : 'Save new password')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
