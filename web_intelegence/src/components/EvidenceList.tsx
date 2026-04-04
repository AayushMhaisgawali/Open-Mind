
import React from 'react';
import { Evidence } from '../mockData';
import { CheckCircle, XCircle, MinusCircle, ExternalLink, ShieldCheck } from 'lucide-react';

interface EvidenceListProps {
  evidence: Evidence[];
}

export const EvidenceList: React.FC<EvidenceListProps> = ({ evidence }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          Evidence Panel
          <span className="text-sm font-normal text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            {evidence.length} Sources Found
          </span>
        </h3>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {evidence.map((item, index) => (
          <div 
            key={index} 
            className="group relative bg-white/5 backdrop-blur-lg border border-white/10 dark:border-slate-800 rounded-2xl p-6 transition-all duration-300 hover:bg-white/10 hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10"
          >
            <div className="flex items-start justify-between mb-4">
              <span 
                className={`
                  px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 border
                  ${item.label === 'support' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : ''}
                  ${item.label === 'contradict' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : ''}
                  ${item.label === 'neutral' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : ''}
                `}
              >
                {item.label === 'support' && <CheckCircle size={14} />}
                {item.label === 'contradict' && <XCircle size={14} />}
                {item.label === 'neutral' && <MinusCircle size={14} />}
                {item.label}
              </span>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Credibility</span>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-3 h-1 rounded-full ${i < Math.round(item.credibility * 5) ? 'bg-blue-500' : 'bg-slate-700'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <p className="text-slate-300 text-base leading-relaxed mb-6 font-medium">
              "{item.text}"
            </p>
            
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck size={16} className="text-blue-500/60" />
                <span className="text-xs font-semibold">{item.source}</span>
              </div>
              <button className="text-blue-400 hover:text-blue-300 transition-colors duration-200">
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
