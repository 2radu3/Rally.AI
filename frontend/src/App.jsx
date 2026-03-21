import Sidebar from './components/Sidebar';
import MainDashboard from './components/MainDashboard';

function App() {
  return (
    <div className="flex h-screen overflow-hidden font-sans selection:bg-green-500 selection:text-white">
      <Sidebar />
      <MainDashboard />
    </div>
  );
}

export default App;