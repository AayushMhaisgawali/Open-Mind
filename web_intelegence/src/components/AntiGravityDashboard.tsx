import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Globe, Activity, AlertTriangle, ArrowLeft, LogOut, Copy, Share2, ThumbsDown, ThumbsUp, Star, Square } from 'lucide-react';
import { MindPixelsGraph, DashboardGraphLink, DashboardGraphNode } from './MindPixelsGraph';
import { OneMindLogo } from './OneMindLogo';
import {
  createInvestigationRecord,
  finalizeInvestigationRecord,
  getDailyUsageSummary,
  recordInvestigationEvent,
  recordSourceClick,
  submitFeedbackRecord,
  touchTrackedSession,
} from '../lib/userData';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface EvidenceHighlight {
  source: string;
  title: string;
  stance: 'support' | 'contradict' | 'neutral';
  excerpt: string;
}

interface VerificationResponse {
  query: string;
  provider: string;
  assistant_message: string;
  final_answer: {
    direct_answer: string;
    reasoning_summary: string;
    confidence_note: string;
    evidence_highlights: EvidenceHighlight[];
    markdown: string;
  };
  verdict: {
    label: string;
    confidence: number;
    uncertainty: number;
    stopped_reason: string;
    retries_used: number;
  };
  counts: {
    support: number;
    neutral: number;
    contradict: number;
    total: number;
    support_pct: number;
    neutral_pct: number;
    contradict_pct: number;
  };
  claim: {
    original_query: string;
    normalized_claim: string;
    question_type: string;
    claim_type: string;
    entities: string[];
  };
  sources: Array<{
    id: string;
    domain: string;
    title: string;
    url: string;
    stance: 'support' | 'contradict' | 'neutral';
    confidence: number;
    relevance: number;
    excerpt: string;
    fetch_status: string;
  }>;
  graph: {
    nodes: DashboardGraphNode[];
    links: DashboardGraphLink[];
  };
  processing_stream: string[];
}

interface StreamEvent {
  type: string;
  payload: Record<string, any>;
}

const EXAMPLE_QUERIES = [
  "Did Nvidia become the world's most valuable public company in 2024?",
  "Has Tesla's automotive gross margin declined since 2022?",
  'Did the EU formally approve the AI Act before the U.S. passed a comparable federal AI law?',
];

const EMPTY_COUNTS = {
  support: 0,
  neutral: 0,
  contradict: 0,
  total: 0,
  support_pct: 0,
  neutral_pct: 0,
  contradict_pct: 0,
};

const EMPTY_GRAPH = {
  nodes: [] as DashboardGraphNode[],
  links: [] as DashboardGraphLink[],
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const NETWORK_RETRY_DELAY_MS = 1800;

const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isLikelyNetworkError = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed')
  );
};

