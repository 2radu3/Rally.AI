import React, { useState, useRef } from 'react';
import UploadArea from './UploadArea';
import VideoPlayer from './VideoPlayer';
import AnalysisModal from './AnalysisModal';

const StatCard = ({ title, value, colorClass = "text-green-500", sub }) => (
  <div className="bg-[#11141b] rounded-3xl border border-gray-800/50 p-6 flex flex-col items-center justify-center shadow-xl group hover:border-gray-700 transition-all flex-1">
    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 group-hover:text-gray-400">{title}</p>
    <p className={`text-5xl font-black italic tracking-tighter ${colorClass}`}>{value}</p>
    {sub && <p className="text-[9px] text-gray-600 font-mono mt-1">{sub}</p>}
  </div>
);

// Bara de progres afișată în timpul analizei
const ProgressBar = ({ pct, currentTs }) => (
  <div className="flex flex-col items-center justify-center gap-6 z-10 w-full max-w-md px-8">
    <div className="w-20 h-20 border-[8px] border-green-500 border-t-transparent rounded-full animate-spin" />
    <h2 className="text-3xl font-black text-green-400 italic tracking-tighter uppercase">
      Scanning Court...
    </h2>
    <div className="w-full">
      <div className="flex justify-between text-[9px] text-gray-500 font-mono mb-2">
        <span>YOLOv8 + Pose AI</span>
        <span>{pct}% · {currentTs}s analizat</span>
      </div>
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
    <p className="text-gray-600 text-[9px] font-mono uppercase tracking-widest">
      Comentariile AI apar live în timp ce procesăm...
    </p>
  </div>
);

