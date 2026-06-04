import React, { useState } from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { supabase } from '../supabase';

interface AuthProps {
  lang: Language;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
}

const Auth: React.FC<AuthProps> = ({ lang, onLogin, onRegister }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const t = TRANSLATIONS[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (!email) { setError(t.invalidCredentials); return; }
      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setSuccess(
          lang === 'pt' ? 'Email enviado! Verifica a tua caixa de entrada.' :
          lang === 'es' ? '¡Email enviado! Revisa tu bandeja de entrada.' :
          'Email sent! Check your inbox.'
        );
        return;
      }
      if (!password) { setError(t.invalidCredentials); return; }
      if (mode === 'login') await onLogin(email, password);
      else await onRegister(email, password);
    } catch (err: any) {
      setError(err?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const btnLabel = loading
    ? (lang === 'pt' ? 'A processar...' : 'Loading...')
    : mode === 'login' ? t.login
    : mode === 'register' ? t.register
    : (lang === 'pt' ? 'Enviar email' : lang === 'es' ? 'Enviar email' : 'Send email');

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-slate-900"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/30 rounded-full blur-[120px] animate-pulse delay-700"></div>
        <div className="absolute top-[20%] right-[-5%] w-[40%] h-[40%] bg-green-600/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_70%)]"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
        <div className="mb-10 text-center">
          <div className="inline-block p-4 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl mb-6">
            <div className="w-16 h-16 flex items-center justify-center bg-gradient-to-tr from-blue-500 to-red-500 rounded-2xl shadow-lg">
              <svg viewBox="0 0 24 24" fill="white" className="w-10 h-10">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" className="opacity-20"/>
                <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
                <path d="M12 4v2m0 12v2M4 12h2m12 0h2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter mb-2">
            UNITED <span className="text-blue-400">20</span><span className="text-red-400">26</span>
          </h2>
          <p className="text-slate-400 font-medium text-sm tracking-wide uppercase">
            {mode === 'login' ? 'Bem-vindo de volta' : mode === 'register' ? 'Crie sua conta' : 'Recuperar senha'}
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-black/50 border border-slate-100 ring-1 ring-black/5">

          {/* Tabs — só login e register */}
          {mode !== 'forgot' && (
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-slate-100 p-1.5 rounded-2xl w-full">
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'login' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >{t.login}</button>
                <button
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'register' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >{t.register}</button>
              </div>
            </div>
          )}

          {/* Forgot password header */}
          {mode === 'forgot' && (
            <div className="mb-6">
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-sm font-bold mb-4 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                </svg>
                {lang === 'pt' ? 'Voltar ao login' : lang === 'es' ? 'Volver' : 'Back to login'}
              </button>
              <p className="text-xs text-slate-500 font-medium">
                {lang === 'pt' ? 'Insere o teu email e enviaremos um link para redefinires a senha.' :
                 lang === 'es' ? 'Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.' :
                 'Enter your email and we\'ll send you a link to reset your password.'}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t.email}</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-800"
                placeholder="nome@exemplo.com"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t.password}</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-800"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 flex items-center gap-2 animate-in slide-in-from-top-1">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 text-green-700 text-xs font-bold p-3 rounded-xl border border-green-100 flex items-center gap-2 animate-in slide-in-from-top-1">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                </svg>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full bg-slate-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl shadow-xl transition-all transform active:scale-[0.97] overflow-hidden"
            >
              <span className="relative z-10">{btnLabel}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-red-500 to-green-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
            </button>

            {/* Esqueci a senha — só no modo login */}
            {mode === 'login' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                  className="text-xs text-slate-400 hover:text-blue-600 font-bold transition-colors"
                >
                  {lang === 'pt' ? 'Esqueci a senha' : lang === 'es' ? 'Olvidé mi contraseña' : 'Forgot password?'}
                </button>
              </div>
            )}
          </form>

          <div className="mt-8 text-center">
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">World Cup 2026 Prediction League</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
