import React from 'react';

export default function PadelHeatmap({ points }) {
  // Verificăm dacă punctele există (analiza e gata)
  const isAnalysisReady = points && points.length > 0;

  return (
    <div className="relative w-full h-full bg-[#0a0c10] rounded-[inherit] overflow-hidden">
      
      {!isAnalysisReady ? (
        // Starea de așteptare cât timp analyzer.py rulează
        <div className="w-full h-full flex flex-col items-center justify-center gap-6 bg-[#0a0c10]">
          <div className="w-16 h-16 border-4 border-white/5 border-t-green-500 rounded-full animate-spin shadow-[0_0_15px_rgba(34,197,94,0.2)]"></div>
          <p className="text-xs font-black uppercase tracking-[0.4em] text-green-500 animate-pulse italic">
            Generating Python Heatmap...
          </p>
        </div>
      ) : (
        // Starea finală: Afișăm HTML-ul generat de scriptul tău
        <div className="w-full h-full animate-in fade-in duration-1000">
          
          {/* AICI ÎNCĂRCĂM HTML-UL TĂU DIN FOLDERUL PUBLIC */}
          <iframe 
            src="/heatmap.html" 
            title="Padel AI Heatmap"
            className="w-full h-full border-none"
            // Hack discret să integrăm background-ul HTML-ului tău
            style={{ filter: 'brightness(0.9) contrast(1.1)', backgroundColor: 'transparent' }} 
          />
          
          {/* Overlay discret pentru branding */}
          <div className="absolute bottom-6 left-6 pointer-events-none bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Live Data: analyzer.py</span>
          </div>
          
        </div>
      )}
    </div>
  );
}