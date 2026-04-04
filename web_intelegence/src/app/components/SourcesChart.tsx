import { Card } from "./ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DataSource {
  name: string;
  value: number;
  url: string;
}

interface SourcesChartProps {
  sources: DataSource[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export function SourcesChart({ sources }: SourcesChartProps) {
  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-sm font-medium text-gray-700">Data Sources Distribution</h3>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sources} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={100}
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
            />
            <YAxis 
              label={{ value: 'Data Points', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
              tick={{ fontSize: 11 }}
              stroke="#6b7280"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {sources.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2 pt-2 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-600">Sources:</p>
        <div className="grid gap-2">
          {sources.map((source, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-gray-700 flex-1">{source.name}</span>
              <span className="text-gray-500 truncate max-w-[200px]">{source.url}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
