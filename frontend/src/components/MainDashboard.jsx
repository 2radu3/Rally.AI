import React, { useState } from 'react';
import UploadArea from './UploadArea';
import VideoPlayer from './VideoPlayer';
import AnalysisModal from './AnalysisModal';
import PadelHeatmap from './PadelHeatmap';

export default function MainDashboard() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPoints, setAnalysisPoints] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleVideoUpload = async (file) => {
    setIsAnalyzing(true);
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));

    // Simulăm un delay de analiză pentru efect
    setTimeout(() => {
      setIsAnalyzing(false);
      // Puncte de test pentru heatmap
      setAnalysisPoints([
        {x: 20, y: 30}, {x: 50, y: 50}, {x: 80, y: 20}, {x: 45, y: 70}
      ]);
    }, 2000);
  };

  return (
    <div className="flex-1 bg-[#0a0c10] text-white h-screen flex flex-col w-full min-w-0">
      
      {/* Header - Rămâne la fel, e destul de mare */}
      <header className="px-12 pt-12 pb-8 flex justify-between items-center w-full">
        <div>
          <h1 className="text-8xl font-black tracking-[-0.08em] italic uppercase leading-[0.8]">
            PADEL<span className="text-green-500">AI</span>
          </h1>
          <p className="text-gray-600 font-bold text-sm tracking-[0.8em] mt-4 ml-2 uppercase">
            Ultimate Performance Radar
          </p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest italic animate-pulse">
          ● System Live
        </div>
      </header>

      {/* Main UI Section - Aici facem modificările magice */}
      <main className="flex-1 px-12 pb-12 flex flex-col gap-10 overflow-hidden w-full">
        
        {/* Top: Video Player - O FACEM GIGANTICĂ */}
        {/* 'flex-[6]' îi spune să ocupe de 6 ori mai mult spațiu decât zona de jos pe verticală */}
        {/* 'h-[75vh]' forțează înălțimea să fie 75% din ecran */}
        <div className="flex-[6] h-[75vh] bg-[#11141b] rounded-[4rem] border border-gray-800/50 relative overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.6)] w-full">
          {!videoFile && !isAnalyzing && (
            <div className="scale-125 w-full h-full flex items-center justify-center">
               <UploadArea onFileSelect={handleVideoUpload} />
            </div>
          )}
          
          {isAnalyzing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0c10]/80 backdrop-blur-md">
              <div className="w-32 h-32 border-[12px] border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <h2 className="text-5xl font-black mt-12 text-green-400 italic tracking-tighter">SCANNING COURT...</h2>
            </div>
          )}

          {!isAnalyzing && videoFile && videoUrl && (
            // Ne asigurăm că VideoPlayer ocupă tot containerul
            <div className="w-full h-full">
               <VideoPlayer videoUrl={videoUrl} fileName={videoFile.name} onOpenDetails={() => setIsModalOpen(true)} />
            </div>
          )}
        </div>

        {/* Bottom Area: Stats & Radar - O facem mai compactă pe verticală */}
        {/* 'flex-[1]' o face mai subțire comparativ cu zona video */}
        <div className="flex-[1] flex gap-10 w-full min-h-[150px]">
          
          {/* Stats Section - Rămân la fel de șmechere */}
          <div className="flex-[2] bg-[#11141b] rounded-[3rem] border border-gray-800/50 p-8 flex items-center justify-around shadow-xl">
             {/* ... conținutul cardurilor rămâne la fel ... */}
             <div className="text-center group">
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest mb-2 group-hover:text-green-400 transition-colors">Smash</p>
                <p className="text-6xl font-black text-green-400 tracking-tighter italic">12</p>
             </div>
             <div className="w-px h-16 bg-gray-800/50"></div>
             <div className="text-center group">
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest mb-2 group-hover:text-blue-400 transition-colors">Forehand</p>
                <p className="text-6xl font-black text-blue-400 tracking-tighter italic">45</p>
             </div>
             <div className="w-px h-16 bg-gray-800/50"></div>
             <div className="text-center group">
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest mb-2 group-hover:text-purple-400 transition-colors">Backhand</p>
                <p className="text-6xl font-black text-purple-400 tracking-tighter italic">30</p>
             </div>
          </div>

          {/* Heatmap Section - Radarul de impact */}
          <div className="flex-[1.5] bg-[#11141b] rounded-[3rem] border border-gray-800/50 p-6 relative shadow-xl overflow-hidden group">
            <h3 className="absolute top-5 left-8 text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] z-10">Impact Radar</h3>
            <div className="w-full h-full scale-110 group-hover:scale-125 transition-transform duration-700 flex items-center justify-center">
               <PadelHeatmap points={analysisPoints} />
            </div>
          </div>

        </div>
      </main>

      <AnalysisModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} points={analysisPoints} />
    </div>
  );
}