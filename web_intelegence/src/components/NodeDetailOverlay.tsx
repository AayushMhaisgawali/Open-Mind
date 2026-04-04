
import React from 'react';
import { X, Calendar, Database, ShieldCheck, Tag } from 'lucide-react';

interface NodeDetailProps {
  nodeId: string | null;
  onClose: () => void;
}

export const NodeDetailOverlay: React.FC<NodeDetailProps> = ({ nodeId, onClose }) => {
  if (!nodeId) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 p-8 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-white/20 z-50 shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="flex justify-between items-start mb-8">
        <h2 className="text-xl font-black text-white tracking-tight uppercase">Node Details</h2>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors border border-white/10 text-slate-400">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-8">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Entity Name</div>
          <div className="text-2xl font-black text-blue-400 tracking-tight">{nodeId}</div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-1.5">
              <Database size={12} className="text-blue-500" />
              UUID
            </div>
            <div className="text-[11px] font-mono text-slate-300 truncate">b8d74e84-b913-494a-ae13-673258888997</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-1.5">
              <Calendar size={12} className="text-emerald-500" />
              Created
            </div>
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">Feb 11, 2026, 8:03 AM</div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-1.5">
            <Tag size={12} className="text-indigo-500" />
            Properties
          </div>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-medium text-slate-400">Full Name</span>
              <span className="text-xs font-bold text-slate-200">System_{nodeId}_Entity</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-medium text-slate-400">Analysis Weight</span>
              <span className="text-xs font-bold text-slate-200">0.8923</span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-rose-500" />
            GraphRAG Summary
          </div>
          <p className="text-[11px] font-medium text-slate-400 leading-relaxed border border-white/10 p-4 rounded-xl bg-white/[0.02]">
            This entity is a core knowledge node influencing multiple downstream decision agents. It shows a predicted loss of 2.3-3.7 billion semantic tokens between 2024-2026 if context drift occurs; high relevance markers are active, indicating strong emotional and rational ties to the search query.
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          <span className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[10px] font-black italic text-blue-400 uppercase tracking-widest">Entity</span>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black italic text-emerald-400 uppercase tracking-widest">Alumni</span>
        </div>
      </div>
    </div>
  );
};
