
import React, { useEffect, useState, useRef } from 'react';

interface Log {
  time: string;
  msg: string;
}

export const SystemDashboard: React.FC<{ activeStep: string }> = ({ activeStep }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeStep === 'idle') {
      setLogs([{ time: new Date().toLocaleTimeString(), msg: 'SYSTEM READY. AWAITING QUERY...' }]);
      return;
    }

    const currentLogs: Record<string, string[]> = {
      query: [
        'POST /api/query/ontology/generate',
        'Extracting semantic tokens...',
        'Generated ontology metadata successfully.'
      ],
      search: [
        'GET /api/retrieval/v2/search',
        'Gathering evidence from 500+ nodes...',
        'Retrieved 132 relevant sources.'
      ],
      extract: [
        'POST /api/graph/graphRAG/build',
        'Building knowledge sub-graph...',
        '222 relationships identified.'
      ],
      analyze: [
        'POST /api/intelligence/verify/score',
        'Calculating confidence metrics...',
        'Neural fact-scoring complete.'
      ],
      result: [
        'POST /api/intelligence/conclude/final',
        'Synthesizing final verdict...',
        'Verdict: Likely True. System confidence: 89%.'
      ]
    };

    if (currentLogs[activeStep]) {
      const newLogs = currentLogs[activeStep].map(msg => ({
        time: new Date().toLocaleTimeString(),
        msg
      }));
      setLogs(prev => [...prev.slice(-12), ...newLogs]);
    }
  }, [activeStep]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="absolute bottom-6 right-6 w-[32rem] h-56 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col z-40 transition-all hover:border-blue-500/30">
      <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02] flex justify-between items-center shrink-0">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          System Dashboard / Terminal
        </div>
        <div className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
          proj_f95898d38529
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 p-4 font-mono text-[11px] leading-relaxed overflow-y-auto scrollbar-hide space-y-1">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-4 group">
            <span className="text-slate-600 shrink-0 select-none group-hover:text-blue-500 transition-colors">{log.time}</span>
            <span className="text-slate-300 font-bold group-hover:text-white transition-colors tracking-tight">{log.msg}</span>
          </div>
        ))}
        <div className="animate-pulse inline-block w-2 h-4 bg-blue-500/50 mt-1"></div>
      </div>
    </div>
  );
};
