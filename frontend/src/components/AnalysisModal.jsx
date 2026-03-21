import React from 'react';

export default function AnalysisModal({ isOpen, onClose, points }) {
  if (!isOpen) return null;

  return (
    // Fundalul întunecat și blurat care acoperă tot ecranul
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">

      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden relative animate-[pulse_0.1s_ease-in-out]">
        
        {/* Header Modal */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gray-900/50">
          <h2 className="text-2xl font-black text-white tracking-tight">Raport Avansat <span className="text-green-400">Padel AI</span></h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-red-500/20 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Conținut Modal */}
        <div className="p-6">
          <p className="text-gray-400 mb-6">AI-ul a detectat și procesat cu succes <strong className="text-white">{points ? points.length : 0} frame-uri</strong> de interes în acest raliu.</p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Viteză estimată Smash</div>
              <div className="text-3xl font-bold text-green-400">84 <span className="text-sm text-gray-500">km/h</span></div>
            </div>
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Pozitionare pe teren</div>
              <div className="text-3xl font-bold text-blue-400">Optimă</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Consistență lovituri</div>
              <div className="text-3xl font-bold text-purple-400">92%</div>
            </div>
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Recomandare AI</div>
              <div className="text-sm font-medium text-yellow-400">"Încearcă să lovești mingea mai sus la fileu."</div>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-colors border border-gray-700"
          >
            Închide Raportul
          </button>
        </div>
        
      </div>
    </div>
  );
}