
import React, { useState } from 'react';
import { AgentGraph } from './AgentGraph';
import { SearchBar } from './SearchBar';
import { ResultCard } from './ResultCard';
import { mockData, Evidence } from '../mockData';
import { Brain, Sparkles, Activity, ShieldCheck, Database, ArrowLeft } from 'lucide-react';
import { PipelineStep } from './Pipeline';


export const WebIntelligenceSystem: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<PipelineStep>('idle');
  const [claim, setClaim] = useState('');
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [confidence, setConfidence] = useState(0);

  const simulateProcessing = async (currentClaim: string) => {
    setIsProcessing(true);
    setShowResults(false);
    setClaim(currentClaim);

    // Sequence of steps
    const steps: PipelineStep[] = ['query', 'search', 'extract', 'analyze', 'result'];
    for (const step of steps) {
      setCurrentStep(step);
      await new Promise(r => setTimeout(r, 1000));
      if (step === 'extract') {
        setEvidence([...mockData].sort(() => Math.random() - 0.5).slice(0, 8));
      }
      if (step === 'analyze') {
        setConfidence(Math.floor(Math.random() * 40 + 60)); // 60-100
      }
    }

    setIsProcessing(false);
    setShowResults(true);
  };

  const handleReset = () => {
    setClaim('');
    setCurrentStep('idle');
    setShowResults(false);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 overflow-x-hidden">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-50 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 flex flex-col min-h-screen">
        {/* Simple Header */}
        <header className="flex items-center justify-between mb-20">
          <button onClick={handleReset} className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform shadow-lg shadow-slate-900/10">
              <Brain size={24} className="text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase italic">Reality Engine</span>
          </button>
          
          {claim && (
            <button 
              onClick={handleReset}
              className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:shadow-sm transition-all flex items-center gap-2"
            >
              <ArrowLeft size={14} /> New Search
            </button>
          )}
        </header>

        {/* Central Content */}
        <div className="flex-1 flex flex-col">
          {currentStep === 'idle' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
              <div className="w-20 h-20 bg-blue-600/5 border border-blue-600/10 rounded-3xl flex items-center justify-center mb-10 text-blue-600 transform rotate-12 shadow-inner">
                <Sparkles size={40} />
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tighter leading-none">
                Verify any <span className="text-blue-600 underline decoration-blue-600/20 underline-offset-[12px] decoration-4">Information</span>
              </h1>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto font-normal leading-relaxed mb-12">
                Our multi-agent neural network cross-references global databases to verify claims and visualize evidence links in real-time.
              </p>
              <div className="w-full">
                <SearchBar 
                  onSearch={simulateProcessing} 
                  isProcessing={isProcessing} 
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col animate-in fade-in duration-700">
              {/* Investigation Title Overlay */}
              <div className="mb-6 p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Investigation Query</div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">"{claim}"</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Engine Status</div>
                    <div className="text-xs font-bold text-blue-600 uppercase tracking-widest animate-pulse">{currentStep}...</div>
                  </div>
                </div>
              </div>

              {/* Centered Graph Area */}
              <div className="flex-1 min-h-[500px] relative rounded-[2.5rem] border border-slate-100 bg-white overflow-hidden shadow-xl shadow-slate-200/50">
                <AgentGraph currentStep={currentStep} />
                
                {showResults && (
                  <div className="absolute inset-0 z-40 bg-slate-50/40 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-full max-w-md shadow-2xl shadow-indigo-100">
                      <ResultCard confidence={confidence} />
                      <button 
                        onClick={handleReset}
                        className="w-full mt-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10"
                      >
                        Start Next Investigation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Minimal Footer */}
        <footer className="py-12 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 text-slate-400 mt-12">
          <div className="flex items-center gap-3">
            <Activity size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Real-time Telemetry Active</span>
          </div>
          <div className="flex items-center gap-3 justify-center">
            <ShieldCheck size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Truth-Pass Secured</span>
          </div>
          <div className="flex items-center gap-3 justify-end text-slate-400">
             <Database size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{mockData.length} Databases Synced</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
