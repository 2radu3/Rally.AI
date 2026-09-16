import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import MainDashboard from './components/MainDashboard';
import ProgressPage from './components/ProgressPage';
import MatchLog from './components/MatchLog';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMatch, setSelectedMatch] = useState(null);

  const handleMatchSelect = (match) => {
    setSelectedMatch(match);
    setActiveTab('dashboard');
  };

  const navItems = [
    {
      label: "Analiză",
      links: [
        { label: "Dashboard", onClick: () => { setActiveTab('dashboard'); setSelectedMatch(null); } }
      ]
    },
    {
      label: "Evoluție",
      links: [
        { label: "Grafice Progres", onClick: () => setActiveTab('progress') }
      ]
    }
  ];

  return (
    <div className="flex w-full bg-[#0a0c10] min-h-screen overflow-hidden">
      <Sidebar navItems={navItems} onMatchSelect={handleMatchSelect} />
      <main className="flex-1 h-screen overflow-y-auto min-w-0">
        {activeTab === 'dashboard' && <MainDashboard selectedMatch={selectedMatch} />}
        {activeTab === 'progress' && <ProgressPage />}
        {activeTab === 'journal' && <MatchLog />}
      </main>
    </div>
  );
}

export default App;
