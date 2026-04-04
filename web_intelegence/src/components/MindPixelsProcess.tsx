
import React from 'react';
import { 
  Puzzle, 
  Search, 
  Database, 
  BarChart3, 
  Scale, 
  FileText,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface MindPixelsProcessProps {
  currentStep: number;
  isProcessing: boolean;
}

export const MindPixelsProcess: React.FC<MindPixelsProcessProps> = ({ currentStep, isProcessing }) => {
  const steps = [
    { id: 1, icon: <Puzzle size={14} />, title: 'Understanding', desc: 'Neural parsing' },
    { id: 2, icon: <Search size={14} />, title: 'Planning',      desc: 'Optimization' },
    { id: 3, icon: <Database size={14} />, title: 'Retrieval',    desc: 'Extraction' },
    { id: 4, icon: <BarChart3 size={14} />, title: 'Classify',     desc: 'Semantics' },
    { id: 5, icon: <Scale size={14} />, title: 'Estimation',   desc: 'Bayesian' },
    { id: 6, icon: <FileText size={14} />, title: 'Synthesis',    desc: 'Verdict' },
  ];

  return (
    <div className="space-y-4 h-full overflow-y-auto scrollbar-hide">
      {steps.map((step, idx) => {
        const isActive = isProcessing && currentStep === idx + 1;
        const isCompleted = isProcessing && currentStep > idx + 1;

        return (
          <div 
            key={step.id} 
            className={`p-3 rounded-xl border transition-all duration-500 relative ${isActive ? 'bg-blue-50 border-blue-100 shadow-sm' : 'border-slate-100 bg-white opacity-40'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                 {isCompleted ? <CheckCircle2 size={12} /> : step.icon}
              </div>
              <div className="min-w-0">
                 <h4 className={`text-[9px] font-bold uppercase tracking-widest leading-none mb-1 ${isActive ? 'text-blue-700' : 'text-slate-900'}`}>
                    {step.title}
                 </h4>
                 {isActive && (
                    <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-600 uppercase animate-pulse">
                        <Clock size={8} /> Active
                    </div>
                 )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
