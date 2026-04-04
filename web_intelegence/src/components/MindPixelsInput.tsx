
import React, { useState } from 'react';
import { Search, Send } from 'lucide-react';

interface MindPixelsInputProps {
  onSearch: (claim: string) => void;
  isProcessing: boolean;
}

export const MindPixelsInput: React.FC<MindPixelsInputProps> = ({ onSearch, isProcessing }) => {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (value.trim()) onSearch(value);
  };

  return (
    <div className="w-full flex flex-col items-center gap-6 px-4">
      <div className="w-full max-w-4xl">
        <form 
            onSubmit={handleSubmit} 
            className={`flex flex-col md:flex-row items-stretch bg-white border transition-all duration-300 rounded-xl overflow-hidden shadow-sm ${isFocused ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-200'}`}
        >
            <div className="relative flex-1 group">
               <div className={`absolute left-6 top-1/2 -translate-y-1/2 transition-colors z-10 ${isFocused ? 'text-blue-600' : 'text-slate-400'}`}>
                 <Search size={20} />
               </div>
               
               <input 
                 type="text" 
                 value={value}
                 onChange={(e) => setValue(e.target.value)}
                 onFocus={() => setIsFocused(true)}
                 onBlur={() => setIsFocused(false)}
                 disabled={isProcessing}
                 placeholder="Search analysis or enter query..." 
                 className="w-full h-14 pl-14 pr-8 bg-transparent focus:outline-none text-base font-medium text-slate-900 placeholder:text-slate-400 disabled:opacity-50"
               />
            </div>

            <button 
              type="submit"
              disabled={isProcessing || !value.trim()}
              className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2.5 font-bold text-sm disabled:bg-slate-200 disabled:text-slate-400"
            >
              {isProcessing ? (
                 <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ANALYZING
                 </span>
              ) : (
                <>
                   RUN ANALYSIS
                   <Send size={16} />
                </>
              )}
            </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-center">
         {[
           'Climate data anomalies', 
           'Solar power 2024', 
           'AI safety framework'
         ].map(chip => (
           <button 
             key={chip} 
             onClick={() => setValue(chip)}
             className="px-3 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-all"
           >
             {chip}
           </button>
         ))}
      </div>
    </div>
);
};
