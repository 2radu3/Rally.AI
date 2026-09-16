import React, { useState } from 'react';
import BorderGlow from './BorderGlow';

export default function MatchLog() {
  const [tags, setTags] = useState([
    { id: 1, time: "00:12", type: "Winner", player: "Daniel", note: "Lovituri lungă de linie" },
    { id: 2, time: "00:45", type: "Error", player: "Oponent", note: "Mingea în fileu" },
  ]);

  const addTag = (type) => {
    const newTag = {
      id: Date.now(),
      time: "02:15", // Mock time
      type: type,
      player: "Daniel",
      note: "Tag manual"
    };
    setTags([...tags, newTag]);
  };

  return (
    <div className="flex-1 p-12 bg-[#0a0c10] overflow-y-auto min-h-screen">
      <h1 className="text-7xl font-black italic uppercase mb-12">Match<span className="text-green-500">Log</span></h1>
      
      <div className="grid grid-cols-12 gap-10">
        {/* Panou Adăugare Tag-uri */}
        <div className="col-span-4 space-y-6">
          <div className="bg-[#11141b] p-8 rounded-[3rem] border border-white/5">
            <h3 className="text-xs font-black uppercase text-gray-500 mb-6 tracking-widest">Manual Tagging</h3>
            <div className="grid grid-cols-1 gap-4">
              <button onClick={() => addTag('Winner')} className="py-4 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-2xl font-black uppercase text-xs border border-green-500/20 transition-all">Winner 🎾</button>
              <button onClick={() => addTag('Error')} className="py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl font-black uppercase text-xs border border-red-500/20 transition-all">Error ❌</button>
              <button onClick={() => addTag('Rally')} className="py-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-2xl font-black uppercase text-xs border border-blue-500/20 transition-all">Rally 🔥</button>
            </div>
          </div>
        </div>

        {/* Lista de Evenimente */}
        <div className="col-span-8 bg-[#11141b] rounded-[3rem] border border-white/5 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <tr>
                <th className="p-6">Timp</th>
                <th className="p-6">Tip</th>
                <th className="p-6">Jucător</th>
                <th className="p-6">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tags.map(tag => (
                <tr key={tag.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-6 font-mono text-green-500">{tag.time}</td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      tag.type === 'Winner' ? 'bg-green-500/20 text-green-400' : 
                      tag.type === 'Error' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {tag.type}
                    </span>
                  </td>
                  <td className="p-6 text-sm font-bold">{tag.player}</td>
                  <td className="p-6 text-sm text-gray-500">{tag.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}