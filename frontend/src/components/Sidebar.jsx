import React, { useState, useEffect } from 'react';
import { GoArrowUpRight, GoTrash } from 'react-icons/go';

export default function Sidebar({ navItems, onMatchSelect }) {
  const [history, setHistory] = useState([]);

  const loadHistory = () => {
    const saved = localStorage.getItem('padel_ai_history');
    setHistory(saved ? JSON.parse(saved) : []);
  };

  useEffect(() => {
    loadHistory();
    window.addEventListener('storage', loadHistory);
    const interval = setInterval(loadHistory, 2000);
    return () => {
      window.removeEventListener('storage', loadHistory);
      clearInterval(interval);
    };
  }, []);

  const deleteMatch = (e, matchId) => {
    e.stopPropagation(); // nu triggera onMatchSelect
    const updated = history.filter(m => m.id !== matchId);
    setHistory(updated);
    localStorage.setItem('padel_ai_history', JSON.stringify(updated));
  };

  return (
    <div className="sticky top-0 h-screen w-72 bg-[#11141b] border-r border-white/5 flex flex-col shrink-0 z-50 p-6 overflow-y-auto">
      {/* Logo */}
      <div className="mb-10">
        <span className="text-base font-black tracking-[0.3em] text-white uppercase italic">
          MENU<span className="text-green-500"></span>
        </span>
      </div>

      {/* Nav Links */}
      <div className="flex flex-col gap-6">
        {navItems.map((section, idx) => (
          <div key={idx} className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.3em] mb-1">
              {section.label}
            </p>
            {section.links.map((link, i) => (
              <button
                key={i}
                onClick={link.onClick}
                className="flex items-center gap-2 text-white/60 hover:text-green-500 transition-colors text-left group"
              >
                <GoArrowUpRight className="text-sm group-hover:text-green-400" />
                <span className="font-bold text-sm tracking-tight">{link.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Istoric Meciuri */}
      <div className="mt-8 flex flex-col gap-3">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.3em] mb-1">
          Istoric Meciuri
        </p>
        {history.length === 0 && (
          <p className="text-[11px] text-gray-700 italic">Niciun meci salvat.</p>
        )}
        {history.map((match) => (
          <div
            key={match.id}
            onClick={() => onMatchSelect && onMatchSelect(match)}
            className="p-3 bg-black/30 rounded-2xl border border-white/5 hover:border-green-500/30 transition-all cursor-pointer group relative"
          >
            <p className="text-[10px] text-gray-600 font-bold uppercase">{match.date}</p>
            <p className="text-xs font-black italic uppercase text-white/70 group-hover:text-green-500 transition-colors truncate pr-6">
              {match.videoName}
            </p>
            <p className="text-[10px] text-gray-600 mt-1">
              {match.stats?.smash_count ?? 0} smashes · {match.stats?.total_shots ?? 0} shots
            </p>

            {/* Delete button */}
            <button
              onClick={(e) => deleteMatch(e, match.id)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-500"
            >
              <GoTrash className="text-xs" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6">
        <div className="p-4 bg-black/20 rounded-3xl border border-white/5 text-center">
          <p className="text-[8px] font-bold text-gray-600 uppercase tracking-[0.3em]">
            RALLY.AI SYSTEM v2.2
          </p>
        </div>
      </div>
    </div>
  );
}