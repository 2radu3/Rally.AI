import React from 'react';

export default function PadelHeatmap({ points }) {
  return (
    <div className="relative w-full h-full bg-blue-900/20 rounded-xl border border-blue-500/30 overflow-hidden flex items-center justify-center p-4">
      {/* Terenul de Padel (Linii) */}
      <div className="relative w-full h-[180px] border-2 border-white/40 flex">
        {/* Fileul */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/60 shadow-[0_0_10px_white]"></div>
        {/* Careurile de serviciu */}
        <div className="absolute inset-x-[15%] top-1/2 h-0.5 bg-white/40"></div>
        <div className="absolute left-[15%] top-0 bottom-0 w-0.5 bg-white/40"></div>
        <div className="absolute right-[15%] top-0 bottom-0 w-0.5 bg-white/40"></div>

        {/* Randare PUNCTE (Heatmap) */}
        {points && points.map((p, i) => (
          <div 
            key={i}
            className="absolute w-3 h-3 bg-yellow-400 rounded-full blur-[2px] opacity-80 animate-pulse"
            style={{ 
              // Aici mapăm coordonatele de la Python (presupunând că vin între 0 și 100)
              left: `${p.x}%`, 
              top: `${p.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        ))}
      </div>
      
      {!points && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Waiting for Radar Data...</span>
        </div>
      )}
    </div>
  );
}