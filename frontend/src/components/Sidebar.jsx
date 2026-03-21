export default function Sidebar() {
  const history = [
    { id: '1', date: '2026-03-21', name: 'Meci Antrenament' },
    { id: '2', date: '2026-03-21', name: 'Finala Padel' }
  ];

  return (
    <div className="w-64 bg-gray-900 text-white h-screen p-4 border-r border-gray-800 flex flex-col">
      <h2 className="text-2xl font-black mb-8 text-green-400 tracking-tight">🎾 PadelAI</h2>
      
      <button className="bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-xl mb-6 font-bold transition-all shadow-lg shadow-green-500/20 active:scale-95">
        + Upload Video
      </button>
      
      <div className="flex-1 overflow-y-auto">
        <h3 className="text-xs text-gray-500 mb-4 uppercase tracking-widest font-bold">Istoric Analize</h3>
        <ul className="space-y-3">
          {history.map((item) => (
            <li key={item.id} className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl cursor-pointer transition-colors border border-gray-700/50">
              <div className="font-semibold text-sm">{item.name}</div>
              <div className="text-xs text-gray-400 mt-1">{item.date}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}