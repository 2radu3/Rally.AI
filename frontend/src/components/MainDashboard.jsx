export default function MainDashboard() {
  return (
    <div className="flex-1 bg-gray-950 text-white h-screen p-8 overflow-y-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Analiză</h1>
        <div className="px-4 py-1.5 rounded-full bg-gray-900 border border-gray-800 text-sm font-medium">
          Status Backend: <span className="text-yellow-400 animate-pulse ml-1">Waiting for API...</span>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Zona ta de Video Player */}
        <div className="lg:col-span-2 bg-gray-900 rounded-2xl border border-gray-800 h-[550px] flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-gray-900 to-gray-800 z-0"></div>
          <p className="text-gray-400 font-medium z-10 text-lg">Aici vine Video Player-ul tău 🎥</p>
          <p className="text-gray-600 text-sm z-10 mt-2">Apasă pe "Upload Video" din stânga</p>
        </div>

        {/* Zona de Stats & Colegul 4 */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 shadow-2xl">
          <h3 className="text-xl font-bold mb-6 border-b border-gray-800 pb-4">Statistici Lovituri</h3>
          
          <div className="space-y-4">
             <div className="bg-gray-800/80 p-4 rounded-xl flex justify-between items-center border border-gray-700/50">
               <span className="text-gray-300 font-medium">Smash-uri:</span>
               <span className="font-black text-2xl text-green-400">12</span>
             </div>
             <div className="bg-gray-800/80 p-4 rounded-xl flex justify-between items-center border border-gray-700/50">
               <span className="text-gray-300 font-medium">Forehand:</span>
               <span className="font-black text-2xl text-blue-400">45</span>
             </div>
             <div className="bg-gray-800/80 p-4 rounded-xl flex justify-between items-center border border-gray-700/50">
               <span className="text-gray-300 font-medium">Backhand:</span>
               <span className="font-black text-2xl text-purple-400">30</span>
             </div>
             
             {/* Cutia unde vine Heatmap-ul de la persoana 4 */}
             <div className="mt-8 h-48 border-2 border-dashed border-gray-700/70 rounded-xl flex flex-col items-center justify-center text-sm text-gray-500 bg-gray-800/30">
                <span className="font-bold mb-1">Heatmap Teren Padel</span>
                <span className="text-xs">(Rezervat pt. Persoana 4)</span>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}