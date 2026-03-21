import React, { useState } from 'react';
import UploadArea from './UploadArea';
import VideoPlayer from './VideoPlayer';
import AnalysisModal from './AnalysisModal';
import PadelHeatmap from './PadelHeatmap';
import BorderGlow from './BorderGlow';

export default function MainDashboard() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPoints, setAnalysisPoints] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Configurație Glow pentru un look Premium
  const glowConfig = {
    glowColor: '142 70% 50%', // Verde Padel
    colors: ['#22c55e', '#10b981', '#059669'],
    borderRadius: 48,
    backgroundColor: '#11141b',
  };

  const handleVideoUpload = async (file) => {
    setIsAnalyzing(true);
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    // Simulare procesare AI
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisPoints([
        {x: 30, y: 40}, {x: 55, y: 60}, {x: 20, y: 80}, {x: 75, y: 20}
      ]);
    }, 2500);
  };

  const handleReset = () => {
    setVideoFile(null);
    setVideoUrl(null);
    setAnalysisPoints(null);
  };

  return (
    <div className="flex-1 bg-[#0a0c10] text-white min-h-screen flex flex-col w-full min-w-0 pb-20">
      
      {/* HEADER */}
      <header className="px-12 pt-12 pb-8 flex justify-between items-end w-full shrink-0">
        <div>
          <h1 className="text-8xl font-black tracking-tighter italic uppercase leading-[0.8]">
            PADEL<span className="text-green-500">AI</span>
          </h1>
          <p className="text-[10px] text-gray-600 font-bold tracking-[0.6em] mt-4 ml-2 uppercase">
            Systems Core v2.2
          </p>
        </div>

        <div className="flex items-center gap-6">
          {videoFile && (
            <button 
              onClick={handleReset} 
              className="px-6 py-3 border border-white/5 hover:border-red-500/50 hover:bg-red-500/5 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest"
            >
              Reset Video
            </button>
          )}
          <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] italic">
            ● System Active
          </div>
        </div>
      </header>

      {/* ZONA VIDEO - REPARATĂ PENTRU COLȚURI */}
      <section className="w-full px-12 pb-12 h-[80vh] shrink-0">
        <BorderGlow {...glowConfig} className="w-full h-full overflow-hidden">
          {/* Containerul rounded-[inherit] cu overflow-hidden taie colțurile video-ului */}
          <div className="w-full h-full relative bg-black rounded-[inherit] overflow-hidden flex items-center justify-center">
            
            {!videoFile && !isAnalyzing && (
              <UploadArea onFileSelect={handleVideoUpload} />
            )}
            
            {isAnalyzing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0c10]/95 z-50 rounded-[inherit]">
                 <div className="w-20 h-20 border-8 border-green-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(34,197,94,0.2)]"></div>
                 <h2 className="text-3xl font-black mt-10 text-green-500 italic uppercase tracking-tighter">Analyzing Match Data...</h2>
              </div>
            )}

            {!isAnalyzing && videoFile && videoUrl && (
              <VideoPlayer 
                videoUrl={videoUrl} 
                fileName={videoFile.name} 
                onOpenDetails={() => setIsModalOpen(true)} 
              />
            )}
          </div>
        </BorderGlow>
      </section>

      {/* STATISTICI & HEATMAP (Apar doar după upload) */}
      {videoFile && !isAnalyzing && (
        <div className="space-y-32 animate-in fade-in slide-in-from-bottom-10 duration-1000">
          
          {/* GRID STATS */}
          <section className="px-12 flex gap-10 max-w-7xl mx-auto w-full">
            <BorderGlow {...glowConfig} className="flex-1">
              <div className="p-12 text-center">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-4">Total Smashes</p>
                <p className="text-8xl font-black text-green-400 italic tracking-tighter">12</p>
              </div>
            </BorderGlow>

            <BorderGlow {...glowConfig} className="flex-1">
              <div className="p-12 text-center">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-4">Error Rate</p>
                <p className="text-8xl font-black text-red-500 italic tracking-tighter">8%</p>
              </div>
            </BorderGlow>
          </section>

          {/* HEATMAP SECTION (Fără Impact Radar în meniu, dar vizibil aici) */}
          <section className="px-12 flex flex-col items-center gap-12">
            <h2 className="text-6xl font-black italic uppercase tracking-tighter">
              Positioning <span className="text-green-500">Analysis</span>
            </h2>
            <BorderGlow {...glowConfig} borderRadius={64} className="w-full max-w-7xl h-[700px]">
              <div className="w-full h-full p-12">
                <PadelHeatmap points={analysisPoints} />
              </div>
            </BorderGlow>
          </section>

        </div>
      )}

      <AnalysisModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        points={analysisPoints} 
      />
    </div>
  );
}