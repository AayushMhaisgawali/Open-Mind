
import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info, Sparkles } from 'lucide-react';

interface ResultCardProps {
  confidence: number;
}

export const ResultCard: React.FC<ResultCardProps> = ({ confidence }) => {
  const getVerdict = (score: number) => {
    if (score >= 70) return { 
      label: 'Likely True', 
      icon: CheckCircle, 
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      description: 'Based on the analysis of multiple reliable sources, the claim is supported by current evidence.',
      shadow: 'shadow-emerald-500/20'
    };
    if (score >= 40) return { 
      label: 'Uncertain', 
      icon: AlertTriangle, 
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      description: 'The evidence is mixed or insufficient to make a definitive judgment at this time.',
      shadow: 'shadow-amber-500/20'
    };
    return { 
      label: 'Likely False', 
      icon: XCircle, 
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      description: 'Multiple credible sources contradict this claim, suggesting it is inaccurate or misleading.',
      shadow: 'shadow-rose-500/20'
    };
  };

  const verdict = getVerdict(confidence);
  const Icon = verdict.icon;

  return (
    <div className={`mt-10 mb-16 p-8 rounded-3xl border backdrop-blur-2xl relative overflow-hidden transition-all duration-700 shadow-2xl ${verdict.color} ${verdict.shadow}`}>
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles size={120} />
      </div>

      <div className="relative flex flex-col items-center text-center gap-4">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 shadow-lg">
          <Icon size={48} />
        </div>
        
        <div className="uppercase tracking-[0.2em] font-black text-sm opacity-50 mb-1">
          Final System Verdict
        </div>
        
        <h2 className="text-5xl font-black mb-1">
          {verdict.label}
        </h2>
        
        <div className="flex items-center gap-3 bg-white/5 px-6 py-2 rounded-full border border-white/10">
          <Info size={18} className="opacity-70" />
          <span className="text-base font-bold">
            {Math.round(confidence)}% System Confidence
          </span>
        </div>
        
        <p className="max-w-2xl text-lg font-medium leading-relaxed mt-4">
          {verdict.description}
        </p>

        <div className="mt-8 flex gap-4">
          <button className="bg-white/10 hover:bg-white/20 transition-all duration-300 py-2.5 px-6 rounded-xl border border-white/10 text-sm font-bold flex items-center gap-2">
            Download Report (PDF)
          </button>
          <button className="bg-white/10 hover:bg-white/20 transition-all duration-300 py-2.5 px-6 rounded-xl border border-white/10 text-sm font-bold flex items-center gap-2">
            Share Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
