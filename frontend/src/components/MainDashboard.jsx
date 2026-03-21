import React, { useState } from 'react';
import UploadArea from './UploadArea';
import VideoPlayer from './VideoPlayer';

export default function MainDashboard() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null); // URL-ul local pentru player
  const [isAnalyzing, setIsAnalyzing] = useState(false); // State pentru loading
  const [analysisError, setAnalysisError] = useState(null); // Dacă crapă backend-ul
  const [analysisPoints, setAnalysisPoints] = useState(null); // Punctele primite (pt Heatmap mai târziu)

  // Funcția care se ocupă de tot fluxul
  const handleVideoUpload = async (file) => {
    console.log("Fișier selectat, se pregătește de trimitere:", file.name);
    
    // Resetăm stările anterioare
    setAnalysisError(null);
    setAnalysisPoints(null);
    setVideoFile(file);
    
    // 1. Începem "Loading"-ul
    setIsAnalyzing(true);

    // 2. Pregătim URL-ul local pentru Video Player
    // Asta transformă fișierul tău de pe disc într-un link pe care React îl poate reda INSTANT (fără upload public)
    const localUrl = URL.createObjectURL(file);
    setVideoUrl(localUrl);

    // 3. Pregătim trimiterea către Backend
    const formData = new FormData();
    formData.append('file', file); // 'file' e numele câmpului cerut de FastAPI

    try {
      console.log("Trimit către backend...");
      // FACEM FETCH-UL REAL
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Succes de la Backend! Datele primite:", data);
        setAnalysisPoints(data.points); // Salvăm punctele (pentru colegul cu heatmap)
        // În momentul ăsta, fiindcă setAnalysisError e null și isAnalyzing se va face false, player-ul va apărea automat
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Eroare de la server:", response.status, response.statusText);
        setAnalysisError(errorData.detail || `A crăpat serverul de Python (Cod ${response.status})`);
      }
    } catch (error) {
      console.error("Eroare de rețea:", error);
      setAnalysisError("Nu mă pot conecta la backend. E pornit serverul de Python pe localhost:8000?");
    } finally {
      // 4. ÎNCHEIEM "Loading"-ul indiferent dacă e succes sau eroare
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setVideoFile(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl); // Curățăm memoria
    setVideoUrl(null);
    setAnalysisPoints(null);
    setAnalysisError(null);
  };

  return (
    <div className="flex-1 bg-gray-950 text-white h-screen p-8 overflow-y-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Analiză <span className="text-green-400 font-light">Padel AI</span></h1>
        <div className="flex items-center gap-4">
           {videoFile && (
             <button onClick={handleReset} className="text-sm text-gray-500 hover:text-white underline">
               Încarcă alt video
             </button>
           )}
           <div className="px-4 py-1.5 rounded-full bg-gray-900 border border-gray-800 text-sm font-medium">
             Status Backend: <span className="text-green-400 ml-1">Connected (Port 8000)</span>
           </div>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ZONA CENTRALĂ - Magia se întâmplă aici */}
        <div className="lg:col-span-2 bg-gray-900 rounded-2xl border border-gray-800 h-[580px] shadow-2xl relative overflow-hidden p-4">
          
          {/* Starea 1: Nu avem video selectat -> Arătăm UploadArea */}
          {!videoFile && !isAnalyzing && (
             <UploadArea onFileSelect={handleVideoUpload} />
          )}

          {/* Starea 2: Se încarcă și se analizează -> Arătăm Spinner */}
          {isAnalyzing && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900rounded-xl border border-gray-800">
              {/* Spinner HTML/CSS șmecher */}
              <div className="relative flex items-center justify-center">
                 <div className="w-16 h-16 rounded-full border-t-4 border-b-4 border-green-500 animate-spin"></div>
                 <div className="absolute w-10 h-10 rounded-full border-t-2 border-b-2 border-green-300 animate-spin-reverse opacity-70"></div>
              </div>
              <p className="text-green-400 font-black text-2xl mt-8 animate-pulse tracking-tight">Se analizează meciul...</p>
              <p className="text-gray-500 text-sm mt-2">Nu închide fereastra. Acest proces poate dura câteva minute.</p>
            </div>
          )}

          {/* Starea 3: Avem o eroare de la backend */}
          {analysisError && (
             <div className="w-full h-full flex flex-col items-center justify-center bg-red-950/20 rounded-xl border border-red-800/50 p-6">
                <span className="text-6xl mb-6">🚨</span>
                <p className="text-red-400 font-bold text-xl mb-3">Analiza a Eșuat</p>
                <p className="text-red-300/80 bg-red-950/50 px-4 py-2 rounded-lg text-center font-mono text-sm max-w-lg">{analysisError}</p>
                <button 
                    className="mt-8 bg-red-500 text-white px-5 py-2 rounded-lg font-bold hover:bg-red-600 transition-colors"
                    onClick={handleReset}
                >
                    Încearcă din nou
                </button>
             </div>
          )}

          {/* Starea 4: Succes! -> Arătăm VideoPlayer-ul */}
          {!isAnalyzing && !analysisError && videoFile && videoUrl && (
             <VideoPlayer videoUrl={videoUrl} fileName={videoFile.name} />
          )}

        </div>

        {/* Zona de Stats & Colegul 4 (Heatmap) */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 shadow-2xl flex flex-col">
          <h3 className="text-xl font-bold mb-6 border-b border-gray-800 pb-4">Rezultate Meci</h3>
          
          <div className="space-y-4 flex-1">
             <div className="bg-gray-800/80 p-4 rounded-xl flex justify-between items-center border border-gray-700/50">
               <span className="text-gray-300 font-medium">Lovitură Smash:</span>
               <span className="font-black text-2xl text-green-400">12</span>
             </div>
             <div className="bg-gray-800/80 p-4 rounded-xl flex justify-between items-center border border-gray-700/50">
               <span className="text-gray-300 font-medium">Forehand (Dreapta):</span>
               <span className="font-black text-2xl text-blue-400">45</span>
             </div>
             <div className="bg-gray-800/80 p-4 rounded-xl flex justify-between items-center border border-gray-700/50">
               <span className="text-gray-300 font-medium">Backhand (Revers):</span>
               <span className="font-black text-2xl text-purple-400">30</span>
             </div>
             
             {/* Cutia unde vine Heatmap-ul de la persoana 4 */}
             <div className="mt-8 flex-1 border-2 border-dashed border-gray-700/70 rounded-xl flex flex-col items-center justify-center text-sm text-gray-500 bg-gray-800/30 min-h-[150px]">
                <span className="font-bold mb-1">Heatmap Teren Padel</span>
                <span className="text-xs">(Rezervat pt. Persoana 4)</span>
                {analysisPoints && (
                    <span className="mt-2 text-xs text-green-500 font-medium bg-green-950 px-2 py-0.5 rounded-full">
                       Am primit {analysisPoints.length} puncte pt Heatmap!
                    </span>
                )}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}