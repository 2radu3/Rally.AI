import React from 'react';

export default function PadelHeatmap({ heatmapUrl, heatmapFile }) {
  // Convert absolute Flask URL to a relative path so Vite's proxy handles it.
  // e.g. "http://localhost:8001/heatmaps/heatmap_xxx.txt" → "/heatmaps/heatmap_xxx.txt"
  const toRelative = (url) => {
    if (!url) return null;
    try { return new URL(url).pathname; } catch { return url; }
  };

  const source = toRelative(heatmapUrl) || (heatmapFile ? `/heatmaps/${heatmapFile}` : null);
  if (!source) return null;

  return (
    <div className="w-full h-[600px] rounded-[3rem] overflow-hidden border border-white/10 relative">
      <iframe
        src={`/heatmap.html?data=${encodeURIComponent(source)}`}
        className="w-full h-full border-none"
        title="AI Heatmap"
      />
      <div className="absolute bottom-6 left-6 bg-black/60 px-4 py-2 rounded-xl text-[10px] font-black italic text-green-500">
        SOURCE: {heatmapFile || source}
      </div>
    </div>
  );
}
