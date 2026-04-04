import { Search, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
}

export function SearchInput({ value, onChange, onSearch, isLoading }: SearchInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      onSearch();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-5" />
          <Input
            type="text"
            placeholder="Enter your query to search across the web..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-11 h-12 text-base"
            disabled={isLoading}
          />
        </div>
        <Button 
          onClick={onSearch} 
          disabled={isLoading || !value.trim()}
          className="h-12 px-6"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Analyzing
            </>
          ) : (
            'Search'
          )}
        </Button>
      </div>
      <p className="text-xs text-gray-500 text-center">
        AI-powered web intelligence • Multi-source verification • Structured insights
      </p>
    </div>
  );
}
