

import React from 'react';

interface AIAssistantIndicatorProps {
  isProcessing: boolean;
}

export const AIAssistantIndicator: React.FC<AIAssistantIndicatorProps> = ({ isProcessing }) => {
  return (
    <div className="relative flex items-center justify-center w-[64px] h-[64px] cursor-default">
      {/* Outer Glow / Breathing Ring */}
      <div 
        className={`absolute inset-0 rounded-full bg-blue-400/30 blur-xl transition-all duration-1000 animate-breath-glow ${
          isProcessing ? '[animation-duration:1s]' : '[animation-duration:4s]'
        }`}
      />
      
      {/* Principal Circular Element */}
      <div className={`relative w-full h-full rounded-full bg-white shadow-xl border border-slate-100 flex items-center justify-center transition-all duration-500 overflow-hidden group hover:shadow-2xl hover:scale-105 active:scale-95 animate-assistant-pulse ${
        isProcessing ? 'ring-4 ring-blue-50/50 scale-105' : 'scale-100'
      }`}>
        {/* Soft Inner Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/50" />
        
        {/* Animated Rings/Orbits (Visible when processing) */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in duration-500">
            <div className="absolute w-[90%] h-[90%] border-[2px] border-t-blue-500/20 border-r-transparent border-b-indigo-500/20 border-l-transparent rounded-full animate-spin [animation-duration:3s]" />
            <div className="absolute w-[70%] h-[70%] border-[2px] border-t-transparent border-r-indigo-400/20 border-b-transparent border-l-blue-400/20 rounded-full animate-spin [animation-duration:2s] [animation-direction:reverse]" />
          </div>
        )}

        {/* Central Indicator (Pulse Ring) */}
        <div className="relative flex items-center justify-center">
          {/* Static Center Dot */}
          <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-sm z-10 transition-transform duration-300 group-hover:scale-110" />
          
          {/* Thinking / Pulse Rings */}
          <div className={`absolute w-4 h-4 rounded-full bg-blue-500/30 animate-ping ${isProcessing ? '[animation-duration:1s]' : '[animation-duration:3.5s]'}`} />
          
          {/* Secondary Pulse Line (Waveform style dots) */}
          <div className="absolute flex gap-0.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-1 h-3 bg-blue-200 rounded-full animate-bounce [animation-delay:-0.2s] [animation-duration:0.6s]" />
            <div className="w-1 h-4 bg-blue-300 rounded-full animate-bounce [animation-delay:-0.1s] [animation-duration:0.6s]" />
            <div className="w-1 h-3 bg-blue-200 rounded-full animate-bounce [animation-delay:0s] [animation-duration:0.6s]" />
          </div>
        </div>
      </div>
    </div>
  );
};
