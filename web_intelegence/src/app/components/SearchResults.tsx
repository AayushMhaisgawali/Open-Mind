import { Card } from "./ui/card";

interface SearchResultsProps {
  query: string;
  result: string;
  timestamp: string;
}

export function SearchResults({ query, result, timestamp }: SearchResultsProps) {
  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-gray-500">Query: {query}</p>
        <p className="text-xs text-gray-400">{timestamp}</p>
      </div>
      
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Final Result:</h3>
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <p className="font-bold text-lg leading-relaxed text-gray-900">{result}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 italic">
          Information verified across multiple trusted sources
        </p>
      </div>
    </Card>
  );
}