const trimText = (value: string, limit = 180) => {
  const compact = (value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit).trimEnd()}...`;
};

const slugId = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'node';

const sourceGroupFromDomain = (domain: string): DashboardGraphNode['group'] => {
  const lowered = (domain || '').toLowerCase();
  if (lowered.endsWith('.gov') || lowered.includes('.gov.')) return 'government';
  if (['news', 'times', 'reuters', 'bloomberg', 'wsj', 'ft', 'bbc', 'cnn', 'forbes', 'zdnet', 'blog', 'medium'].some((token) => lowered.includes(token))) {
    return 'media';
  }
  return 'organization';
};

const upsertNode = (graph: typeof EMPTY_GRAPH, node: DashboardGraphNode) => {
  const existingIndex = graph.nodes.findIndex((item) => item.id === node.id);
  if (existingIndex === -1) {
    return { ...graph, nodes: [...graph.nodes, node] };
  }
  const nodes = [...graph.nodes];
  nodes[existingIndex] = { ...nodes[existingIndex], ...node };
  return { ...graph, nodes };
};

const upsertLink = (graph: typeof EMPTY_GRAPH, link: DashboardGraphLink) => {
  const exists = graph.links.some((item) => item.source === link.source && item.target === link.target && item.label === link.label);
  if (exists) return graph;
  return { ...graph, links: [...graph.links, link] };
};

interface AntiGravityDashboardProps {
  initialQuery?: string;
  onBack?: () => void;
  onSignOut?: () => Promise<void> | void;
  userId?: string;
  trackedSessionId?: string | null;
}

export const AntiGravityDashboard: React.FC<AntiGravityDashboardProps> = ({
  initialQuery = '',
  onBack,
  onSignOut,
  userId,
  trackedSessionId = null,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Ask a web question and I will trace websites, evaluate evidence, and answer.',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [graphKey, setGraphKey] = useState(0);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [error, setError] = useState('');
  const [activeStepLabel, setActiveStepLabel] = useState('waiting');
  const [liveGraph, setLiveGraph] = useState(EMPTY_GRAPH);
  const [liveSources, setLiveSources] = useState<VerificationResponse['sources']>([]);
  const [liveCounts, setLiveCounts] = useState(EMPTY_COUNTS);
  const [processingStream, setProcessingStream] = useState<string[]>([
    'Awaiting a query to begin structured claim generation.',
    'The graph will trace search queries, visited websites, parsed pages, and evidence judgments in real time.',
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const workspaceScrollRef = useRef<HTMLElement>(null);
  const lastSourceRef = useRef<string | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const activeInvestigationRef = useRef<{
    id: string | null;
    query: string;
    startedAt: number;
    copied: boolean;
    shared: boolean;
  } | null>(null);
  const completedInvestigationsRef = useRef(0);
  const [feedbackThumb, setFeedbackThumb] = useState<'up' | 'down' | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [usageSummary, setUsageSummary] = useState({
    isAdmin: false,
    isBlocked: false,
    usedToday: 0,
    dailyLimit: 5,
  });

  const refreshUsageSummary = async () => {
    if (!userId) return;
    const summary = await getDailyUsageSummary(userId);
    setUsageSummary(summary);
  };

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (workspaceScrollRef.current) {
      workspaceScrollRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = '24px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [inputText]);

  useEffect(() => {
    if (!initialQuery.trim()) return;
    setInputText(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setFeedbackThumb(null);
    setFeedbackRating(null);
    setFeedbackComment('');
    setFeedbackStatus('');
  }, [result?.query]);

  useEffect(() => {
    void refreshUsageSummary();
  }, [userId]);

  const statusRows = useMemo(() => {
    const counts = result?.counts ?? liveCounts;
    return [
      { label: 'Support', color: 'bg-blue-600', count: counts.support_pct ?? 0 },
      { label: 'Neutral', color: 'bg-sky-400', count: counts.neutral_pct ?? 0 },
      { label: 'Contradiction', color: 'bg-indigo-600', count: counts.contradict_pct ?? 0 },
    ];
  }, [result, liveCounts]);

  const sourceRows = result?.sources?.length ? result.sources : liveSources;
  const graphData = liveGraph.nodes.length ? liveGraph : result?.graph ?? EMPTY_GRAPH;

  const appendProcessing = (line: string) => {
    setProcessingStream((prev) => {
      const compact = trimText(line, 320);
      if (!compact || prev[prev.length - 1] === compact) return prev;
      return [...prev.slice(-7), compact];
    });
  };

  const setStepFromEvent = (eventType: string, payload: Record<string, any>) => {
    switch (eventType) {
      case 'investigation_started':
        setActiveStepLabel('loading confidence model');
        break;
      case 'structured_claim':
        setActiveStepLabel('structuring claim');
        break;
      case 'pass_started':
      case 'retrieval_bundle_started':
      case 'retrieval_query_started':
      case 'retrieval_document_found':
        setActiveStepLabel(`retrieval pass ${payload.pass_index ?? 1}`);
        break;
      case 'parse_document_started':
      case 'parse_document_completed':
        setActiveStepLabel('parsing content');
        break;
      case 'evidence_assessment_started':
      case 'evidence_assessment_completed':
        setActiveStepLabel('scoring evidence');
        break;
      case 'prediction_updated':
        setActiveStepLabel('confidence model');
        break;
      case 'refinement_started':
        setActiveStepLabel(`refining queries for retry ${payload.retry_index ?? ''}`.trim());
        break;
      case 'final_result':
        setActiveStepLabel('generating final summary');
        break;
      case 'error':
        setActiveStepLabel('error');
        break;
      default:
        break;
    }
  };

  const incrementCounts = (label: 'support' | 'contradict' | 'neutral') => {
    setLiveCounts((prev) => {
      const next = {
        ...prev,
        total: prev.total + 1,
        support: prev.support + (label === 'support' ? 1 : 0),
        neutral: prev.neutral + (label === 'neutral' ? 1 : 0),
        contradict: prev.contradict + (label === 'contradict' ? 1 : 0),
      };
      return {
        ...next,
        support_pct: next.total ? Math.round((next.support / next.total) * 100) : 0,
        neutral_pct: next.total ? Math.round((next.neutral / next.total) * 100) : 0,
        contradict_pct: next.total ? Math.round((next.contradict / next.total) * 100) : 0,
      };
    });
  };

  const handleStreamEvent = (event: StreamEvent) => {
    const payload = event.payload || {};
    setStepFromEvent(event.type, payload);
    switch (event.type) {
      case 'investigation_started': {
        lastSourceRef.current = null;
        setLiveGraph({
          nodes: [
            {
              id: 'start',
              group: 'event',
              label: 'Start',
              val: 11,
              confidence: 100,
              summary: payload.query || '',
              stance: 'start',
            },
          ],
          links: [],
        });
        setLiveSources([]);
        setLiveCounts(EMPTY_COUNTS);
        setProcessingStream([`Investigation started for: ${payload.query}`]);
        appendProcessing(`Provider selected: ${payload.provider}`);
        break;
      }
      case 'structured_claim': {
        appendProcessing(`Structured claim: ${payload.normalized_claim}`);
        break;
      }
      case 'pass_started': {
        appendProcessing(`Pass ${payload.pass_index} started.`);
        break;
      }
      case 'retrieval_query_started': {
        appendProcessing(`Searching: ${payload.query}`);
        break;
      }
      case 'retrieval_document_found': {
        const sourceId = `source:${payload.url}`;
        const previousSourceId = lastSourceRef.current;
        setLiveGraph((prev) => {
          let next = upsertNode(prev, {
            id: sourceId,
            group: sourceGroupFromDomain(payload.source || ''),
            label: payload.source || payload.title || 'source',
            val: 12,
            confidence: Math.max(45, Math.round((payload.retrieval_score || 0.5) * 100)),
            summary: `Visited from search: ${trimText(payload.query || '', 72)}. ${trimText(payload.title || payload.snippet || '', 110)}`,
            stance: 'source',
            url: payload.url,
            domain: payload.source,
          });
          next = upsertLink(next, { source: previousSourceId || 'start', target: sourceId, label: 'visited' });
          return next;
        });
        lastSourceRef.current = sourceId;
        appendProcessing(`Visited ${payload.source}: ${trimText(payload.title || '', 80)}`);
        break;
      }
      case 'parse_document_completed': {
        const sourceId = `source:${payload.url}`;
        setLiveGraph((prev) => {
          return upsertNode(prev, {
            id: sourceId,
            group: sourceGroupFromDomain(payload.source || ''),
            label: payload.source || 'source',
            val: 12,
            confidence: Math.max(45, Math.round((payload.quality_score || 0.5) * 100)),
            summary: `Visited and parsed via ${payload.extraction_method}. ${trimText(payload.preview || '', 150)}`,
            stance: 'visited',
            url: payload.url,
            domain: payload.source,
          });
        });
        appendProcessing(`Parsed ${payload.source} using ${payload.extraction_method}.`);
        break;
      }
      case 'evidence_assessment_completed': {
        setLiveGraph((prev) => {
          return upsertNode(prev, {
            id: `source:${payload.url}`,
            group: sourceGroupFromDomain(payload.source || ''),
            label: payload.source || 'source',
            val: 13,
            confidence: Math.max(45, Math.round((payload.confidence_score || 0.5) * 100)),
            summary: `${String(payload.label || 'neutral').toUpperCase()}: ${trimText(payload.evidence_excerpt || payload.reasoning || '', 160)}`,
            stance: payload.label || 'neutral',
            url: payload.url,
            domain: payload.source,
          });
        });
        setLiveSources((prev) => {
          const nextItem = {
            id: `live-${slugId(payload.url || payload.source || payload.title || 'source')}`,
            domain: payload.source || 'unknown',
            title: payload.title || payload.source || 'source',
            url: payload.url || '',
            stance: (payload.label || 'neutral') as 'support' | 'contradict' | 'neutral',
            confidence: payload.confidence_score || 0,
            relevance: payload.relevance_score || 0,
            excerpt: payload.evidence_excerpt || payload.reasoning || '',
            fetch_status: 'judged',
          };
          const existingIndex = prev.findIndex((item) => item.url === nextItem.url);
          if (existingIndex === -1) return [nextItem, ...prev].slice(0, 6);
          const next = [...prev];
          next[existingIndex] = nextItem;
          return next;
        });
        incrementCounts((payload.label || 'neutral') as 'support' | 'contradict' | 'neutral');
        appendProcessing(`${payload.source} judged as ${payload.label}: ${trimText(payload.evidence_excerpt || payload.reasoning || '', 90)}`);
        break;
      }
      case 'prediction_updated': {
        appendProcessing(`Verdict updated to ${payload.predicted_label} at ${Number(payload.mean_confidence || 0).toFixed(2)} confidence.`);
        break;
      }
      case 'refinement_started': {
        appendProcessing(`Low confidence triggered retry ${payload.retry_index}.`);
        break;
      }
      case 'log': {
        appendProcessing(payload.message || 'Processing...');
        break;
      }
      case 'final_result': {
        const verification = payload as VerificationResponse;
        setResult(verification);
        setLiveCounts(verification.counts);
        setLiveSources(verification.sources);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: verification.assistant_message,
            timestamp: new Date(),
          },
        ]);
        setGraphKey((prev) => prev + 1);
        appendProcessing(`Final verdict: ${verification.verdict.label}.`);
        completedInvestigationsRef.current += 1;
        if (activeInvestigationRef.current?.id) {
          void (async () => {
            await finalizeInvestigationRecord({
              investigationId: activeInvestigationRef.current!.id!,
              assistantMessage: verification.assistant_message,
              answer: verification.final_answer.direct_answer,
              sources: verification.sources,
              result: verification,
              verdictLabel: verification.verdict.label,
              confidence: verification.verdict.confidence,
              uncertainty: verification.verdict.uncertainty,
              retriesUsed: verification.verdict.retries_used,
              durationMs: Date.now() - activeInvestigationRef.current!.startedAt,
              status: 'completed',
            });
            await refreshUsageSummary();
          })();
        }
        void touchTrackedSession(trackedSessionId);
        break;
      }
      case 'error': {
        const message = payload.message || 'The verification request failed.';
        setError(message);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `I couldn't complete that investigation. ${message}`,
            timestamp: new Date(),
          },
        ]);
        break;
      }
      default:
        break;
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isThinking) return;

    const query = inputText.trim();
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsThinking(true);
    setError('');
    setResult(null);
    setLiveGraph(EMPTY_GRAPH);
    setLiveSources([]);
    setLiveCounts(EMPTY_COUNTS);
    setProcessingStream([]);
    setActiveStepLabel('loading confidence model');
    setFeedbackStatus('');

    let investigationId: string | null = null;
    if (userId) {
      investigationId = await createInvestigationRecord({
        userId,
        trackedSessionId,
        query,
        provider: 'duckduckgo',
        reformulated: completedInvestigationsRef.current > 0,
      });
      await touchTrackedSession(trackedSessionId);
    }

    activeInvestigationRef.current = {
      id: investigationId,
      query,
      startedAt: Date.now(),
      copied: false,
      shared: false,
    };
    requestAbortRef.current = new AbortController();

    try {
      const sessionData = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const accessToken = sessionData.data.session?.access_token;

      if (!accessToken) {
        throw new Error('Your session expired. Please sign in again.');
      }

      const signal = requestAbortRef.current.signal;
      await ensureBackendAwake(signal);

      const runStream = async () => {
        const response = await fetch(`${API_BASE_URL}/api/verify/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          signal,
          body: JSON.stringify({ query, provider: 'duckduckgo' }),
        });

        if (!response.ok || !response.body) {
          const message = await readErrorMessage(response, 'The verification stream request failed.');
          throw new Error(message);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedFinalResult = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const event = JSON.parse(trimmed) as StreamEvent;
            if (event.type === 'final_result') {
              receivedFinalResult = true;
            }
            handleStreamEvent(event);
          }
        }

        if (buffer.trim()) {
          const event = JSON.parse(buffer.trim()) as StreamEvent;
          if (event.type === 'final_result') {
            receivedFinalResult = true;
          }
          handleStreamEvent(event);
        }

        return receivedFinalResult;
      };

      let streamCompletedWithFinal = false;
      try {
        streamCompletedWithFinal = await runStream();
      } catch (error) {
        if (isLikelyNetworkError(error)) {
          await waitFor(NETWORK_RETRY_DELAY_MS);
          streamCompletedWithFinal = await runStream();
        } else {
          throw error;
        }
      }

      if (!streamCompletedWithFinal) {
        const fallbackResponse = await fetch(`${API_BASE_URL}/api/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          signal,
          body: JSON.stringify({ query, provider: 'duckduckgo' }),
        });

        if (!fallbackResponse.ok) {
          const message = await readErrorMessage(fallbackResponse, 'The verification request failed.');
          throw new Error(message);
        }

        const verification = (await fallbackResponse.json()) as VerificationResponse;
        handleStreamEvent({ type: 'final_result', payload: verification as unknown as Record<string, any> });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Investigation stopped.',
            timestamp: new Date(),
          },
        ]);
        setFeedbackStatus('Investigation stopped.');
        return;
      }
      const message = err instanceof Error ? err.message : 'Something went wrong while contacting the backend.';
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `I couldn't complete that investigation. ${message}`,
          timestamp: new Date(),
        },
      ]);
      if (activeInvestigationRef.current?.id) {
        await finalizeInvestigationRecord({
          investigationId: activeInvestigationRef.current.id,
          status: 'failed',
          durationMs: Date.now() - activeInvestigationRef.current.startedAt,
          errorMessage: message,
        });
        await refreshUsageSummary();
      }
    } finally {
      requestAbortRef.current = null;
      setIsThinking(false);
    }
  };

  const ensureBackendAwake = async (signal: AbortSignal) => {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/health`, {
          method: 'GET',
          cache: 'no-store',
          signal,
        });
        if (response.ok) return;
        lastError = new Error(`Backend health check returned ${response.status}.`);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        lastError = error;
      }
      if (attempt < 3) {
        await waitFor(NETWORK_RETRY_DELAY_MS * attempt);
      }
    }
    throw new Error(
      isLikelyNetworkError(lastError)
        ? 'The backend is waking up or unreachable right now. Please retry in a few seconds.'
        : (lastError instanceof Error ? lastError.message : 'Backend health check failed.')
    );
  };

  const readErrorMessage = async (response: Response, fallback: string) => {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 429) {
      return payload?.detail || 'Demo limit reached. Free users can run 5 investigations per day.';
    }
    if (response.status === 401) {
      return payload?.detail || 'Please sign in again to continue.';
    }
    if (response.status === 403) {
      return payload?.detail || 'Your account cannot run investigations right now.';
    }
    return payload?.detail || fallback;
  };

  const handleStopInvestigation = () => {
    requestAbortRef.current?.abort();
  };

  const handleCopyAnswer = async () => {
    if (!result) return;

    await navigator.clipboard.writeText(result.final_answer.direct_answer || result.assistant_message);
    if (activeInvestigationRef.current) {
      activeInvestigationRef.current.copied = true;
      if (userId && activeInvestigationRef.current.id) {
        await recordInvestigationEvent({
          userId,
          investigationId: activeInvestigationRef.current.id,
          eventType: 'answer_copied',
          payload: { query: activeInvestigationRef.current.query },
        });
      }
    }
    setFeedbackStatus('Answer copied.');
  };

  const handleShareAnswer = async () => {
    if (!result) return;

    const sharePayload = {
      title: 'One Mind Investigation',
      text: result.final_answer.direct_answer || result.assistant_message,
      url: window.location.href,
    };

    if (navigator.share) {
      await navigator.share(sharePayload);
    } else {
      await navigator.clipboard.writeText(`${sharePayload.text}\n\n${sharePayload.url}`);
    }

    if (activeInvestigationRef.current) {
      activeInvestigationRef.current.shared = true;
      if (userId && activeInvestigationRef.current.id) {
        await recordInvestigationEvent({
          userId,
          investigationId: activeInvestigationRef.current.id,
          eventType: 'answer_shared',
          payload: { query: activeInvestigationRef.current.query },
        });
      }
    }
    setFeedbackStatus(navigator.share ? 'Shared successfully.' : 'Share link copied.');
  };

  const handleFeedbackSubmit = async () => {
    if (!userId || !activeInvestigationRef.current?.id) return;

    setFeedbackBusy(true);
    const response = await submitFeedbackRecord({
      userId,
      investigationId: activeInvestigationRef.current.id,
      thumb: feedbackThumb,
      rating: feedbackRating,
      comment: feedbackComment.trim(),
      copied: activeInvestigationRef.current.copied,
      shared: activeInvestigationRef.current.shared,
    });

    if (response.ok) {
      await recordInvestigationEvent({
        userId,
        investigationId: activeInvestigationRef.current.id,
        eventType: 'feedback_submitted',
        payload: {
          thumb: feedbackThumb,
          rating: feedbackRating,
          hasComment: Boolean(feedbackComment.trim()),
        },
      });
      setFeedbackStatus('Feedback saved. Thank you.');
    } else {
      setFeedbackStatus('Feedback could not be saved yet.');
    }

    setFeedbackBusy(false);
  };

  const handleExampleClick = (query: string) => {
    setInputText(query);
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#f8fafc] text-slate-900 font-sans">
      <header className="h-16 px-8 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-white border border-orange-100 flex items-center justify-center text-[#f59e0b] shadow-md shadow-orange-100/80 transition-transform group-hover:scale-110">
            <OneMindLogo size={26} className="transition-colors" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-800">One Mind</h1>
        </div>

        <div className="flex items-center gap-3">
          {!usageSummary.isAdmin ? (
            <>
              <div className="hidden rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f59e0b] md:inline-flex">
                Demo account: {usageSummary.dailyLimit} investigations per day
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">
                <span className="text-slate-400">Usage</span>
                <span className="text-slate-900">{usageSummary.usedToday} / {usageSummary.dailyLimit}</span>
              </div>
            </>
          ) : null}
          {onBack ? (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:border-orange-200 hover:text-[#f59e0b]"
            >
              <ArrowLeft size={14} />
              Home
            </button>
          ) : null}
          {onSignOut ? (
            <button
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:border-rose-200 hover:text-[#d1065e]"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          ) : null}
        </div>
      </header>

      <main className="flex-1 h-[calc(100vh-64px)] overflow-hidden flex items-stretch relative">
        <aside className="w-[420px] flex-shrink-0 flex flex-col bg-white border-r border-slate-200 relative sticky top-16 h-[calc(100vh-64px)] shadow-[10px_0_40px_rgba(0,0,0,0.04)] z-20 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth scrollbar-hide">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`
                    max-w-[85%] px-5 py-4 rounded-[24px] text-sm leading-relaxed font-medium whitespace-pre-wrap
                    ${msg.role === 'user'
                      ? 'bg-gradient-to-br from-[#fa7e1e] to-[#d62976] text-white rounded-tr-none shadow-lg shadow-orange-500/10'
                      : 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100'}
                  `}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2 px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {!isThinking && messages.length === 1 && (
              <div className="space-y-3 -mt-2">
                <div className="px-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Try one</span>
                </div>
                {EXAMPLE_QUERIES.map((query) => (
                  <button
                    key={query}
                    onClick={() => handleExampleClick(query)}
                    className="w-full text-left rounded-[20px] border border-slate-100 bg-white px-4 py-4 text-sm font-semibold leading-relaxed text-slate-600 shadow-sm hover:border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    {query}
                  </button>
                ))}
              </div>
            )}

            {isThinking && (
              <div className="flex flex-col items-start animate-in fade-in duration-300">
                <div className="bg-slate-50 text-slate-400 px-5 py-4 rounded-[24px] rounded-tl-none border border-slate-100 flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest">Tracing live investigation...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {isThinking && (
            <div className="px-6 py-2 mx-6 -mb-4 relative z-30">
              <div className="bg-white border border-slate-100 rounded-2xl px-5 py-3 flex items-center justify-between shadow-2xl shadow-slate-200/50 animate-in slide-in-from-bottom-6 fade-in duration-700">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                  <span className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {activeStepLabel}
                  </span>
                </div>
                <RefreshCw size={14} className="text-orange-500 animate-spin" />
              </div>
            </div>
          )}

          <div className="bg-white border-t border-slate-100 p-6 pt-4">
            <div className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-[28px] border border-slate-100 focus-within:bg-white focus-within:border-slate-200 transition-all shadow-sm">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask a web intelligence question..."
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none min-h-[24px] max-h-[140px] overflow-y-auto text-[15px] leading-6 font-medium text-slate-800 placeholder:text-slate-400 p-0 focus:outline-none"
              />
              <button
                onClick={isThinking ? handleStopInvestigation : handleSendMessage}
                disabled={!isThinking && !inputText.trim()}
                className={`group h-12 shrink-0 rounded-full border flex items-center justify-center shadow-md transition-all active:scale-95 ${
                  isThinking
                    ? 'min-w-[96px] gap-2 border-rose-200 bg-white px-4 text-rose-600 shadow-rose-100/70 hover:bg-rose-50 hover:shadow-lg'
                    : 'w-12 border-orange-100 bg-white text-[#f59e0b] shadow-orange-100/70 hover:shadow-lg hover:bg-[#f59e0b] hover:text-white hover:border-[#f59e0b] hover:scale-105'
                } disabled:opacity-30 disabled:scale-100`}
              >
                {isThinking ? (
                  <>
                    <Square size={14} className="fill-current" />
                    <span className="text-xs font-black uppercase tracking-[0.18em]">Stop</span>
                  </>
                ) : (
                  <OneMindLogo size={24} className="transition-all group-hover:scale-105" />
                )}
              </button>
            </div>
          </div>
        </aside>

        <section ref={workspaceScrollRef} className="flex-1 h-full overflow-y-auto overflow-x-hidden flex flex-col bg-[#f1f5f9] p-6 border-l border-slate-100 transition-all duration-500 min-w-0">
          <div className="h-[calc(100vh-112px)] shrink-0 flex flex-col">
            <div className="relative flex-1 mt-2 flex flex-col min-h-0">
              <div className="absolute top-4 left-4 z-20 pointer-events-none">
                <div className="px-4 py-1.5 bg-white shadow-2xl shadow-slate-200/50 rounded-xl border border-slate-50 pointer-events-auto">
                  <div className="flex items-center gap-2.5">
                    <Activity size={14} className="text-[#fa7e1e]" />
                    <span className="text-[12px] font-bold uppercase tracking-widest text-slate-700">Investigation Trace</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden" key={graphKey}>
                <MindPixelsGraph
                  isProcessing={isThinking}
                  isActive={true}
                  activeQuery={isThinking ? inputText : result?.claim.normalized_claim}
                  graphData={graphData}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-6 shrink-0">
            {!usageSummary.isAdmin ? (
              <div className="rounded-[20px] border border-orange-100 bg-[linear-gradient(135deg,_rgba(255,247,237,0.95),_rgba(255,255,255,1))] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#f59e0b]">Demo Quota</p>
                    <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">
                      {usageSummary.usedToday} of {usageSummary.dailyLimit} investigations used today
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      This demo includes {usageSummary.dailyLimit} investigations per day for standard users. Your limit resets daily.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-right shadow-sm">
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Remaining</span>
                    <span className="mt-1 block text-2xl font-black text-slate-900">
                      {Math.max(usageSummary.dailyLimit - usageSummary.usedToday, 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="bg-white rounded-[20px] p-8 shadow-sm border border-slate-100 flex flex-col">
              <div className="mb-6">
                <span className="text-[18px] font-black uppercase tracking-[0.2em] text-slate-400">Status Alignment</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {statusRows.map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-8 bg-slate-50/50 rounded-2xl border border-slate-100/50 group hover:bg-white hover:shadow-sm transition-all min-h-[220px]">
                    <div className="flex items-center gap-4">
                      <div className={`w-3.5 h-3.5 rounded-full ${item.color} shadow-sm`}></div>
                      <span className="text-[13px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                    </div>
                    <span className="text-4xl font-bold text-slate-800 tracking-tight">{item.count}%</span>
                  </div>
                ))}
              </div>
            </div>

            {result && (
              <div className="bg-white rounded-[20px] p-8 shadow-sm border border-slate-100 flex flex-col gap-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="text-[15px] font-black uppercase tracking-[0.2em] text-emerald-500">Verdict Snapshot</span>
                    <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{result.final_answer.direct_answer}</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">{result.final_answer.reasoning_summary}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void handleCopyAnswer()}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:border-orange-200 hover:text-[#f59e0b]"
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShareAnswer()}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:border-orange-200 hover:text-[#f59e0b]"
                    >
                      <Share2 size={14} />
                      Share
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Quality Feedback</p>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setFeedbackThumb('up')}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${feedbackThumb === 'up' ? 'bg-emerald-100 text-emerald-700' : 'border border-slate-200 bg-white text-slate-500'}`}
                      >
                        <ThumbsUp size={14} />
                        Helpful
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedbackThumb('down')}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all ${feedbackThumb === 'down' ? 'bg-rose-100 text-rose-700' : 'border border-slate-200 bg-white text-slate-500'}`}
                      >
                        <ThumbsDown size={14} />
                        Needs work
                      </button>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFeedbackRating(value)}
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold transition-all ${feedbackRating === value ? 'bg-[#fff1e7] text-[#f59e0b]' : 'border border-slate-200 bg-white text-slate-500'}`}
                        >
                          <Star size={14} className={feedbackRating === value ? 'fill-current' : ''} />
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">What should improve?</p>
                    <textarea
                      value={feedbackComment}
                      onChange={(event) => setFeedbackComment(event.target.value)}
                      placeholder="Tell us what felt useful, weak, or missing in this answer."
                      className="mt-4 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-orange-200"
                    />
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">Copy and share actions are stored with this answer.</span>
                      <button
                        type="button"
                        onClick={() => void handleFeedbackSubmit()}
                        disabled={feedbackBusy || (!feedbackThumb && !feedbackRating && !feedbackComment.trim())}
                        className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,_#ffb084_0%,_#d1065e_100%)] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_24px_rgba(219,68,120,0.20)] transition-all disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {feedbackBusy ? 'Saving...' : 'Save Feedback'}
                      </button>
                    </div>
                    {feedbackStatus ? <p className="mt-3 text-sm text-slate-500">{feedbackStatus}</p> : null}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[20px] p-8 shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[15px] font-black uppercase tracking-[0.2em] text-purple-400">Source Judgments</span>
                <Globe size={18} className="text-purple-500" />
              </div>
              <div className="space-y-2.5 overflow-y-auto pr-1 scrollbar-hide min-h-[220px]">
                {sourceRows.slice(0, 6).map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      if (!userId || !activeInvestigationRef.current?.id) return;
                      void recordSourceClick({
                        userId,
                        investigationId: activeInvestigationRef.current.id,
                        sourceUrl: item.url,
                        sourceDomain: item.domain,
                        sourceTitle: item.title,
                        stance: item.stance,
                      });
                      void recordInvestigationEvent({
                        userId,
                        investigationId: activeInvestigationRef.current.id,
                        eventType: 'source_clicked',
                        payload: {
                          url: item.url,
                          domain: item.domain,
                          title: item.title,
                          stance: item.stance,
                        },
                      });
                    }}
                    className="flex items-center justify-between p-5 bg-slate-50/50 rounded-xl border border-slate-100/50 group hover:bg-white hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="px-2 py-1 bg-purple-100 text-purple-600 rounded-lg text-[13px] font-black font-mono shrink-0">
                        {Math.round(item.confidence * 100)}%
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[16px] font-bold text-slate-700 truncate">{item.domain}</span>
                        <span className="text-[13px] font-black text-purple-400 uppercase tracking-tighter">{item.stance}</span>
                        <span className="text-[12px] text-slate-500 line-clamp-2">{trimText(item.excerpt, 110)}</span>
                      </div>
                    </div>
                    <span className="text-[12px] font-mono font-bold text-slate-400 uppercase shrink-0">{item.fetch_status}</span>
                  </a>
                ))}
                {!sourceRows.length && (
                  <div className="p-5 bg-slate-50/50 rounded-xl border border-slate-100/50 text-sm text-slate-500">
                    Source judgments will appear here as each website is retrieved and classified.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[20px] p-8 shadow-sm border border-slate-100 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[15px] font-black uppercase tracking-[0.2em] text-[#fa7e1e]">Processing Stream</span>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Live</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2.5 scrollbar-hide text-slate-600 font-mono text-[14px] leading-relaxed min-h-[220px]">
                {(result?.processing_stream?.length ? result.processing_stream : processingStream).map((row, index) => (
                  <p key={index} className={index === (result?.processing_stream?.length ? result.processing_stream : processingStream).length - 1 ? 'opacity-100 text-slate-900 font-bold' : 'opacity-90'}>
                    [{String(index + 1).padStart(2, '0')}] {row}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
