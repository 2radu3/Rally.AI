import React from 'react';
import CountUp from './CountUp';

export default function AnalysisModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#11141b] w-full max-w-2xl rounded-[2.5rem] border border-white/10 p-10 shadow-3xl relative overflow-hidden">
        
        {/* Buton Închidere */}
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors"
        >
          <span className="text-2xl">✕</span>
        </button>

        {/* Titlu */}
        <div className="mb-10">
          <h2 className="text-4xl font-black italic uppercase text-white tracking-tighter">
            Raport Avansat <span className="text-green-500 underline decoration-green-500/30">Padel AI</span>
          </h2>
          <p className="text-gray-400 mt-4 font-medium leading-relaxed">
            AI-ul a detectat și procesat cu succes <span className="text-white font-bold uppercase tracking-widest">4 frame-uri</span> de interes în acest raliu.
          </p>
        </div>

        {/* Grid Statistici */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          
          {/* Viteză Smash */}
          <div className="bg-[#1a1d24] p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group hover:border-green-500/30 transition-all">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-4">Viteză estimată Smash</p>
            <div className="flex items-baseline gap-2">
              <CountUp 
                to={84} 
                duration={1.5} 
                className="text-6xl font-black italic text-green-500 tracking-tighter" 
              />
              <span className="text-gray-600 font-bold text-sm uppercase">km/h</span>
            </div>
            {/* Glow efect discret */}
            <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-green-500/5 rounded-full blur-3xl group-hover:bg-green-500/10 transition-all"></div>
          </div>

          {/* Poziționare */}
          <div className="bg-[#1a1d24] p-8 rounded-[2rem] border border-white/5 group hover:border-blue-500/30 transition-all">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-4">Poziționare pe teren</p>
            <p className="text-5xl font-black italic text-blue-400 tracking-tighter leading-none py-2">Optimă</p>
          </div>

          {/* Consistență */}
          <div className="bg-[#1a1d24] p-8 rounded-[2rem] border border-white/5 group hover:border-purple-500/30 transition-all">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-4">Consistență lovituri</p>
            <div className="flex items-baseline gap-1">
              <CountUp 
                to={92} 
                duration={1.8} 
                className="text-6xl font-black italic text-purple-400 tracking-tighter" 
              />
              <span className="text-purple-400/50 font-black text-2xl">%</span>
            </div>
          </div>

          {/* Recomandare AI */}
          <div className="bg-[#1a1d24] p-8 rounded-[2rem] border border-white/5 border-l-orange-500/50">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-4">Recomandare AI</p>
            <p className="text-sm font-bold text-orange-400 italic leading-relaxed">
              "Încearcă să lovești mingea mai sus la fileu."
            </p>
          </div>

        </div>

        {/* Buton de închidere mare */}
        <button 
          onClick={onClose}
          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-[0.3em] py-5 rounded-2xl transition-all active:scale-[0.98]"
        >
          Închide Raportul
        </button>

      </div>
    </div>
  );
}