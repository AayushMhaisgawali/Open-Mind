
import React from 'react';
import { Search, Brain, FileSearch, BarChart3, CheckCircle2 } from 'lucide-react';

export type PipelineStep = 'idle' | 'query' | 'search' | 'extract' | 'analyze' | 'result';

interface PipelineProps {
  currentStep: PipelineStep;
}

const steps = [
  { id: 'query', label: 'Query', icon: Search },
  { id: 'search', label: 'Search', icon: FileSearch },
  { id: 'extract', label: 'Extract', icon: Brain },
  { id: 'analyze', label: 'Analyze', icon: BarChart3 },
  { id: 'result', label: 'Result', icon: CheckCircle2 }
];

export const Pipeline: React.FC<PipelineProps> = ({ currentStep }) => {
  const getStepIndex = (step: PipelineStep) => {
    return steps.findIndex(s => s.id === step);
  };

  const activeIndex = getStepIndex(currentStep);

  return (
    <div className="w-full max-w-5xl mx-auto my-12 px-4">
      <div className="relative flex justify-between items-center sm:px-10">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -translate-y-1/2 -z-10 mx-10 sm:mx-20"></div>

        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index <= activeIndex && currentStep !== 'idle';
          const isCurrent = index === activeIndex;

          return (
            <div key={step.id} className="flex flex-col items-center gap-3 relative">
              <div 
                className={`
                  w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-xl
                  ${isActive 
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 scale-110 shadow-blue-500/20' 
                    : 'bg-slate-900 border border-slate-700 text-slate-500'
                  }
                  ${isCurrent ? 'ring-4 ring-blue-500/20 animate-pulse outline outline-1 outline-blue-400/50' : ''}
                `}
              >
                <Icon size={28} />
              </div>
              <span 
                className={`
                  text-sm font-semibold transition-colors duration-300
                  ${isActive ? 'text-blue-400' : 'text-slate-500'}
                  ${isCurrent ? 'text-blue-300 font-bold' : ''}
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
