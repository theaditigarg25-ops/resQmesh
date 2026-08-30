import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const socket = io(SERVER_URL);

const PRIORITY_WEIGHTS = {
  CRITICAL: 3,
  HIGH: 2,
  NORMAL: 1
};

export default function Dashboard() {
  const [sosList, setSosList] = useState([]);

  useEffect(() => {
    // Fetch initial SOS records
    fetch(`${SERVER_URL}/api/sos`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const initialCards = data.map(item => ({
            ...item,
            hopCount: item.totalHops || (item.hops ? item.hops.length : '-'),
            priority: item.priority || null,
            tags: item.tags || []
          }));
          setSosList(initialCards);
        }
      })
      .catch(err => console.error("Error fetching initial SOS records:", err));

    // Listen for 'sos:new'
    const handleNew = (newRecord) => {
      setSosList(prev => {
        if (prev.some(item => item.id === newRecord.id)) return prev;
        const card = {
          ...newRecord,
          hopCount: '-',
          priority: null, // Grey Pending... badge
          tags: []
        };
        return [card, ...prev];
      });
    };

    // Listen for 'sos:hop' to update hop count live
    const handleHop = ({ sosId, hopNumber }) => {
      setSosList(prev => prev.map(item => {
        if (item.id === sosId) {
          return { ...item, hopCount: hopNumber };
        }
        return item;
      }));
    };

    // Listen for 'sos:triaged' to update badge and tags
    const handleTriaged = ({ sosId, priority, tags }) => {
      setSosList(prev => prev.map(item => {
        if (item.id === sosId) {
          return { ...item, priority, tags: tags || [] };
        }
        return item;
      }));
    };

    socket.on('sos:new', handleNew);
    socket.on('sos:hop', handleHop);
    socket.on('sos:triaged', handleTriaged);

    return () => {
      socket.off('sos:new', handleNew);
      socket.off('sos:hop', handleHop);
      socket.off('sos:triaged', handleTriaged);
    };
  }, []);

  // Sort list so CRITICAL cases float to the top
  const sortedSosList = [...sosList].sort((a, b) => {
    const weightA = a.priority ? (PRIORITY_WEIGHTS[a.priority] || 0) : 0;
    const weightB = b.priority ? (PRIORITY_WEIGHTS[b.priority] || 0) : 0;
    if (weightB !== weightA) {
      return weightB - weightA; // Higher priority floats to top
    }
    return new Date(b.timestamp || b.receivedAt || 0) - new Date(a.timestamp || a.receivedAt || 0);
  });

  const renderPriorityBadge = (priority) => {
    if (priority === 'CRITICAL') {
      return <span className="bg-red-600 text-white text-xs px-2.5 py-1 rounded font-bold uppercase tracking-wider animate-pulse">CRITICAL</span>;
    }
    if (priority === 'HIGH') {
      return <span className="bg-orange-500 text-white text-xs px-2.5 py-1 rounded font-bold uppercase tracking-wider">HIGH</span>;
    }
    if (priority === 'NORMAL') {
      return <span className="bg-yellow-500 text-black text-xs px-2.5 py-1 rounded font-bold uppercase tracking-wider">NORMAL</span>;
    }
    return <span className="bg-gray-600 text-gray-200 text-xs px-2.5 py-1 rounded font-semibold uppercase tracking-wider">Pending...</span>;
  };

  return (
    <div className="h-full w-full flex bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 shrink-0">
        <div className="mb-6">
          <h1 className="text-xl font-extrabold tracking-tight text-red-500 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
            ResQMesh Rescue Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">Emergency Operations Center</p>
        </div>

        <nav className="space-y-1 text-sm font-medium">
          <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-between">
            <span>Console Dashboard</span>
            <span className="text-xs bg-red-500/20 px-2 py-0.5 rounded-full">{sosList.length}</span>
          </div>
          <div className="px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800/50 transition-colors cursor-pointer">
            Node Topology
          </div>
          <div className="px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800/50 transition-colors cursor-pointer">
            System Logs
          </div>
        </nav>
      </aside>

      {/* Main Area Split Side-by-Side into Two Panels */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Live SOS Feed */}
        <section className="w-1/2 border-r border-slate-800 bg-slate-900/50 flex flex-col p-4 overflow-hidden">
          <div className="pb-3 border-b border-slate-800 flex justify-between items-center shrink-0">
            <h2 className="text-lg font-bold text-slate-200">Live SOS Feed</h2>
            <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700 font-mono">
              {sortedSosList.length} Active
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
            {sortedSosList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-3">
                  📡
                </div>
                <p className="text-sm font-medium">Live SOS Feed</p>
                <p className="text-xs text-slate-600 mt-1">Waiting for incoming distress signals...</p>
              </div>
            ) : (
              sortedSosList.map(sos => (
                <div 
                  key={sos.id} 
                  className={`p-4 rounded-xl border bg-slate-900/90 shadow-md transition-all relative overflow-hidden ${
                    sos.priority === 'CRITICAL' ? 'border-red-500/50 shadow-red-950/20' :
                    sos.priority === 'HIGH' ? 'border-orange-500/50' :
                    'border-slate-800'
                  }`}
                >
                  {/* Top Bar: Category & Priority Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wide bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-700">
                      {sos.category || 'Emergency'}
                    </span>
                    {renderPriorityBadge(sos.priority)}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-200 font-medium mb-3 line-clamp-2">
                    {sos.description || 'No description provided.'}
                  </p>

                  {/* Tags */}
                  {sos.tags && sos.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {sos.tags.map((tag, idx) => (
                        <span key={idx} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700/60">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer Meta Details */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <span>📱 <strong className="text-slate-300">{sos.deviceName || sos.id}</strong></span>
                      <span>🔄 Hops: <strong className="text-blue-400">{sos.hopCount}</strong></span>
                    </div>
                    <span className="font-mono text-slate-500">
                      {sos.timestamp ? new Date(sos.timestamp).toLocaleTimeString() : 'Just now'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Panel: Map */}
        <section className="w-1/2 bg-slate-950 flex flex-col p-4 relative overflow-hidden">
          <div className="pb-3 border-b border-slate-800 flex justify-between items-center z-10 shrink-0">
            <h2 className="text-lg font-bold text-slate-200">Map</h2>
            <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">GPS Standby</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-3">
              🗺️
            </div>
            <p className="text-sm font-medium">Map Viewport</p>
            <p className="text-xs text-slate-600 mt-1">Map viewport ready</p>
          </div>
        </section>
      </main>
    </div>
  );
}
