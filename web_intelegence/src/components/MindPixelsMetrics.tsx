
import React from 'react';
import { Database, Search, Activity, Clock } from 'lucide-react';

interface MindPixelsMetricsProps {
    isProcessing: boolean;
    confidence: number;
}

export const MindPixelsMetrics: React.FC<MindPixelsMetricsProps> = ({ isProcessing, confidence }) => {
    const metrics = [
        { 
            label: 'Total Sources', 
            val: isProcessing ? '427+' : '0', 
            icon: <Database size={16} />,
            trend: '+12.4% / hour'
        },
        { 
            label: 'Evidence Count', 
            val: isProcessing ? '1,504' : '0', 
            icon: <Search size={16} />,
            trend: 'High Consistency'
        },
        { 
            label: 'Confidence', 
            val: isProcessing ? `${confidence}%` : '0%', 
            icon: <Activity size={16} />,
            trend: 'Bayesian'
        },
        { 
            label: 'Avg. Latency', 
            val: isProcessing ? '1.8s' : '0.0s', 
            icon: <Clock size={16} />,
            trend: '< 500ms'
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map(metric => (
                <div key={metric.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 transition-colors group-hover:text-blue-600 group-hover:bg-blue-50">
                            {metric.icon}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{metric.trend}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">{metric.label}</span>
                        <h4 className="text-3xl font-bold text-slate-900 tracking-tight">{metric.val}</h4>
                    </div>
                </div>
            ))}
        </div>
    );
};
