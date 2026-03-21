import React from 'react';
import BorderGlow from './BorderGlow';

export default function ProgressPage() {
  const data = [
    { label: 'S1', val: 40 },
    { label: 'S2', val: 55 },
    { label: 'S3', val: 75 },
    { label: 'S4', val: 65 },
    { label: 'S5', val: 85 },
  ];

  // Calculăm punctele pentru linia graficului (SVG)
  const points = data.map((d, i) => `${i * 200},${300 - d.val * 3}`).join(' ');

  return (
    <div className="flex-1 p-12 bg-[#0a0c10] overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-7xl font-black italic uppercase mb-12">
          Evoluție <span className="text-green-500">Progres</span>
        </h1>
        
        {/* GRAFIC MANUAL (SVG) */}
        <div className="bg-[#11141b] p-10 rounded-[4rem] border border-white/5 shadow-2xl mb-12 relative overflow-hidden">
          <div className="absolute top-8 left-10">
            <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em]">Acuratețe Impact (%)</h3>
          </div>

          <div className="w-full h-[350px] mt-10 relative">
            <svg viewBox="0 0 800 300" className="w-full h-full preserve-3d">
              {/* Linii orizontale de fundal (Grila) */}
              {[0, 1, 2, 3].map(v => (
                <line key={v} x1="0" y1={v * 100} x2="800" y2={v * 100} stroke="#222" strokeWidth="1" />
              ))}
              
              {/* Linia Graficului */}
              <polyline
                fill="none"
                stroke="#22c55e"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                className="drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]"
              />

              {/* Punctele de date */}
              {data.map((d, i) => (
                <g key={i}>
                  <circle cx={i * 200} cy={300 - d.val * 3} r="10" fill="#22c55e" />
                  <text x={i * 200} y="295" fill="#555" fontSize="12" fontWeight="bold" textAnchor="middle">{d.label}</text>
                  <text x={i * 200} y={300 - d.val * 3 - 20} fill="white" fontSize="16" fontWeight="900" textAnchor="middle">{d.val}%</text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Carduri Sugestii */}
        <div className="grid grid-cols-2 gap-8">
            <div className="bg-[#11141b] p-10 rounded-[3rem] border-l-4 border-green-500 hover:bg-[#161922] transition-colors">
                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest block mb-4">Focus Săptămâna Asta</span>
                <p className="text-2xl font-bold leading-tight italic">"Loviturile de tip smash sunt executate prea târziu. Încearcă să lovești mingea în punctul maxim de înălțime."</p>
            </div>
            <div className="bg-[#11141b] p-10 rounded-[3rem] border-l-4 border-blue-500 hover:bg-[#161922] transition-colors">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-4">Recomandare Drill</span>
                <p className="text-2xl font-bold leading-tight italic">"30 de minute de 'Wall Drills' pentru a îmbunătăți timpul de reacție la fileu."</p>
            </div>
        </div>
      </div>
    </div>
  );
}