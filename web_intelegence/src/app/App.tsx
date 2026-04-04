import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AntiGravityDashboard } from '../components/AntiGravityDashboard';
import { LandingPage } from '../components/LandingPage';
import { LoginPage } from '../components/LoginPage';
import { SignupPage } from '../components/SignupPage';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../lib/supabase';
import { endTrackedSession, getOrCreateTrackedSession, upsertUserProfile } from '../lib/userData';

function App() {
  const [initialQuery, setInitialQuery] = useState('');
  const [authScreen, setAuthScreen] = useState<'landing' | 'login' | 'signup' | 'workspace'>('landing');
  const [session, setSession] = useState<Session | null>(null);
  const [trackedSessionId, setTrackedSessionId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    const syncUserState = async (currentSession: Session | null) => {
      if (!currentSession?.user) {
        if (isMounted) setTrackedSessionId(null);
        return;
      }

      await upsertUserProfile(currentSession.user);
      const nextTrackedSessionId = await getOrCreateTrackedSession(currentSession);
      if (isMounted) setTrackedSessionId(nextTrackedSessionId);
    };

    const loadSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!isMounted) return;
      setSession(currentSession);
      setAuthScreen(currentSession ? 'workspace' : 'landing');
      await syncUserState(currentSession);
      setIsAuthLoading(false);
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setAuthScreen(currentSession ? 'workspace' : 'landing');
      setIsAuthLoading(false);
      void syncUserState(currentSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleStart = (claim: string) => {
    setInitialQuery(claim.trim());
    setAuthScreen('workspace');
  };

  const handleGoToLogin = () => {
    setAuthError('');
    setAuthInfo('');
    setAuthScreen('login');
  };

  const handleGoToSignup = () => {
    setAuthError('');
    setAuthInfo('');
    setAuthScreen('signup');
  };

  const handleLogin = async (email: string, password: string) => {
    if (!supabase) {
      setAuthError(supabaseConfigError);
      return;
    }

    setAuthBusy(true);
    setAuthError('');
    setAuthInfo('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError(error.message);
    }

    setAuthBusy(false);
  };

  const handleSignup = async ({
    fullName,
    email,
    password,
    confirmPassword,
  }: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    if (!supabase) {
      setAuthError(supabaseConfigError);
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    setAuthBusy(true);
    setAuthError('');
    setAuthInfo('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setAuthError(error.message);
      setAuthBusy(false);
      return;
    }

    if (!data.session) {
      setAuthInfo('Account created. Check your email to confirm your address, then log in.');
      setAuthScreen('login');
    }

    setAuthBusy(false);
  };

  const handleGoogle = async () => {
    if (!supabase) {
      setAuthError(supabaseConfigError);
      return;
    }

    setAuthBusy(true);
    setAuthError('');
    setAuthInfo('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthError(error.message);
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase || !session?.user) return;
    await endTrackedSession(session.user.id, trackedSessionId);
    setTrackedSessionId(null);
    await supabase.auth.signOut();
  };

  const handleBackToLanding = () => {
    setAuthError('');
    setAuthInfo('');
    setAuthScreen(session ? 'workspace' : 'landing');
  };

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-slate-500">
        <div className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold shadow-sm">
          Preparing One Mind...
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      {authScreen === 'workspace' && session ? (
        <AntiGravityDashboard
          initialQuery={initialQuery}
          onBack={handleBackToLanding}
          onSignOut={handleSignOut}
          userId={session.user.id}
          trackedSessionId={trackedSessionId}
        />
      ) : authScreen === 'login' ? (
        <LoginPage
          onLogin={handleLogin}
          onGoogle={handleGoogle}
          onSwitchToSignup={handleGoToSignup}
          error={authError}
          info={authInfo}
          isLoading={authBusy}
        />
      ) : authScreen === 'signup' ? (
        <SignupPage
          onSignup={handleSignup}
          onGoogle={handleGoogle}
          onSwitchToLogin={handleGoToLogin}
          error={authError}
          info={authInfo}
          isLoading={authBusy}
        />
      ) : (
        <LandingPage onContinue={handleGoToLogin} />
      )}
    </div>
  );
}

export default App;
