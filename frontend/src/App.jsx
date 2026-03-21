import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import MainDashboard from './components/MainDashboard';
import ProgressPage from './components/ProgressPage';
import MatchLog from './components/MatchLog';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // NavItems Curățate conform cerinței tale
const navItems = [
  {
    label: "Analiză",
    bgColor: "#0D0716",
    textColor: "#22c55e",
    links: [
      { label: "Dashboard", onClick: () => setActiveTab('dashboard') }
      // IMPACT RADAR A FOST SCOS
    ]
  },
  {
    label: "Evoluție",
    bgColor: "#170D27",
    textColor: "#3b82f6",
    links: [
      { label: "Grafice Progres", onClick: () => setActiveTab('progress') }
    ]
  },
  {
    label: "Jurnal",
    bgColor: "#271E37",
    textColor: "#a855f7",
    links: [
      { label: "MatchLog", onClick: () => setActiveTab('journal') }
    ]
  }
];

  return (
    <div className="flex w-full bg-[#0a0c10] min-h-screen overflow-hidden">
      {/* Sidebar-ul acum primește navItems și rămâne fix mereu */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        navItems={navItems} 
      />
      
      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto min-w-0">
        {activeTab === 'dashboard' && <MainDashboard />}
        {activeTab === 'progress' && <ProgressPage />}
        {activeTab === 'journal' && <MatchLog />}
      </main>
    </div>
  );
}

export default App;