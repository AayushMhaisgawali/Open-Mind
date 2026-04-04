
import React from 'react';
import { ThumbsUp, ThumbsDown, HelpCircle, Activity } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

interface MetricsProps {
  supportCount: number;
  contradictCount: number;
  neutralCount: number;
  confidence: number;
}

export const Metrics: React.FC<MetricsProps> = ({ 
  supportCount, 
  contradictCount, 
  neutralCount, 
  confidence 
}) => {
  const data = [
    { name: 'Support', value: supportCount, color: '#10b981' },
    { name: 'Contradict', value: contradictCount, color: '#ef4444' },
    { name: 'Neutral', value: neutralCount, color: '#eab308' },
  ];

  const getConfidenceColor = (score: number) => {
    if (score >= 70) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 40) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
      <MetricCard 
        label="Support" 
        value={supportCount} 
        icon={ThumbsUp} 
        color="text-emerald-500" 
        bgColor="bg-emerald-500/10" 
        border="border-emerald-500/20"
      />
      <MetricCard 
        label="Contradict" 
        value={contradictCount} 
        icon={ThumbsDown} 
        color="text-rose-500" 
        bgColor="bg-rose-500/10" 
        border="border-rose-500/20"
      />
      <MetricCard 
        label="Neutral" 
        value={neutralCount} 
        icon={HelpCircle} 
        color="text-amber-500" 
        bgColor="bg-amber-500/10" 
        border="border-amber-500/20"
      />
      <div className={`p-6 rounded-2xl border backdrop-blur-md flex flex-col items-center justify-center transition-all duration-500 shadow-xl ${getConfidenceColor(confidence)}`}>
        <Activity size={24} className="mb-2 opacity-80" />
        <span className="text-sm font-medium opacity-80 uppercase tracking-wider">Confidence Score</span>
        <div className="text-4xl font-black mt-1 leading-none">
          {Math.round(confidence)}%
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: number;
  icon: any;
  color: string;
  bgColor: string;
  border: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon: Icon, color, bgColor, border }) => (
  <div className={`p-6 rounded-2xl border ${bgColor} ${border} backdrop-blur-md flex items-center gap-5 transition-all duration-300 hover:scale-105 shadow-xl`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${color} border border-white/5`}>
      <Icon size={24} />
    </div>
    <div>
      <span className="text-sm font-medium text-slate-400 block mb-1 uppercase tracking-wider">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
    </div>
  </div>
);
