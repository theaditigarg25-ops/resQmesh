import React, { useState } from 'react';
import SOSScreen from './components/SOSScreen';
import Dashboard from './components/Dashboard';

function App() {
  const [view, setView] = useState('sosscreen'); // 'dashboard' or 'sosscreen'

  return (
    <div>
      <div className="absolute top-4 right-4 z-50 flex bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
        <button 
          onClick={() => setView('dashboard')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
        >
          Dashboard View
        </button>
        <button 
          onClick={() => setView('sosscreen')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${view === 'sosscreen' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
        >
          SOS Device View
        </button>
      </div>
      
      {view === 'dashboard' ? <Dashboard /> : <SOSScreen />}
    </div>
  );
}

export default App;
