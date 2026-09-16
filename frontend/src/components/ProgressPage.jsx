import React, { useState, useEffect } from 'react';

export default function ProgressPage() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('padel_ai_history');
    if (saved) {
      // Reversed so oldest is first (left on graph)
      setHistory([...JSON.parse(saved)].reverse());
    }
  }, []);

  // Need at least 2 matches to show progress
  const hasData = history.length >= 2;

  // Build graph data from real history
  const graphData = history.map((match, i) => ({
    label: `M${i + 1}`,
    shots: match.stats?.total_shots ?? 0,
    smashes: match.stats?.smash_count ?? 0,
    spm: match.stats?.shots_per_minute ?? 0,
    name: match.videoName,
    date: match.date,
  }));

  // SVG graph helper
  const W = 800;
  const H = 260;
  const PAD = 40;

  const buildPoints = (values) => {
    const max = Math.max(...values, 1);
    const step = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;
    return values.map((v, i) => ({
      x: PAD + i * step,
      y: PAD + (1 - v / max) * (H - PAD * 2),
      v,
    }));
  };

  const shotsPoints = buildPoints(graphData.map(d => d.shots));
  const smashPoints = buildPoints(graphData.map(d => d.smashes));
  const spmPoints   = buildPoints(graphData.map(d => d.spm));

  const toPolyline = (pts) => pts.map(p => `${p.x},${p.y}`).join(' ');

  // AI tip based on most recent match
  const latest = history[history.length - 1];
  const latestStats = latest?.stats;
  const smashRatio = latestStats
    ? (latestStats.smash_count / Math.max(latestStats.total_shots, 1)) * 100
    : 0;
  const forehandRatio = latestStats
    ? (latestStats.forehand_count / Math.max(latestStats.total_shots, 1)) * 100
    : 0;

  const getTip = () => {
    if (!latestStats) return { focus: 'Încarcă primul meci pentru sugestii.', drill: 'Fă upload la un videoclip pentru a începe analiza.' };
    if (smashRatio < 10) return {
      focus: 'Smash-urile reprezintă mai puțin de 10% din lovituri. Lucrează la pozițiile ofensive.',
      drill: '20 de minute de exerciții overhead pentru a îmbunătăți frecvența smash-urilor.'
    };
    if (forehandRatio > 70) return {
      focus: 'Depinzi prea mult de forehand. Echilibrează cu mai multe lovituri de backhand.',
      drill: '30 de minute de wall drills cu mâna non-dominantă pentru a consolida backhand-ul.'
    };
    if (latestStats.shots_per_minute < 10) return {
      focus: 'Ritmul de joc este lent. Lucrează la tranziția rapidă între lovituri.',
      drill: 'Exerciții de footwork în oglindă cu partenerul, 15 minute.'
    };
    return {
      focus: 'Progres solid! Menține consistența și lucrează la precizia plasamentului.',
      drill: '30 de minute de rally controlat pentru a consolida tehnica actuală.'
    };
  };

  const tip = getTip();

  return (
    <div className="flex-1 p-12 bg-[#0a0c10] overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-7xl font-black italic uppercase mb-12">
          Evoluție <span className="text-green-500">Progres</span>
        </h1>

        {!hasData && (
          <div className="bg-[#11141b] border border-white/5 rounded-3xl p-16 text-center mb-12">
            <p className="text-4xl font-black italic uppercase opacity-30 mb-4">Date insuficiente</p>
            <p className="text-xs text-gray-600 uppercase tracking-widest">
              Încarcă minim 2 meciuri pentru a vedea graficele de progres
            </p>
          </div>
        )}

        {hasData && (
          <>
            {/* Total shots graph */}
            <Graph
              title="Total Lovituri per Meci"
              color="#22c55e"
              points={shotsPoints}
              data={graphData}
              valueKey="shots"
              suffix=""
              polyline={toPolyline(shotsPoints)}
              W={W} H={H} PAD={PAD}
            />

            <div className="grid grid-cols-2 gap-6 mb-12">
              {/* Smashes graph */}
              <Graph
                title="Smash-uri per Meci"
                color="#ef4444"
                points={smashPoints}
                data={graphData}
                valueKey="smashes"
                suffix=""
                polyline={toPolyline(smashPoints)}
                W={W} H={H} PAD={PAD}
                small
              />
              {/* Shots per minute graph */}
              <Graph
                title="Lovituri / Minut"
                color="#3b82f6"
                points={spmPoints}
                data={graphData}
                valueKey="spm"
                suffix=""
                polyline={toPolyline(spmPoints)}
                W={W} H={H} PAD={PAD}
                small
              />
            </div>

            {/* Stats summary per match */}
            <div className="bg-[#11141b] border border-white/5 rounded-3xl p-8 mb-12">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6">Istoric Meciuri</p>
              <div className="flex flex-col gap-3">
                {graphData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-[10px] text-gray-600 uppercase">{d.date}</p>
                      <p className="text-sm font-black italic truncate max-w-xs">{d.name}</p>
                    </div>
                    <div className="flex gap-8 text-right">
                      <Stat label="Shots" value={d.shots} color="text-green-400" />
                      <Stat label="Smashes" value={d.smashes} color="text-red-400" />
                      <Stat label="S/min" value={d.spm} color="text-blue-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* AI Tips — always shown */}
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-[#11141b] p-10 rounded-[3rem] border-l-4 border-green-500 hover:bg-[#161922] transition-colors">
            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest block mb-4">Focus Săptămâna Asta</span>
            <p className="text-xl font-bold leading-tight italic">"{tip.focus}"</p>
          </div>
          <div className="bg-[#11141b] p-10 rounded-[3rem] border-l-4 border-blue-500 hover:bg-[#161922] transition-colors">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-4">Recomandare Drill</span>
            <p className="text-xl font-bold leading-tight italic">"{tip.drill}"</p>
          </div>
        </div>

      </div>
    </div>
  );
}

function Graph({ title, color, points, data, valueKey, polyline, W, H, PAD, small }) {
  return (
    <div className={`bg-[#11141b] p-8 rounded-[3rem] border border-white/5 ${small ? '' : 'mb-6'}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: small ? 160 : 220 }}>
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map(i => (
          <line key={i} x1={PAD} y1={PAD + i * (H - PAD * 2) / 4} x2={W - PAD} y2={PAD + i * (H - PAD * 2) / 4}
            stroke="#1a1d24" strokeWidth="1" />
        ))}
        {/* Line */}
        {points.length > 1 && (
          <polyline fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
        )}
        {/* Fill under line */}
        {points.length > 1 && (
          <polyline
            fill={`${color}18`}
            stroke="none"
            points={`${points[0].x},${H - PAD} ${polyline} ${points[points.length - 1].x},${H - PAD}`}
          />
        )}
        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill={color} />
            <text x={p.x} y={p.y - 12} fill="white" fontSize="11" fontWeight="900" textAnchor="middle">
              {typeof data[i][valueKey] === 'number' ? Math.round(data[i][valueKey]) : data[i][valueKey]}
            </text>
            <text x={p.x} y={H - 8} fill="#555" fontSize="10" fontWeight="bold" textAnchor="middle">
              {data[i].label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <p className={`text-lg font-black italic ${color}`}>{typeof value === 'number' ? Math.round(value) : value}</p>
      <p className="text-[9px] text-gray-600 uppercase tracking-widest">{label}</p>
    </div>
  );
}
