import React from 'react';

export default function PadelHeatmap({ heatmapFile }) {
  if (!heatmapFile) return null;

  return (
    <div className="w-full h-[600px] rounded-[3rem] overflow-hidden border border-white/10 relative">
      <iframe 
        // We pass the unique filename as a query parameter so heatmap.html knows which one to fetch
        src={`/heatmap.html?data=${heatmapFile}`} 
        className="w-full h-full border-none"
        title="AI Heatmap"
      />
      <div className="absolute bottom-6 left-6 bg-black/60 px-4 py-2 rounded-xl text-[10px] font-black italic text-green-500">
        SOURCE: {heatmapFile}
      </div>
    </div>
  );
}
