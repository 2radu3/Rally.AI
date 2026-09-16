import React, { useState, useEffect } from 'react';
import UploadArea from './UploadArea';
import PadelHeatmap from './PadelHeatmap';
import BorderGlow from './BorderGlow';

export default function MainDashboard({ selectedMatch }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('padel_ai_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    setCurrentMatch(selectedMatch || null);
  }, [selectedMatch]);

  const glowConfig = {
    glowColor: '142 70% 50%',
    colors: ['#22c55e', '#10b981'],
    borderRadius: 48,
    backgroundColor: '#11141b'
  };

  const handleVideoUpload = async (file) => {
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('video', file);
    try {
      const response = await fetch('http://localhost:8001/analyze', { method: 'POST', body: formData });
      const result = await response.json();
      if (result.status === 'ok') {
        const newEntry = {
          id: result.id,
          videoName: file.name,
          date: new Date().toLocaleDateString(),
          stats: result.summary,
          per_player: result.per_player,
          heatmapFile: result.heatmapFile,
          videoUrl: `http://localhost:8001/videos/${result.id}/${encodeURIComponent(file.name)}`
        };
        const newHistory = [newEntry, ...history];
        setHistory(newHistory);
        localStorage.setItem('padel_ai_history', JSON.stringify(newHistory));
        setCurrentMatch(newEntry);
      }
    } catch (error) {
      alert('AI Connection Failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const stats = currentMatch?.stats;
  const perPlayer = currentMatch?.per_player;

  const formatDuration = (secs) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col p-12 overflow-y-auto">
      <h1 className="text-8xl font-black italic uppercase mb-12">
        Rally<span className="text-green-500">AI</span>
      </h1>

      {/* Upload / Status area */}
      <section className="h-[50vh] mb-10">
        <BorderGlow {...glowConfig} className="w-full h-full relative bg-black flex items-center justify-center">
          {!currentMatch && !isAnalyzing && (
            <UploadArea onFileSelect={handleVideoUpload} />
          )}
          {isAnalyzing && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="mt-4 text-green-500 font-black italic uppercase tracking-widest">Processing AI...</p>
            </div>
          )}
          {currentMatch && !isAnalyzing && (
            <div className="text-center">
              <p className="text-green-500 font-black mb-1 uppercase tracking-tighter text-xs">Analysis Complete</p>
              <h2 className="text-3xl font-black italic mb-3">{currentMatch.videoName}</h2>
              {currentMatch.videoUrl && (
                <video src={currentMatch.videoUrl} controls className="mt-2 max-h-40 rounded-xl mx-auto" />
              )}
              <button onClick={() => setCurrentMatch(null)} className="mt-4 text-[10px] text-gray-500 underline block mx-auto">
                Upload another
              </button>
            </div>
          )}
        </BorderGlow>
      </section>

      {/* Stats Grid */}
      {stats && (
        <div className="mb-10 grid grid-cols-2 gap-6">

          {/* Match overview */}
          <div className="bg-[#11141b] border border-white/5 rounded-3xl p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6">Match Overview</p>
            <div className="grid grid-cols-2 gap-4">
              <StatBox label="Total Shots" value={stats.total_shots} />
              <StatBox label="Shots / Min" value={stats.shots_per_minute} />
              <StatBox label="Duration" value={formatDuration(stats.duration)} />
              <StatBox label="Players" value={stats.total_players} />
            </div>
          </div>

          {/* Shot breakdown */}
          <div className="bg-[#11141b] border border-white/5 rounded-3xl p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6">Shot Breakdown</p>
            <div className="grid grid-cols-3 gap-4">
              <StatBox label="Forehand" value={stats.forehand_count} color="text-green-400" />
              <StatBox label="Backhand" value={stats.backhand_count} color="text-blue-400" />
              <StatBox label="Smash" value={stats.smash_count} color="text-red-400" />
            </div>

            {/* Shot type bar */}
            {stats.total_shots > 0 && (
              <div className="mt-6">
                <div className="flex rounded-full overflow-hidden h-2">
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${(stats.forehand_count / stats.total_shots) * 100}%` }}
                  />
                  <div
                    className="bg-blue-500 transition-all"
                    style={{ width: `${(stats.backhand_count / stats.total_shots) * 100}%` }}
                  />
                  <div
                    className="bg-red-500 transition-all"
                    style={{ width: `${(stats.smash_count / stats.total_shots) * 100}%` }}
                  />
                </div>
                <div className="flex gap-4 mt-2">
                  <Legend color="bg-green-500" label="Forehand" />
                  <Legend color="bg-blue-500" label="Backhand" />
                  <Legend color="bg-red-500" label="Smash" />
                </div>
              </div>
            )}
          </div>

          {/* Per player breakdown */}
          {perPlayer && Object.keys(perPlayer).length > 0 && (
            <div className="col-span-2 bg-[#11141b] border border-white/5 rounded-3xl p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6">Per Player</p>
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Object.keys(perPlayer).length}, 1fr)` }}>
                {Object.entries(perPlayer).map(([pid, data]) => (
                  <div key={pid} className="bg-black/30 rounded-2xl p-5 border border-white/5">
                    <p className="text-xs font-black uppercase text-green-500 mb-3">{pid}</p>
                    <p className="text-3xl font-black italic mb-3">{data.total} <span className="text-xs text-gray-500">shots</span></p>
                    <div className="flex flex-col gap-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Forehand</span>
                        <span className="font-bold text-green-400">{data.forehand}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Backhand</span>
                        <span className="font-bold text-blue-400">{data.backhand}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Smash</span>
                        <span className="font-bold text-red-400">{data.smash}</span>
                      </div>
                    </div>
                    {/* Mini bar for this player */}
                    {data.total > 0 && (
                      <div className="flex rounded-full overflow-hidden h-1 mt-3">
                        <div className="bg-green-500" style={{ width: `${(data.forehand / data.total) * 100}%` }} />
                        <div className="bg-blue-500" style={{ width: `${(data.backhand / data.total) * 100}%` }} />
                        <div className="bg-red-500" style={{ width: `${(data.smash / data.total) * 100}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Heatmap */}
      {currentMatch && <PadelHeatmap heatmapFile={currentMatch.heatmapFile} />}
    </div>
  );
}

function StatBox({ label, value, color = 'text-white' }) {
  return (
    <div>
      <p className={`text-3xl font-black italic ${color}`}>{value ?? '—'}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}
