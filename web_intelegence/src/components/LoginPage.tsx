import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import logoImage from '../assets/one-mind-logo-rounded.png';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void> | void;
  onGoogle: () => Promise<void> | void;
  onSwitchToSignup: () => void;
  error?: string;
  info?: string;
  isLoading?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  onGoogle,
  onSwitchToSignup,
  error = '',
  info = '',
  isLoading = false,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim() || isLoading) return;
    await onLogin(email.trim(), password);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f7fb] text-slate-900">
      <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,178,178,0.18),_transparent_24%),radial-gradient(circle_at_80%_66%,_rgba(255,211,170,0.16),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef3f9_100%)]">
        <div
          className="absolute inset-0 opacity-70"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.55))' }}
        />

        <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-8">
          <div className="text-[18px] font-black tracking-tight text-[#f56f74] md:text-[22px]">One Mind</div>
          <button
            type="button"
            className="rounded-full p-1 text-slate-500 transition-colors hover:text-slate-700"
            aria-label="Help"
          >
            <HelpCircle size={20} />
          </button>
        </header>

        <main className="relative z-10 flex min-h-[calc(100vh-88px)] flex-col items-center px-6 pb-10 pt-8 md:px-8 md:pb-16">
          <div className="flex w-full max-w-[820px] flex-1 flex-col items-center justify-center">
            <div className="mb-1 flex items-center justify-center">
              <img
                src={logoImage}
                alt="One Mind logo"
                className="h-[124px] w-[124px] object-contain"
              />
            </div>

            <h1 className="mt-2 text-center text-5xl font-black tracking-tight text-slate-800 md:text-6xl">
              Welcome back
            </h1>

            <div className="mt-8 w-full max-w-[404px] rounded-[34px] bg-white/94 p-10 shadow-[0_28px_60px_rgba(148,163,184,0.18)] backdrop-blur-xl">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[14px] font-semibold text-slate-600">Email Address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                    className="h-14 w-full rounded-none border-0 bg-[#f1f4f7] px-5 text-[14px] text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:bg-[#edf2f7]"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <span className="text-[14px] font-semibold text-slate-600">Password</span>
                    <button
                      type="button"
                      className="text-[14px] font-semibold text-[#da3c72] transition-colors hover:text-[#c72c63]"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="........"
                    autoComplete="current-password"
                    className="h-14 w-full rounded-none border-0 bg-[#f1f4f7] px-5 text-[14px] tracking-[0.28em] text-slate-700 outline-none transition-all placeholder:tracking-[0.28em] placeholder:text-slate-400 focus:bg-[#edf2f7]"
                  />
                </label>
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              {info ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {info}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !email.trim() || !password.trim()}
                className="mt-6 h-14 w-full rounded-full bg-[linear-gradient(90deg,_#ffb084_0%,_#d1065e_100%)] text-lg font-black text-white shadow-[0_14px_28px_rgba(219,68,120,0.28)] transition-all hover:translate-y-[-1px] hover:shadow-[0_18px_32px_rgba(219,68,120,0.34)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {isLoading ? 'Signing in...' : 'Login'}
              </button>

              <button
                type="button"
                onClick={onGoogle}
                disabled={isLoading}
                className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#e7ebee] text-[15px] font-semibold text-slate-700 transition-all hover:bg-[#dde3e8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="text-[28px] font-black leading-none text-slate-700">G</span>
                Continue with Google
              </button>
            </div>

            <div className="mt-4 text-center text-[14px] text-slate-500">
              New to One Mind?{' '}
              <button
                type="button"
                onClick={onSwitchToSignup}
                className="font-semibold text-[#d1065e] transition-colors hover:text-[#b70052]"
              >
                Create an account
              </button>
            </div>
          </div>

          <footer className="relative z-10 mt-10 flex flex-col items-center gap-5 text-center text-slate-400">
            <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Copyright 2024 One Mind AI. Built for the living cognition.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-[14px]">
              <a href="#" className="transition-colors hover:text-slate-600">Privacy Policy</a>
              <a href="#" className="transition-colors hover:text-slate-600">Terms of Service</a>
              <a href="#" className="transition-colors hover:text-slate-600">Contact Support</a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};
