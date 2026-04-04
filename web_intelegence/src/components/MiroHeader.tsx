
import React from 'react';

export const MiroHeader: React.FC<{ currentStep: number; onHome?: () => void }> = ({ currentStep, onHome }) => {
  return (
    <header className="h-16 border-b border-white/10 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between z-50 sticky top-0">
      <div className="flex items-center gap-6">
        <button onClick={onHome} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center transform rotate-12">
            <span className="text-white font-black text-xl italic">M</span>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            MiroIntelligence
          </span>
        </button>
        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          <button className="px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-slate-400">Knowledge Map</button>
          <button className="px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-white/10 text-white">Dual View</button>
          <button className="px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider text-slate-400">Workbench</button>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Step <span className="text-blue-500">{currentStep}/5</span> 
          <span className="h-4 w-[1px] bg-white/10"></span>
          <span className="text-slate-300">Analysis Mode</span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <button className="p-2 hover:bg-white/5 rounded-full transition-colors border border-white/10 text-slate-300">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.28 1.15-.28 2.35 0 3.5-.73 1.02-1.08 2.25-1 3.5 0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-3-7-3"></path></svg>
        </button>
      </div>
    </header>
  );
};
