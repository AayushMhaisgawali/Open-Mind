
import React from 'react';

interface MindPixelsMascotProps {
  state: 'idle' | 'typing' | 'focused';
}

export const MindPixelsMascot: React.FC<MindPixelsMascotProps> = ({ state }) => {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center select-none pointer-events-none group/mascot transition-transform duration-500 hover:scale-110">
      {/* Speech Bubble */}
      {state !== 'typing' && (
        <div className="absolute -top-4 -right-2 bg-white border-2 border-slate-950 px-3 py-1 rounded-full shadow-[3px_3px_0px_0px_rgba(15,23,42,0.1)] animate-in fade-in slide-in-from-bottom-2 duration-300">
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-1">
             Hi <span className="text-xs">👋</span>
           </span>
           {/* Bubble Tail */}
           <div className="absolute -bottom-1 left-3 w-2 h-2 bg-white border-r-2 border-b-2 border-slate-950 transform rotate-45"></div>
        </div>
      )}

      <svg 
        viewBox="0 0 100 100" 
        className={`w-full h-full transition-all duration-700 animate-float ${state === 'focused' ? 'animate-bounce-react' : ''}`}
      >
        {/* Shadow */}
        <ellipse cx="50" cy="88" rx="20" ry="4" fill="rgba(15,23,42,0.08)" />
        
        {/* Core Body */}
        <path 
          d="M30,80 Q30,25 50,25 Q70,25 70,80" 
          fill="white" 
          stroke="#0f172a" 
          strokeWidth="2.5" 
          strokeLinecap="round"
          className={state === 'typing' ? 'animate-vibrate' : ''}
        />
        
        {/* Expressive Eyes */}
        <g className={state === 'typing' ? 'translate-y-0.5' : 'transition-transform'}>
            <circle cx="43" cy="50" r="2.5" fill="#0f172a" />
            <circle cx="57" cy="50" r="2.5" fill="#0f172a" />
        </g>

        {/* Professional Waving Hand */}
        <g className={`origin-[65px_70px] ${state === 'idle' ? 'animate-wave' : 'animate-wave-fast'}`}>
            <path 
              d="M70,70 L88,52" 
              fill="none" 
              stroke="#0f172a" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />
        </g>
      </svg>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-20deg); }
        }
        @keyframes wave-fast {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-35deg); }
        }
        @keyframes vibrate {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-1px); }
          75% { transform: translateX(1px); }
        }
        @keyframes bounce-react {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.05); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-wave {
          animation: wave 3s ease-in-out infinite;
        }
        .animate-wave-fast {
          animation: wave-fast 1s ease-in-out infinite;
        }
        .animate-vibrate {
          animation: vibrate 0.1s linear infinite;
        }
        .animate-bounce-react {
          animation: bounce-react 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite;
        }
      `}} />
    </div>
  );
};
