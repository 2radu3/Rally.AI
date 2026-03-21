import React, { useState, useEffect } from 'react';

// Badge colorat pentru work rate
const WorkRateBadge = ({ rate }) => {
  const styles = {
    High: "bg-green-500/15 text-green-400 border-green-500/30",
    Moderate: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    Low: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`text-[8px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-full ${styles[rate] || "bg-gray-800 text-gray-500 border-gray-700"}`}>
      {rate || "N/A"}
    </span>
  );
};

export default function Sidebar({ onSelectSession }) {
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const fetchHistory = async () => {
    try {
      const response = await fetch('http://localhost:8000/history');
      if (!response.ok) throw new Error("Backend Offline");
      const data = await response.json();
      setHistory([...data].reverse()); // cele mai noi sus, fără mutare
    } catch (error) {
      console.error("Nu am putut încărca istoricul:", error);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSelect = (item) => {
    setActiveId(item.id);
    onSelectSession?.(item.id); // trimite id-ul în sus, dacă ai nevoie
  };

  // ── construiește textul rezumat din câmpurile noi ──────────────────────────
  // sessions.json conține: distance_meters, consistency_pct, net_pct, work_rate
  // NU mai există item.summary — îl construim noi
  const buildSummary = (item) => {
    if (item.distance_meters != null) {
      return `${item.distance_meters}m parcurși · ${item.net_pct ?? 0}% fileu`;
    }
    // fallback pentru sesiuni vechi care aveau item.summary
    return item.summary || "Analiză video";
  };

  return (
    <div className="w-80 bg-[#0d1117] text-white h-screen p-8 border-r border-gray-800/50 flex flex-col shadow-2xl">

      {/* LOGO */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center font-black text-black italic text-xl shadow-[0_0_20px_rgba(34,197,94,0.4)]">
          P
        </div>
        <h2 className="text-2xl font-black italic tracking-tighter uppercase">
          PADEL<span className="text-green-500">AI</span>
        </h2>
      </div>

      {/* BUTON NEW ANALYSIS */}
      <button
        onClick={() => window.location.reload()}
        className="bg-green-500 hover:bg-green-400 text-black py-4 px-6 rounded-2xl mb-10 font-black uppercase italic transition-all shadow-lg shadow-green-500/10 active:scale-95 text-sm tracking-widest"
      >
        + New Analysis
      </button>

      {/* LISTA SESIUNI */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <h3 className="text-[10px] text-gray-500 mb-6 uppercase tracking-[0.3em] font-black">
          Sesiuni recente
        </h3>

        <ul className="space-y-4">
          {history.length > 0 ? (
            history.map((item, index) => (
              <li
                key={item.id || index}
                onClick={() => handleSelect(item)}
                className={`p-5 rounded-2xl cursor-pointer transition-all border group
                  ${activeId === item.id
                    ? "bg-green-500/10 border-green-500/40"
                    : "bg-gray-900/40 hover:bg-gray-800/60 border-gray-800/50 hover:border-green-500/30"
                  }`}
              >
                {/* Rezumat principal construit din date reale */}
                <div className="font-bold text-sm text-gray-200 group-hover:text-white transition-colors mb-2">
                  {buildSummary(item)}
                </div>

                {/* Rândul 2: work_rate badge + consistency */}
                <div className="flex items-center gap-2 mb-2">
                  <WorkRateBadge rate={item.work_rate} />
                  {item.consistency_pct != null && (
                    <span className="text-[9px] text-gray-500 font-mono">
                      {item.consistency_pct}% consistent
                    </span>
                  )}
                </div>

                {/* Timestamp */}
                <div className="text-[10px] text-gray-600 font-mono">
                  {item.timestamp}
                </div>
              </li>
            ))
          ) : (
            <div className="text-center py-10 border-2 border-dashed border-gray-800 rounded-3xl">
              <p className="text-xs text-gray-600 font-bold italic uppercase mb-1">No sessions yet</p>
              <p className="text-[9px] text-gray-700 font-mono">Uploadează un video pentru a începe</p>
            </div>
          )}
        </ul>
      </div>

      {/* FOOTER */}
      <div className="mt-auto pt-6 border-t border-gray-800/50">
        <div className="flex items-center gap-2 text-[10px] font-black text-green-500/50 uppercase tracking-widest">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          Engine V4.0 Active
        </div>
      </div>
    </div>
  );
}