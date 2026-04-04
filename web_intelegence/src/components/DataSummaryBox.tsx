
import React from 'react';
import { FileText, Activity, TrendingUp } from 'lucide-react';
import { mockData } from '../mockData';

export const DataSummaryBox: React.FC = () => {
  const avgCredibility = (mockData.reduce((acc, c) => acc + c.credibility, 0) / mockData.length * 100).toFixed(1);
  const supportCount = mockData.filter(e => e.label === 'support').length;
  
  return (
    <div className="h-full flex flex-col animate-in fade-in duration-700">
      <div className="flex items-center gap-2 mb-6 shrink-0">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
          <FileText size={16} />
        </div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Investigation Insights</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {/* Key Trend */}
        <div className="space-y-2">
           <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-slate-900">
              <span>Primary Sentiment</span>
              <span className="text-emerald-600 flex items-center gap-1.5 font-bold">
                <TrendingUp size={14} /> Positive
              </span>
           </div>
           <p className="text-xs font-medium text-slate-500 leading-relaxed italic">
              "The current dataset indicates a strong supporting trend towards established safety frameworks."
           </p>
        </div>

        {/* Breakdown List */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
           <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregate Trust</span>
              <span className="text-xs font-bold text-slate-900">{avgCredibility}%</span>
           </div>
           <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${avgCredibility}%` }}></div>
           </div>
           
           <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Supports</span>
                 <span className="text-sm font-bold text-slate-900">{supportCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Sources</span>
                 <span className="text-sm font-bold text-slate-900">{new Set(mockData.map(e => e.source)).size}</span>
              </div>
           </div>
        </div>

        {/* Authoritative Entities */}
        <div>
           <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Authoritative Entities</div>
           <div className="flex flex-wrap gap-1.5">
              {['IRENA', 'WSJ', 'FutureOfLife', 'MIT', 'EU'].map(tag => (
                <span key={tag} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all cursor-default shadow-sm">
                  {tag}
                </span>
              ))}
           </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
         <span>Real-time Sync Active</span>
         <Activity size={14} className="text-emerald-500 animate-pulse" />
      </div>
    </div>
  );
};
