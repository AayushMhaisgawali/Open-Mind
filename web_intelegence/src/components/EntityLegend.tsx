
import React from 'react';

const ENTITY_TYPES = [
  { label: 'Query', color: 'bg-yellow-400', shadow: 'shadow-yellow-400/30' },
  { label: 'Agent', color: 'bg-blue-500', shadow: 'shadow-blue-500/30' },
  { label: 'Source', color: 'bg-emerald-500', shadow: 'shadow-emerald-500/30' },
  { label: 'Result', color: 'bg-rose-500', shadow: 'shadow-rose-500/30' },
  { label: 'Evidence', color: 'bg-indigo-500', shadow: 'shadow-indigo-500/30' },
  { label: 'Metadata', color: 'bg-amber-500', shadow: 'shadow-amber-500/30' },
  { label: 'Reference', color: 'bg-cyan-500', shadow: 'shadow-cyan-500/30' },
  { label: 'Authority', color: 'bg-purple-500', shadow: 'shadow-purple-500/30' },
];

export const EntityLegend: React.FC = () => {
  return (
    <div className="absolute bottom-6 left-6 p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 z-40 transition-all hover:bg-white/[0.05] hover:border-white/20">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
        Knowledge Entity Types
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {ENTITY_TYPES.map((type) => (
          <div key={type.label} className="flex items-center gap-2.5 group cursor-pointer">
            <div className={`w-3 h-3 rounded-full ${type.color} ${type.shadow} shadow-lg transition-transform group-hover:scale-125`}></div>
            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{type.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
