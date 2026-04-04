
import React from 'react';
import { AlertCircle, Terminal, Lightbulb, ShieldAlert } from 'lucide-react';

interface MindPixelsAlertsProps {
  isProcessing: boolean;
  currentStep: number;
}

export const MindPixelsAlerts: React.FC<MindPixelsAlertsProps> = ({ isProcessing, currentStep }) => {
  const alerts = [
    { 
        id: 1, 
        icon: <ShieldAlert size={16} />, 
        title: 'Bias Detected', 
        desc: 'Source 04 / Media Outlet exhibits high semantic deviation.',
        type: 'warning',
        visibleAt: 4
    },
    { 
        id: 2, 
        icon: <Lightbulb size={16} />, 
        title: 'Alternative LogicFound', 
        desc: 'Parallel evidence stream discovered in archived journals.',
        type: 'insight',
        visibleAt: 3
    },
    { 
        id: 3, 
        icon: <AlertCircle size={16} />, 
        title: 'Data Sparsity Alert', 
        desc: 'Confidence weighting adjusted due to low sample volume.',
        type: 'caution',
        visibleAt: 5
    },
  ];

  if (!isProcessing) {
      return (
          <div className="h-full flex flex-col justify-center items-center text-slate-300 gap-4">
              <Terminal size={48} className="opacity-20 translate-y-2 group-hover:translate-y-0 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">System Dashboard / Idle</span>
          </div>
      );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
       <div className="flex items-center gap-3 mb-6">
          <Terminal size={18} className="text-blue-500" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Insights & Alerts</h4>
       </div>

       {alerts.filter(a => currentStep >= a.visibleAt).slice(-2).map(alert => (
          <div key={alert.id} className={`p-4 rounded-xl border-l-4 transition-all duration-500 animate-in slide-in-from-right-4 ${
              alert.type === 'warning' ? 'bg-red-50/50 border-red-400 text-red-900' : 
              alert.type === 'caution' ? 'bg-amber-50/50 border-amber-400 text-amber-900' :
              'bg-blue-50/50 border-blue-400 text-blue-900'
          }`}>
             <div className="flex items-center gap-3 mb-1">
                <div className={`p-1.5 rounded-lg border flex items-center justify-center ${
                    alert.type === 'warning' ? 'bg-red-100 border-red-200 text-red-600' : 
                    alert.type === 'caution' ? 'bg-amber-100 border-amber-200 text-amber-600' :
                    'bg-blue-100 border-blue-200 text-blue-600'
                }`}>
                    {alert.icon}
                </div>
                <h5 className="text-[10px] font-black uppercase tracking-[0.15em]">{alert.title}</h5>
             </div>
             <p className="text-[11px] font-bold leading-relaxed opacity-70 italic pl-8 pr-4">"{alert.desc}"</p>
          </div>
       ))}
    </div>
  );
};