export default function MainDashboard() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, ts: 0 });
  const [analysisData, setAnalysisData] = useState(null);
  const [liveComments, setLiveComments] = useState([]); // comentarii live în timp real
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Referință la EventSource ca să îl putem închide
  const readerRef = useRef(null);

  const handleVideoUpload = async (file) => {
    if (!file) return;

    // Curăță starea anterioară
    if (readerRef.current) readerRef.current.abort();
    setIsAnalyzing(true);
    setAnalysisData(null);
    setLiveComments([]);
    setProgress({ pct: 0, ts: 0 });
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Folosim fetch cu ReadableStream — SSE peste POST (EventSource nu suportă POST)
      const response = await fetch('http://localhost:8000/analyze/live', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Backend error: ${response.status}`);
      if (!response.body) throw new Error("Browser nu suportă streaming.");

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Acumulăm chunk-uri și procesăm liniile complete
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Ultima linie poate fi incompletă — o păstrăm în buffer
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            handleSSEMessage(msg);
          } catch {
            // linie parțială, ignorăm
          }
        }
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Eroare streaming:", error);
        alert("⚠️ Backend-ul nu răspunde! Asigură-te că 'python3 main.py' rulează.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSSEMessage = (msg) => {
    switch (msg.type) {

      case 'init':
        // Metadata inițial — video-ul e deschis, YOLO pornit
        console.log(`📹 Video: ${msg.duration_s}s, ${msg.fps}fps`);
        break;

      case 'progress':
        // Actualizăm bara de progres
        setProgress({ pct: msg.pct, ts: msg.ts });
        break;

      case 'comment':
        // Comentariu live de la AI — îl adăugăm la lista de comentarii
        // VideoPlayer le va afișa sincronizat cu video-ul
        setLiveComments(prev => [...prev, msg]);
        break;

      case 'done':
        // Analiza completă — salvăm toate datele finale
        setAnalysisData({
          session_id: msg.session_id,
          live_commentary: msg.all_comments,
          heatmap: msg.heatmap,
          zone_stats: msg.zone_stats,
          movement_metrics: msg.movement_metrics,
          shot_counts: msg.shot_counts,
          error_patterns: msg.error_patterns,
          drill_suggestions: msg.drill_suggestions,
          improvement_graph: msg.improvement_graph,
        });
        setProgress({ pct: 100, ts: 0 });
        break;

      case 'error':
        console.error('Backend error:', msg.message);
        alert(`Eroare analiză: ${msg.message}`);
        break;

      default:
        break;
    }
  };

  // Extrage statisticile din structura nouă
  const distance = analysisData?.movement_metrics?.distance_meters != null
    ? `${analysisData.movement_metrics.distance_meters}m` : "0m";
  const netTime = analysisData?.zone_stats?.net != null
    ? `${analysisData.zone_stats.net}%` : "0%";
  const workRate = analysisData?.movement_metrics?.work_rate || "---";
  const consistency = analysisData?.movement_metrics?.consistency_pct != null
    ? `${analysisData.movement_metrics.consistency_pct}%` : null;

  return (
    <div className="flex-1 bg-[#0a0c10] text-white h-screen flex flex-col w-full min-w-0 overflow-hidden font-sans">

      {/* HEADER */}
      <header className="px-12 pt-10 pb-6 flex justify-between items-center w-full">
        <div>
          <h1 className="text-7xl font-black tracking-[-0.08em] italic uppercase leading-[0.8] select-none">
            PADEL<span className="text-green-500">AI</span>
          </h1>
          <p className="text-gray-600 font-bold text-[10px] tracking-[0.6em] mt-2 ml-2 uppercase">
            Ultimate Performance Radar
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className={`border px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest italic
            ${isAnalyzing
              ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 animate-pulse'
              : analysisData
                ? 'bg-green-500/10 border-green-500/20 text-green-500'
                : 'bg-gray-800/40 border-gray-700/30 text-gray-500'
            }`}>
            ● {isAnalyzing
              ? `AI ANALYZING... ${progress.pct}%`
              : analysisData
                ? `Done · ${analysisData.live_commentary?.length || 0} events`
                : 'Ready'}
          </div>
          {/* Comentariile vin live — afișăm numărul în timp real */}
          {isAnalyzing && liveComments.length > 0 && (
            <div className="text-[9px] text-green-500/60 font-mono">
              {liveComments.length} comentarii generate
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-12 pb-10 flex flex-col gap-6 overflow-hidden w-full">

        {/* CONTAINER VIDEO */}
        <div className="flex-[5] w-full bg-black rounded-[3rem] border border-gray-800/50 relative overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] flex items-center justify-center min-h-0">

          {/* Starea 1: Upload */}
          {!videoFile && !isAnalyzing && (
            <div className="scale-110">
              <UploadArea onFileSelect={handleVideoUpload} />
            </div>
          )}

          {/* Starea 2: Se analizează — progres real */}
          {isAnalyzing && (
            <ProgressBar pct={progress.pct} currentTs={progress.ts} />
          )}

          {/* Starea 3: Video gata */}
          {!isAnalyzing && videoFile && videoUrl && (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <VideoPlayer
                videoUrl={videoUrl}
                fileName={videoFile.name}
                onOpenDetails={() => setIsModalOpen(true)}
                liveScript={analysisData?.live_commentary || []}
              />
            </div>
          )}
        </div>

        {/* STATS */}
        <div className="flex-[1.5] flex gap-6 w-full max-h-[180px]">
          <div className="flex-[2.5] flex gap-4">
            <StatCard
              title="Distance"
              value={distance}
              colorClass="text-green-500"
            />
            <StatCard
              title="Net Time"
              value={netTime}
              colorClass="text-blue-500"
            />
            <StatCard
              title="Work Rate"
              value={workRate}
              colorClass="text-purple-500"
              sub={consistency ? `${consistency} consistent` : null}
            />
          </div>

          {/* Radar / Shot breakdown */}
          <div className="flex-1 bg-[#11141b] rounded-[2rem] border border-gray-800/50 p-4 relative shadow-xl flex flex-col items-center justify-center overflow-hidden gap-1">
            <p className="absolute top-3 left-6 text-[8px] font-black text-gray-600 uppercase tracking-[0.2em]">Shot Radar</p>

            {analysisData?.shot_counts ? (
              <>
                <div className="flex gap-3 mt-4">
                  {Object.entries(analysisData.shot_counts).map(([type, count]) => (
                    <div key={type} className="flex flex-col items-center">
                      <span className="text-xl font-black text-white">{count}</span>
                      <span className="text-[8px] text-gray-500 uppercase font-bold">{type}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[8px] text-green-500/60 font-mono uppercase mt-1">
                  {analysisData.live_commentary?.length || 0} AI events
                </p>
              </>
            ) : (
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-800/50 animate-[spin_15s_linear_infinite] flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-green-500/10 blur-lg" />
              </div>
            )}
          </div>
        </div>
      </main>

      <AnalysisModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        analysisData={analysisData}
      />
    </div>
  );
}
