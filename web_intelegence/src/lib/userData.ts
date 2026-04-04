import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const ACTIVE_SESSION_KEY_PREFIX = 'one-mind-active-session';

const safeStorage = {
  get(key: string) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      return;
    }
  },
  remove(key: string) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      return;
    }
  },
};

const sessionStorageKey = (userId: string) => `${ACTIVE_SESSION_KEY_PREFIX}:${userId}`;

const detectBrowser = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('chrome/') && !ua.includes('edg/')) return 'Chrome';
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
  if (ua.includes('firefox/')) return 'Firefox';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  return 'Unknown';
};

const detectDevice = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
  if (ua.includes('mobi') || ua.includes('android')) return 'mobile';
  return 'desktop';
};

const nowIso = () => new Date().toISOString();

const getUserFullName = (user: User) =>
  user.user_metadata?.full_name ||
  user.user_metadata?.name ||
  user.email?.split('@')[0] ||
  'One Mind User';

const getAuthProvider = (user: User) =>
  user.app_metadata?.provider || user.identities?.[0]?.provider || 'email';

export const upsertUserProfile = async (user: User) => {
  if (!supabase) return;

  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: getUserFullName(user),
      auth_provider: getAuthProvider(user),
      created_at: nowIso(),
      last_login_at: nowIso(),
    },
    { onConflict: 'id' },
  );
};

export const getOrCreateTrackedSession = async (session: Session) => {
  if (!supabase) return null;

  const userId = session.user.id;
  const storageKey = sessionStorageKey(userId);
  const cachedSessionId = safeStorage.get(storageKey);

  if (cachedSessionId) {
    await touchTrackedSession(cachedSessionId);
    return cachedSessionId;
  }

  const userAgent = navigator.userAgent || '';
  const { data, error } = await supabase
    .from('user_sessions')
    .insert({
      user_id: userId,
      auth_session_token: session.access_token.slice(-24),
      device: detectDevice(userAgent),
      browser: detectBrowser(userAgent),
      approximate_country: null,
      ip_hash: null,
      user_agent: userAgent,
      language: navigator.language || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      screen_width: typeof window.screen?.width === 'number' ? window.screen.width : null,
      screen_height: typeof window.screen?.height === 'number' ? window.screen.height : null,
      started_at: nowIso(),
      last_active_at: nowIso(),
    })
    .select('id')
    .single();

  if (error || !data?.id) return null;

  safeStorage.set(storageKey, data.id as string);
  return data.id as string;
};

export const touchTrackedSession = async (trackedSessionId: string | null) => {
  if (!supabase || !trackedSessionId) return;

  await supabase
    .from('user_sessions')
    .update({ last_active_at: nowIso() })
    .eq('id', trackedSessionId);
};

export const endTrackedSession = async (userId: string, trackedSessionId: string | null) => {
  if (!supabase || !trackedSessionId) return;

  await supabase
    .from('user_sessions')
    .update({ ended_at: nowIso(), last_active_at: nowIso() })
    .eq('id', trackedSessionId);

  safeStorage.remove(sessionStorageKey(userId));
};

export const createInvestigationRecord = async ({
  userId,
  trackedSessionId,
  query,
  provider,
  reformulated,
}: {
  userId: string;
  trackedSessionId: string | null;
  query: string;
  provider: string;
  reformulated: boolean;
}) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('investigations')
    .insert({
      user_id: userId,
      session_id: trackedSessionId,
      query,
      provider,
      reformulated,
      status: 'started',
    })
    .select('id')
    .single();

  if (error) return null;
  return (data?.id as string) ?? null;
};

export const finalizeInvestigationRecord = async ({
  investigationId,
  assistantMessage,
  answer,
  sources,
  result,
  verdictLabel,
  confidence,
  uncertainty,
  retriesUsed,
  durationMs,
  status,
  errorMessage,
}: {
  investigationId: string;
  assistantMessage?: string;
  answer?: string;
  sources?: unknown;
  result?: unknown;
  verdictLabel?: string;
  confidence?: number;
  uncertainty?: number;
  retriesUsed?: number;
  durationMs?: number;
  status: 'completed' | 'failed';
  errorMessage?: string;
}) => {
  if (!supabase) return;

  await supabase
    .from('investigations')
    .update({
      assistant_message: assistantMessage ?? null,
      answer: answer ?? null,
      sources_json: sources ?? null,
      result_json: result ?? null,
      verdict_label: verdictLabel ?? null,
      confidence: typeof confidence === 'number' ? confidence : null,
      uncertainty: typeof uncertainty === 'number' ? uncertainty : null,
      retries_used: typeof retriesUsed === 'number' ? retriesUsed : null,
      duration_ms: typeof durationMs === 'number' ? durationMs : null,
      status,
      error_message: errorMessage ?? null,
      completed_at: nowIso(),
    })
    .eq('id', investigationId);
};

export const recordInvestigationEvent = async ({
  userId,
  investigationId,
  eventType,
  payload,
}: {
  userId: string;
  investigationId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}) => {
  if (!supabase) return;

  await supabase.from('investigation_events').insert({
    user_id: userId,
    investigation_id: investigationId,
    event_type: eventType,
    payload_json: payload ?? {},
  });
};

export const recordSourceClick = async ({
  userId,
  investigationId,
  sourceUrl,
  sourceDomain,
  sourceTitle,
  stance,
}: {
  userId: string;
  investigationId: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceTitle: string;
  stance: string;
}) => {
  if (!supabase) return;

  await supabase.from('source_clicks').insert({
    user_id: userId,
    investigation_id: investigationId,
    source_url: sourceUrl,
    source_domain: sourceDomain,
    source_title: sourceTitle,
    stance,
  });
};

export const submitFeedbackRecord = async ({
  userId,
  investigationId,
  thumb,
  rating,
  comment,
  copied,
  shared,
}: {
  userId: string;
  investigationId: string;
  thumb: 'up' | 'down' | null;
  rating: number | null;
  comment: string;
  copied: boolean;
  shared: boolean;
}) => {
  if (!supabase) return { ok: false };

  const { error } = await supabase.from('feedback').upsert(
    {
      user_id: userId,
      investigation_id: investigationId,
      thumb,
      rating,
      comment: comment || null,
      copied,
      shared,
      updated_at: nowIso(),
    },
    { onConflict: 'investigation_id,user_id' },
  );

  if (error) return { ok: false };

  await supabase.from('user_outcomes').upsert(
    {
      user_id: userId,
      investigation_id: investigationId,
      got_value: thumb === 'up' || (rating ?? 0) >= 4,
      updated_at: nowIso(),
    },
    { onConflict: 'investigation_id,user_id' },
  );

  return { ok: true };
};

export const getDailyUsageSummary = async (userId: string) => {
  if (!supabase) {
    return {
      isAdmin: false,
      isBlocked: false,
      usedToday: 0,
      dailyLimit: 5,
    };
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [{ data: adminMeta }, { count }] = await Promise.all([
    supabase
      .from('admin_user_meta')
      .select('role,is_blocked')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('investigations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'started')
      .gte('created_at', dayStart.toISOString())
      .lt('created_at', dayEnd.toISOString()),
  ]);

  return {
    isAdmin: adminMeta?.role === 'admin',
    isBlocked: adminMeta?.is_blocked === true,
    usedToday: count ?? 0,
    dailyLimit: 5,
  };
};
