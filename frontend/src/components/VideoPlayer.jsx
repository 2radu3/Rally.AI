import React from 'react';

export default function VideoPlayer({ videoUrl, fileName }) {
  if (!videoUrl) return null;

  return (
    <div className="w-full h-full flex flex-col p-2 bg-gray-950 rounded-2xl border border-gray-800 shadow-inner">
      
      {/* Zona de player real */}
      <div className="flex-1 bg-black rounded-xl overflow-hidden relative group">
        <video 
          src={videoUrl} 
          controls 
          className="w-full h-full object-contain"
          // autoplay // Opțional, dacă vrei să pornească singur
        />
        
        {/* Un mic overlay finuț când pui mouse-ul */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none p-4 flex items-end">
           <span className="text-sm font-medium text-white/90 truncate">{fileName}</span>
        </div>
      </div>

      {/* Un footer mic cu detalii, opțional */}
      <div className="h-10 flex items-center justify-between px-3 mt-1">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
           <span className="text-xs text-gray-400 font-medium">Analizat complet</span>
        </div>
        <button className="text-xs text-gray-500 hover:text-white underline">
          Detalii Analiză
        </button>
      </div>

    </div>
  );
}