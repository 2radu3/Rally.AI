import React from 'react';

// AM ADĂUGAT onOpenDetails ÎN PARANTEZE 👇
export default function VideoPlayer({ videoUrl, fileName, onOpenDetails }) {
  if (!videoUrl) return null;

  return (
    <div className="w-full h-full flex flex-col p-2 bg-gray-950 rounded-2xl border border-gray-800 shadow-inner">
      
      <div className="flex-1 bg-black rounded-xl overflow-hidden relative group">
        <video 
          src={videoUrl} 
          controls 
          className="w-full h-full object-contain"
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none p-4 flex items-end">
           <span className="text-sm font-medium text-white/90 truncate">{fileName}</span>
        </div>
      </div>

      <div className="h-10 flex items-center justify-between px-3 mt-1">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
           <span className="text-xs text-gray-400 font-medium">Analizat complet</span>
        </div>
        {/* AICI AM PUS onClick PE BUTON 👇 */}
        <button 
          onClick={onOpenDetails} 
          className="text-xs text-green-400 hover:text-green-300 font-bold uppercase tracking-wider px-3 py-1 bg-green-500/10 rounded-lg hover:bg-green-500/20 transition-all"
        >
          Detalii Analiză 📊
        </button>
      </div>

    </div>
  );
}