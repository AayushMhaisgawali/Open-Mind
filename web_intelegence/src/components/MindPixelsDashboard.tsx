
import React, { useState } from 'react';
import { MindPixelsHeader } from './MindPixelsHeader';
import { MindPixelsGraph } from './MindPixelsGraph';
import { MindPixelsProcess } from './MindPixelsProcess';
import { MindPixelsMetrics } from './MindPixelsMetrics';
import { MindPixelsInput } from './MindPixelsInput';
import { MindPixelsAlerts } from './MindPixelsAlerts';
import { DataSummaryBox } from './DataSummaryBox';

export const MindPixelsDashboard: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [claim, setClaim] = useState('');
  const [confidence, setConfidence] = useState(0);

  const startAnalysis = async (newClaim: string) => {
    setClaim(newClaim);
    setIsProcessing(true);
    setCurrentStep(1);
    setConfidence(0);

    for (let i = 1; i <= 6; i++) {
        setCurrentStep(i);
        if (i === 5) setConfidence(Math.floor(Math.random() * 20 + 75));
        await new Promise(r => setTimeout(r, 2000));
    }

    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      <MindPixelsHeader isProcessing={isProcessing} />
      
      <main className="max-w-[1600px] mx-auto w-full px-6 py-8 flex flex-col gap-8">
        
        {/* Top Metrics Bar */}
        <section className="animate-in fade-in slide-in-from-top-4 duration-700">
           <MindPixelsMetrics isProcessing={isProcessing} confidence={confidence} />
        </section>

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Analysis Column */}
          <div className="lg:col-span-8 flex flex-col gap-8">
             {/* Unified Search Section */}
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-700 delay-100">
                <MindPixelsInput onSearch={startAnalysis} isProcessing={isProcessing} />
             </div>

             {/* Graph Visualization */}
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[640px] relative transition-all animate-in fade-in duration-700 delay-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Neural Graph Engine</h3>
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time Visualization</span>
                   </div>
                </div>
                <MindPixelsGraph isProcessing={isProcessing} />
             </div>
          </div>

          {/* Right Sidebar Info */}
          <div className="lg:col-span-4 flex flex-col gap-8">
             {/* Process Progression */}
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[480px] animate-in slide-in-from-right-4 fade-in duration-700 delay-300">
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Process Pipeline</h3>
                    <div className="flex gap-1">
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className={`w-1 h-1 rounded-full transition-colors ${currentStep >= i ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
                        ))}
                    </div>
                </div>
                <MindPixelsProcess currentStep={currentStep} isProcessing={isProcessing} />
             </div>

             {/* Alerts & Summary */}
             <div className="flex flex-col gap-6 flex-1">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[220px] animate-in slide-in-from-right-4 fade-in duration-700 delay-400">
                    <MindPixelsAlerts isProcessing={isProcessing} currentStep={currentStep} />
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500 animate-in slide-in-from-right-4 fade-in duration-700 delay-500">
                   <DataSummaryBox />
                </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};
