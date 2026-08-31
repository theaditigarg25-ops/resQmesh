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

  if (currentPath === '/sos') {
    return (
      <div className="h-screen w-screen overflow-hidden bg-slate-950 text-white flex flex-col relative">
        <div className="absolute top-4 left-5 z-50">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-teal-400 text-xs font-semibold rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer"
          >
            ← Back to Dashboard
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <SOSScreen />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <Dashboard />
    </div>
  );
}

export default App;
