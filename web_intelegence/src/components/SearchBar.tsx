
import React from 'react';
import { Search, Loader2 } from 'lucide-react';
import { AIAssistantIndicator } from './AIAssistantIndicator';

interface SearchBarProps {
  onSearch: (claim: string) => void;
  isProcessing: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  isProcessing 
}) => {
  const [query, setQuery] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isProcessing) {
      onSearch(query);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto mb-12 flex items-center justify-center gap-6">
      {/* Search Input Container */}
      <div className="flex-1 max-w-3xl">
        <form 
          onSubmit={handleSubmit} 
          className={`relative group flex items-center bg-white border border-slate-200 rounded-[2rem] p-1.5 pl-5 shadow-sm hover:shadow-md transition-all duration-300 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50/50 ${
            isProcessing ? 'bg-slate-50 opacity-90' : 'bg-white'
          }`}
        >
          {/* Search Icon */}
          <div className="text-slate-400 mr-2 flex-shrink-0">
            <Search size={22} className="stroke-[1.5px]" />
          </div>

          {/* Input field */}
          <input
            type="text"
            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 text-lg py-3 px-2 placeholder:text-slate-400 placeholder:font-light"
            placeholder="Search AI, analyze data, or ask a question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isProcessing}
          />

          {/* Action Button inside search bar */}
          <button
            type="submit"
            disabled={!query.trim() || isProcessing}
            className={`flex items-center gap-2 px-8 py-3.5 rounded-full font-medium transition-all duration-300 ${
              isProcessing 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg active:scale-95 shadow-indigo-200'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span className="text-sm">Analyzing...</span>
              </>
            ) : (
              'Run Analysis'
            )}
          </button>
        </form>
      </div>

      {/* AI Assistant Indicator (Circular Figure) */}
      <div className="flex-shrink-0">
        <AIAssistantIndicator isProcessing={isProcessing} />
      </div>
    </div>
  );
};
