import React, { useState, useEffect } from 'react';
import SOSScreen from './components/SOSScreen';
import Dashboard from './components/Dashboard';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const isDashboardRoute = currentPath === '/dashboard' || currentPath === '/';

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-900 text-white flex flex-col">
      <nav className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex justify-between items-center z-50 shrink-0">
        <span className="font-bold text-base text-red-500 flex items-center gap-2">
          <span>resqmesh</span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">v1.0</span>
        </span>
        <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
          <button 
            onClick={() => navigate('/dashboard')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${isDashboardRoute ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            Dashboard (/dashboard)
          </button>
          <button 
            onClick={() => navigate('/sos')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${currentPath === '/sos' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            SOS Device (/sos)
          </button>
        </div>
      </nav>
      
      <div className="flex-1 overflow-hidden relative">
        {currentPath === '/sos' ? <SOSScreen /> : <Dashboard />}
      </div>
    </div>
  );
}

export default App;
