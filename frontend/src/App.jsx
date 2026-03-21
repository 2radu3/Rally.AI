import Sidebar from './components/Sidebar';
import MainDashboard from './components/MainDashboard';

function App() {
  return (
    <div className="flex h-screen w-full bg-[#0a0c10] overflow-hidden">
      <Sidebar /> 
      <MainDashboard />
    </div>
  );
}

export default App;