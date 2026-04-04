
import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface ProcessingPanelProps {
  currentStep: string;
  isProcessing: boolean;
}

const STEPS_DATA = [
  {
    id: 'query',
    num: '01',
    title: 'Ontology Recognition',
    subtitle: 'Extracting semantic seeds from natural language query...',
    path: 'POST /api/query/ontology/generate',
    entities: ['User-Intent', 'Subject', 'Context', 'Temporal-Marker', 'Entity-Type'],
    relations: ['IDENTIFIES_AS', 'BELONGS_TO', 'REFERENCES', 'MODIFIES'],
  },
  {
    id: 'search',
    num: '02',
    title: 'Multi-Source Retrieval',
    subtitle: 'Indexing evidence from 500+ global data nodes...',
    path: 'GET /api/retrieval/v2/search',
    entities: ['BBC-News', 'WHO-Database', 'Academic-MIT', 'Reuters-Feed', 'United Nations'],
    relations: ['SUPPORTS', 'CONTRADICTS', 'RELATE_TO', 'CRITICIZES'],
  },
  {
    id: 'extract',
    num: '03',
    title: 'Knowledge Sub-graph Construction',
    subtitle: 'Building local relationship clusters for evidence extraction...',
    path: 'POST /api/graph/graphRAG/build',
    entities: ['Evidence-A', 'Evidence-B', 'Evidence-C', 'Verification-Marker'],
    relations: ['LINKS_TO', 'STRENGTHENS', 'WEAKENS', 'VALIDATES'],
  },
  {
    id: 'analyze',
    num: '04',
    title: 'Neural Fact-Scoring',
    subtitle: 'Calculating cross-source credibility and confidence metrics...',
    path: 'POST /api/intelligence/verify/score',
    entities: ['Sentiment-Score', 'Credibility-Ratio', 'Bias-Marker', 'Confidence-Level'],
    relations: ['INFLUENCES', 'DETERMINES', 'AFFECTS', 'ESTABLISHES'],
  },
  {
    id: 'result',
    num: '05',
    title: 'Conclusion Generation',
    subtitle: 'Synthesizing final verdict and evidence summary...',
    path: 'POST /api/intelligence/conclude/final',
    entities: ['Final-Verdict', 'Certainty-Verdict', 'Summary-A', 'Summary-B'],
    relations: ['PRODUCES', 'DELIVERS', 'FINALIZES', 'OUTPUTS'],
  },
];

export const ProcessingPanel: React.FC<ProcessingPanelProps> = ({ currentStep, isProcessing }) => {
  const getStepIndex = (stepId: string) => STEPS_DATA.findIndex(s => s.id === stepId);
  const activeIdx = getStepIndex(currentStep);

  return (
    <div className="flex flex-col h-full bg-white/[0.02] border-l border-white/10 overflow-y-auto scrollbar-hide">
      <div className="p-8 space-y-12">
        {/* Statistics Hero */}
        {activeIdx >= 2 && (
          <div className="grid grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex flex-col items-center p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <span className="text-2xl font-black text-white">132</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Found Entities</span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <span className="text-2xl font-black text-white">222</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Relationships</span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <span className="text-2xl font-black text-white">9</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Graph Types</span>
            </div>
          </div>
        )}

        {STEPS_DATA.map((step, idx) => {
          const isCurrent = idx === activeIdx;
          const isDone = idx < activeIdx;
          const isLocked = idx > activeIdx;

          return (
            <div key={step.id} className={`transition-opacity duration-300 ${isLocked ? 'opacity-30' : 'opacity-100'}`}>
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <span className={`text-xl font-black italic tracking-tighter ${isCurrent ? 'text-blue-500 animate-pulse' : isDone ? 'text-emerald-500' : 'text-slate-700'}`}>
                      {step.num}
                    </span>
                    <div>
                      <h3 className="text-lg font-black text-slate-100 tracking-tight leading-none mb-1 uppercase">
                        {step.title}
                      </h3>
                      <p className="text-xs font-medium text-slate-400">
                        {isCurrent ? step.subtitle : isDone ? 'Processing complete.' : 'Awaiting input...'}
                      </p>
                    </div>
                  </div>
                  {isDone ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black italic text-emerald-400 uppercase tracking-wider">
                      <CheckCircle2 size={12} />
                      Complete
                    </span>
                  ) : isCurrent ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-[10px] font-black italic text-blue-400 uppercase tracking-wider">
                      <Loader2 size={12} className="animate-spin" />
                      Active
                    </span>
                  ) : null}
                </div>

                {/* Inside details (Card style like the photo) */}
                <div className={`p-5 rounded-2xl border transition-all duration-500 ${isCurrent ? 'bg-white/[0.05] border-white/20 shadow-2xl shadow-blue-500/10' : 'bg-transparent border-white/5'}`}>
                  <div className="font-mono text-[9px] text-slate-500 mb-4 px-3 py-1 bg-white/[0.03] rounded-md border border-white/5 inline-block">
                    {step.path}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 mb-3 uppercase tracking-widest">
                    Recognized Entities
                  </div>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {step.entities.map((ent) => (
                      <span key={ent} className="px-3 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[10px] font-bold text-slate-400 hover:text-white hover:border-white/20 cursor-default transition-all uppercase tracking-tight">
                        {ent}
                      </span>
                    ))}
                  </div>

                  <div className="text-[11px] font-medium text-slate-400 mb-3 uppercase tracking-widest">
                    Semantic Relationships
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {step.relations.map((rel) => (
                      <span key={rel} className="px-3 py-1 rounded-lg bg-white/[0.04] border border-white/15 text-[10px] font-bold text-slate-500 hover:text-white transition-all tracking-wide uppercase">
                        {rel}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
