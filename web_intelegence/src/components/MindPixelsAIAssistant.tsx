
import React from 'react';

interface MindPixelsAIAssistantProps {
  state: 'idle' | 'typing' | 'focused' | 'processing';
}

export const MindPixelsAIAssistant: React.FC<MindPixelsAIAssistantProps> = ({ state }) => {
  return (
    <div className="relative w-16 h-16 flex items-center justify-center select-none pointer-events-none group/assistant">
      {/* Outer Glow Ring */}
      <div className={`absolute inset-0 rounded-full bg-blue-500/10 blur-xl transition-all duration-700 ${state === 'focused' || state === 'processing' ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`}></div>
      
      {/* Main Circular Body */}
      <div className={`relative w-14 h-14 rounded-full bg-white border-2 border-slate-950 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(15,23,42,0.1)] transition-all duration-500 ${state === 'focused' ? 'scale-110' : 'scale-100'}`}>
        
        {/* Animated Inner Content (Pulse Ring / Waveform) */}
        <div className="absolute inset-0 flex items-center justify-center">
             {/* Base Pulse */}
             <div className={`w-3 h-3 rounded-full bg-slate-950 transition-all duration-500 ${state === 'processing' ? 'animate-ping' : ''}`}></div>
             
             {/* Rotating Orbit (only when processing or focused) */}
             {(state === 'processing' || state === 'focused') && (
                <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full animate-spin-slow">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
                </div>
             )}

             {/* Waveform Lines (Mock representation with CSS) */}
             <div className="flex items-center gap-0.5 h-4">
                {[1,2,3].map(i => (
                    <div 
                      key={i} 
                      className={`w-0.5 rounded-full bg-slate-950 transition-all duration-300 ${state === 'typing' ? 'animate-audio-bar' : 'h-1.5 opacity-30'}`}
                      style={{ animationDelay: `${i * 0.1}s` }}
                    ></div>
                ))}
             </div>
        </div>

        {/* Breathing Glow Outer Border Overlay */}
        <div className={`absolute inset-[-4px] rounded-full border-2 border-blue-500/30 animate-pulse-slow ${state !== 'idle' ? 'block' : 'hidden'}`}></div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes audio-bar {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.05); opacity: 0.6; }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        .animate-audio-bar {
          animation: audio-bar 0.6s ease-in-out infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};
