import React from 'react';

export default function VideoPlayer({ videoUrl, fileName, onOpenDetails }) {
  const hotspots = [12, 28, 45, 62];

  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden rounded-[inherit]">
      {/* Zona Video - Forțăm încadrarea */}
      <div className="relative flex-1 min-h-0 w-full bg-black flex items-center justify-center">
        <video 
          src={videoUrl} 
          controls 
          className="max-w-full max-h-full w-auto h-auto object-contain"
        />
        
        {/* File Tag */}
        <div className="absolute top-6 left-6 px-4 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full pointer-events-none">
           <p className="text-[10px] text-white font-black uppercase tracking-widest italic">{fileName}</p>
        </div>
      </div>

      {/* Timeline Interactiv sub video */}
      <div className="px-8 py-3 bg-[#0a0c10] border-t border-white/5 shrink-0">
        <div className="flex justify-between text-[7px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">
            <span>AI Shot Detection</span>
            <span>Highlights: 4</span>
        </div>
        <div className="h-1 bg-white/5 rounded-full relative">
            <div className="absolute inset-y-0 left-0 bg-green-500/20 w-[40%]"></div>
            {hotspots.map((spot, i) => (
                <div 
                    key={i} 
                    className="absolute h-full w-0.5 bg-green-500 shadow-[0_0_8px_#22c55e]"
                    style={{ left: `${spot}%` }}
                ></div>
            ))}
        </div>
      </div>

      {/* Bară detalii jos */}
      <div className="h-20 bg-[#11141b] border-t border-white/5 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]"></div>
          <p className="text-[10px] font-black text-white uppercase tracking-tighter italic">Live Analysis Active</p>
        </div>

        <button 
          onClick={onOpenDetails}
          className="bg-green-500 hover:bg-green-400 text-black px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg flex items-center gap-2"
        >
          <span>Details</span>
          <span className="text-sm">📊</span>
        </button>
      </div>
    </div>
  );
}