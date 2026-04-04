
import React from 'react';
import { Database, BarChart3, ShieldCheck, Target } from 'lucide-react';
import { mockData } from '../mockData';

interface MindPixelsHeroProps {
  isProcessing: boolean;
}


export const MindPixelsHero: React.FC<MindPixelsHeroProps> = ({ isProcessing }) => {
  const uniqueSources = new Set(mockData.map(e => e.source)).size;

  return (
    <section className="px-10 py-12 relative animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto flex justify-center lg:justify-start">
        {/* Compact Knowledge Summary Box */}
        <div className="w-full max-w-[450px] bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          {/* Subtle Glow Background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-100 transition-colors"></div>
          
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-600/10">
                  <Database size={16} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">Knowledge Summary</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-lg font-black text-slate-900 tracking-tighter">{uniqueSources}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Total Sources</span>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase italic">
                Data Intel Unit
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Analyzing processed evidence across multiple domains and source vectors to verify reality seeds in real-time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
