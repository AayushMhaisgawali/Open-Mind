import React, { useState } from 'react';
import logoImage from '../assets/one-mind-logo-rounded.png';

interface SignupPageProps {
  onSignup: (payload: { fullName: string; email: string; password: string; confirmPassword: string }) => Promise<void> | void;
  onGoogle: () => Promise<void> | void;
  onSwitchToLogin: () => void;
  error?: string;
  info?: string;
  isLoading?: boolean;
}

export const SignupPage: React.FC<SignupPageProps> = ({
  onSignup,
  onGoogle,
  onSwitchToLogin,
  error = '',
  info = '',
  isLoading = false,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async () => {
    if (isLoading) return;
    await onSignup({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      confirmPassword,
    });
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f7fb] text-slate-900">
      <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,178,178,0.14),_transparent_24%),radial-gradient(circle_at_78%_64%,_rgba(255,211,170,0.14),_transparent_24%),linear-gradient(180deg,_#f7fafc_0%,_#eef3f8_100%)]">
        <main className="relative flex min-h-screen flex-col items-center justify-between px-5 py-10 md:px-8">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-[520px] rounded-[34px] bg-white/95 p-8 shadow-[0_28px_60px_rgba(148,163,184,0.16)] backdrop-blur-xl sm:p-10 md:p-12">
              <div className="mb-8 flex justify-center">
                <img
                  src={logoImage}
                  alt="One Mind logo"
                  className="h-[108px] w-[108px] object-contain"
                />
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[13px] font-semibold text-slate-500">Full Name</span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="John Doe"
                    autoComplete="name"
                    className="h-15 w-full rounded-[18px] border-0 bg-[#f1f4f7] px-6 text-[15px] text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:bg-[#edf2f7]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[13px] font-semibold text-slate-500">Email Address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="h-15 w-full rounded-[18px] border-0 bg-[#f1f4f7] px-6 text-[15px] text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:bg-[#edf2f7]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[13px] font-semibold text-slate-500">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="........"
                    autoComplete="new-password"
                    className="h-15 w-full rounded-[18px] border-0 bg-[#f1f4f7] px-6 text-[15px] tracking-[0.28em] text-slate-700 outline-none transition-all placeholder:tracking-[0.28em] placeholder:text-slate-400 focus:bg-[#edf2f7]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[13px] font-semibold text-slate-500">Confirm Password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="........"
                    autoComplete="new-password"
                    className="h-15 w-full rounded-[18px] border-0 bg-[#f1f4f7] px-6 text-[15px] tracking-[0.28em] text-slate-700 outline-none transition-all placeholder:tracking-[0.28em] placeholder:text-slate-400 focus:bg-[#edf2f7]"
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
                disabled={isLoading || !fullName.trim() || !email.trim() || !password || !confirmPassword}
                className="mt-6 h-15 w-full rounded-full bg-[linear-gradient(90deg,_#ffb084_0%,_#d1065e_100%)] text-[16px] font-black text-white shadow-[0_14px_28px_rgba(219,68,120,0.28)] transition-all hover:translate-y-[-1px] hover:shadow-[0_18px_32px_rgba(219,68,120,0.34)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>

              <div className="my-5 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300">Or</div>

              <button
                type="button"
                onClick={onGoogle}
                disabled={isLoading}
                className="flex h-15 w-full items-center justify-center gap-3 rounded-full bg-[#e7ebee] text-[15px] font-semibold text-slate-700 transition-all hover:bg-[#dde3e8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="text-[28px] font-black leading-none text-slate-700">G</span>
                Sign up with Google
              </button>

              <div className="mt-6 text-center text-[13px] text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="font-semibold text-[#d1065e] transition-colors hover:text-[#b70052]"
                >
                  Log in
                </button>
              </div>
            </div>
          </div>

          <footer className="mt-10 flex flex-col items-center gap-4 text-center text-slate-400">
            <div className="flex flex-wrap items-center justify-center gap-6 text-[13px]">
              <a href="#" className="transition-colors hover:text-slate-600">Privacy Policy</a>
              <a href="#" className="transition-colors hover:text-slate-600">Terms of Service</a>
              <a href="#" className="transition-colors hover:text-slate-600">Contact Support</a>
            </div>
            <div className="text-[12px] text-slate-400">
              Copyright 2024 One Mind AI. Built for the living cognition.
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};
