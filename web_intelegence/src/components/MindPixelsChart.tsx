
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart } from 'lucide-react';

interface MindPixelsChartProps {
    isProcessing: boolean;
}

export const MindPixelsChart: React.FC<MindPixelsChartProps> = ({ isProcessing }) => {
    // Generate dummy convergence data
    const data = [
        { name: 'T-5', support: 20, contradict: 5, neutral: 10 },
        { name: 'T-4', support: 35, contradict: 8, neutral: 15 },
        { name: 'T-3', support: 45, contradict: 12, neutral: 12 },
        { name: 'T-2', support: 60, contradict: 10, neutral: 8 },
        { name: 'T-1', support: 75, contradict: 5, neutral: 5 },
        { name: 'T-0', support: 85, contradict: 3, neutral: 2 },
    ];

    if (!isProcessing) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                <BarChart size={48} className="opacity-20" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Awaiting Signal</span>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-1000">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <TrendingUp size={18} className="text-emerald-500" />
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Evidence Convergence</h4>
                        <p className="text-[11px] font-bold text-slate-800">Neural Agreement Delta</p>
                    </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-50 text-[9px] font-black text-emerald-600 uppercase tracking-widest border border-emerald-100">
                    High Concordance
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorSupport" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorContradict" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} 
                        />
                        <YAxis hide />
                        <Tooltip 
                            contentStyle={{ 
                                borderRadius: '12px', 
                                border: 'none', 
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                fontSize: '10px',
                                fontWeight: 900,
                                textTransform: 'uppercase'
                            }} 
                        />
                        <Area 
                            type="monotone" 
                            dataKey="support" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorSupport)" 
                            animationDuration={2000}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="contradict" 
                            stroke="#ef4444" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorContradict)" 
                            animationDuration={2500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            
            <div className="mt-4 flex gap-6 justify-center">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Source Correlation</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bias Marker Delta</span>
                 </div>
            </div>
        </div>
    );
};
