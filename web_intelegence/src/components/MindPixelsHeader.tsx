
import React from 'react';
import { Github, Activity, Zap } from 'lucide-react';
import { OneMindLogo } from './OneMindLogo';

interface MindPixelsHeaderProps {
  isProcessing: boolean;
}

export const MindPixelsHeader: React.FC<MindPixelsHeaderProps> = ({ isProcessing }) => {
  return (
    <header className="h-20 px-10 flex items-center justify-between bg-white border-b border-slate-200 sticky top-0 z-[100] transition-all backdrop-blur-md bg-white/80">
      {/* Logo & Title */}
      <div className="flex items-center gap-4">
        <div className="relative group cursor-pointer">
          <div className="relative w-10 h-10 rounded-lg bg-white border border-orange-100 text-[#f59e0b] flex items-center justify-center shadow-lg shadow-orange-100/70 transform group-hover:scale-105 transition-all">
            <OneMindLogo size={24} className="transition-all group-hover:scale-105" />
          </div>
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none mb-1">
            MindPixels <span className="text-blue-600 font-medium">Intelligence</span>
          </h1>
          <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
             <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none">Enterprise Suite // Active</span>
          </div>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-6">
        {/* Status Badge */}
        <div className={`px-4 py-1.5 rounded-full border border-slate-200 flex items-center gap-2.5 transition-all duration-300 ${isProcessing ? 'bg-blue-50 border-blue-100' : 'bg-slate-50'}`}>
          <div className={`w-2 h-2 rounded-full transition-colors ${isProcessing ? 'bg-blue-600 animate-pulse' : 'bg-emerald-500'}`}></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
            {isProcessing ? 'Processing Analysis' : 'System Ready'}
          </span>
        </div>

        <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all group">
            <Github size={16} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
            <span className="uppercase tracking-widest">Repository</span>
          </button>
          <button className="p-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all shadow-sm group">
            <Zap size={16} fill="currentColor" />
          </button>
        </div>
      </div>
    </header>
  );
};
