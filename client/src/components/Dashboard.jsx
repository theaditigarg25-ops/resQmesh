import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const socket = io(SERVER_URL);

const PRIORITY_WEIGHTS = {
  CRITICAL: 3,
  HIGH: 2,
  NORMAL: 1
};

// Hardcoded Infrastructure near Delhi (28.6139, 77.2090)
const MOCK_INFRASTRUCTURE = [
  { id: 'p1', name: 'Connaught Place Police Station', type: 'police', lat: 28.6315, lng: 77.2167 },
  { id: 'p2', name: 'Civil Lines Police Station', type: 'police', lat: 28.6812, lng: 77.2227 },
  { id: 'p3', name: 'Lajpat Nagar Police Station', type: 'police', lat: 28.5685, lng: 77.2432 },
  { id: 'h1', name: 'AIIMS Hospital', type: 'hospital', lat: 28.5672, lng: 77.2100 },
  { id: 'h2', name: 'Ram Manohar Lohia Hospital', type: 'hospital', lat: 28.6250, lng: 77.2150 },
  { id: 's1', name: 'Old Delhi Relief Shelter', type: 'shelter', lat: 28.6562, lng: 77.2300 }
];

// Custom Leaflet DivIcons with Teal & Orange palette styling
const createCustomIcon = (colorClass, iconSymbol) => L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div class="w-8 h-8 rounded-full ${colorClass} text-white flex items-center justify-center font-bold text-sm shadow-xl border-2 border-slate-900">${iconSymbol}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const policeIcon = createCustomIcon('bg-teal-600', '🚓');
const hospitalIcon = createCustomIcon('bg-emerald-600', '🏥');
const shelterIcon = createCustomIcon('bg-amber-500', '⛺');

const sosPulsingIcon = L.divIcon({
  className: 'custom-sos-marker',
  html: `
    <div class="relative flex items-center justify-center w-7 h-7">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-white shadow-xl shadow-red-950"></span>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

export default function Dashboard() {
  const [sosList, setSosList] = useState([]);

  useEffect(() => {
    // Fetch initial SOS records on mount
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

    // Socket Event Listeners for live updates
    const handleNew = (newRecord) => {
      setSosList(prev => {
        if (prev.some(item => item.id === newRecord.id)) return prev;
        const card = {
          ...newRecord,
          hopCount: '-',
          priority: null,
          tags: []
        };
        return [card, ...prev];
      });
    };

    const handleHop = ({ sosId, hopNumber }) => {
      setSosList(prev => prev.map(item => {
        if (item.id === sosId) {
          return { ...item, hopCount: hopNumber };
        }
        return item;
      }));
    };

    const handleTriaged = ({ sosId, priority, tags }) => {
      setSosList(prev => prev.map(item => {
        if (item.id === sosId) {
          return { ...item, priority, tags: tags || [] };
        }
        return item;
      }));
    };

    const handleStatusUpdate = ({ sosId, status }) => {
      setSosList(prev => prev.map(item => {
        if (item.id === sosId) {
          return { ...item, status };
        }
        return item;
      }));
    };

    socket.on('sos:new', handleNew);
    socket.on('sos:hop', handleHop);
    socket.on('sos:triaged', handleTriaged);
    socket.on('sos:statusUpdate', handleStatusUpdate);

    return () => {
      socket.off('sos:new', handleNew);
      socket.off('sos:hop', handleHop);
      socket.off('sos:triaged', handleTriaged);
      socket.off('sos:statusUpdate', handleStatusUpdate);
    };
  }, []);

  const handleDispatch = (sosId) => {
    socket.emit('sos:dispatch', { sosId, responderName: 'Unit 4' });
  };

  const handleResolve = (sosId, resolution) => {
    if (!resolution) return;
    socket.emit('sos:resolve', { sosId, resolution });
  };

  // Sort list so CRITICAL cases float to the top
  const sortedSosList = [...sosList].sort((a, b) => {
    const weightA = a.priority ? (PRIORITY_WEIGHTS[a.priority] || 0) : 0;
    const weightB = b.priority ? (PRIORITY_WEIGHTS[b.priority] || 0) : 0;
    if (weightB !== weightA) {
      return weightB - weightA;
    }
    return new Date(b.timestamp || b.receivedAt || 0) - new Date(a.timestamp || a.receivedAt || 0);
  });

  // Active SOS cases
  const activeSosForMap = sortedSosList.filter(s => s.status !== 'resolved' && s.status !== 'false_positive');
  
  // Critical active count
  const criticalCount = activeSosForMap.filter(s => s.priority === 'CRITICAL').length;

  const renderPriorityBadge = (priority) => {
    if (priority === 'CRITICAL') {
      return (
        <span className="bg-red-600 text-white text-xs px-2.5 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-sm shadow-red-600/40 animate-pulse">
          CRITICAL
        </span>
      );
    }
    if (priority === 'HIGH') {
      return (
        <span className="bg-orange-500 text-slate-950 text-xs px-2.5 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-sm shadow-orange-500/30">
          HIGH
        </span>
      );
    }
    if (priority === 'NORMAL') {
      return (
        <span className="bg-teal-500 text-slate-950 text-xs px-2.5 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-sm shadow-teal-500/30">
          NORMAL
        </span>
      );
    }
    return (
      <span className="bg-slate-800 text-slate-400 border border-slate-700/80 text-xs px-2.5 py-0.5 rounded font-semibold uppercase tracking-wider">
        Pending...
      </span>
    );
  };

  const renderStatusLabel = (status, responderName) => {
    if (!status) return null;
    if (status === 'dispatched') {
      return (
        <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
          Dispatched ({responderName || 'Unit 4'})
        </span>
      );
    }
    if (status === 'resolved') {
      return (
        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
          Resolved
        </span>
      );
    }
    if (status === 'false_positive') {
      return (
        <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
          False Positive
        </span>
      );
    }
    if (status === 'lost') {
      return (
        <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
          Packet Lost
        </span>
      );
    }
    return (
      <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider capitalize">
        {status}
      </span>
    );
  };

  const getInfraIcon = (type) => {
    if (type === 'police') return policeIcon;
    if (type === 'hospital') return hospitalIcon;
    return shelterIcon;
  };

  return (
    <div className="h-full w-full flex bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col p-4 shrink-0 shadow-2xl z-20">
        <div className="mb-6">
          <h1 className="text-xl font-extrabold tracking-tight text-teal-400 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-teal-400 shadow-md shadow-teal-400/50 animate-pulse"></span>
            ResQMesh Console
          </h1>
          <p className="text-[11px] font-semibold tracking-wider text-orange-400 uppercase mt-1">Command & Control Center</p>
        </div>

        <nav className="space-y-1.5 text-sm font-medium">
          <div className="px-3.5 py-2.5 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/30 flex items-center justify-between shadow-sm">
            <span className="font-semibold">Console Dashboard</span>
            <span className="text-xs bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full font-bold font-mono">{activeSosForMap.length}</span>
          </div>
          <div className="px-3.5 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition-colors cursor-pointer flex items-center justify-between">
            <span>Node Topology</span>
            <span className="text-xs text-slate-600 font-mono">6 Nodes</span>
          </div>
          <div className="px-3.5 py-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition-colors cursor-pointer flex items-center justify-between">
            <span>System Logs</span>
            <span className="w-2 h-2 rounded-full bg-teal-400"></span>
          </div>
        </nav>
      </aside>

      {/* Main Container Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Stat Bar */}
        <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 shrink-0 flex items-center justify-between z-10">
          <div className="flex items-center gap-8">
            {/* Total Active SOS Stat */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 text-lg shadow-sm">
                📡
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Active SOS</div>
                <div className="text-xl font-extrabold text-teal-300 font-mono leading-none mt-0.5">{activeSosForMap.length}</div>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800/80"></div>

            {/* Critical Count Stat */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 text-lg shadow-sm">
                ⚡
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Critical Count</div>
                <div className="text-xl font-extrabold text-orange-400 font-mono leading-none mt-0.5">{criticalCount}</div>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800/80"></div>

            {/* Avg Response Time Stat */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-lg shadow-sm">
                ⏱️
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Response Time</div>
                <div className="text-xl font-extrabold text-cyan-300 font-mono leading-none mt-0.5">1.8 mins</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-slate-950 px-3.5 py-1.5 rounded-lg border border-teal-500/30 text-xs font-semibold text-teal-300 shadow-sm font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
            Socket Live Engine
          </div>
        </header>

        {/* Two Main Side-by-Side Panels */}
        <main className="flex-1 flex overflow-hidden">
          {/* Left Panel: Live SOS Feed */}
          <section className="w-1/2 border-r border-slate-800/80 bg-slate-950/60 flex flex-col p-4 overflow-hidden">
            <div className="pb-3 border-b border-slate-800/80 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Live SOS Feed</span>
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping"></span>
              </h2>
              <span className="text-xs bg-slate-900 text-teal-400 px-3 py-1 rounded-full border border-teal-500/30 font-mono font-bold">
                {sortedSosList.length} Total ({activeSosForMap.length} Active)
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto mt-4 space-y-3.5 pr-1">
              {sortedSosList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-xl shadow-inner">
                    📡
                  </div>
                  <p className="text-sm font-semibold text-slate-300">Live SOS Feed Initialized</p>
                  <p className="text-xs text-slate-500 mt-1">Waiting for incoming mesh network distress signals...</p>
                </div>
              ) : (
                sortedSosList.map(sos => (
                  <div 
                    key={sos.id} 
                    className={`p-4 rounded-xl border bg-slate-900/90 shadow-xl shadow-slate-950/60 transition-all duration-200 relative overflow-hidden backdrop-blur-sm ${
                      sos.status === 'resolved' || sos.status === 'false_positive' ? 'opacity-60 border-slate-800/60' :
                      sos.priority === 'CRITICAL' ? 'border-l-4 border-l-red-500 border-t-red-500/30 border-r-red-500/30 border-b-red-500/30 shadow-red-950/30' :
                      sos.priority === 'HIGH' ? 'border-l-4 border-l-orange-500 border-t-orange-500/30 border-r-orange-500/30 border-b-orange-500/30' :
                      'border-slate-800/90 hover:border-slate-700/80'
                    }`}
                  >
                    {/* Top Bar: Category, Status Label & Priority Badge */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider bg-slate-800/90 text-teal-300 px-2.5 py-1 rounded border border-teal-500/20">
                          {sos.category || 'Emergency'}
                        </span>
                        {renderStatusLabel(sos.status, sos.responderName)}
                      </div>
                      {renderPriorityBadge(sos.priority)}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-slate-200 font-medium mb-3 line-clamp-2 leading-relaxed">
                      {sos.description || 'No description provided.'}
                    </p>

                    {/* Tags */}
                    {sos.tags && sos.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {sos.tags.map((tag, idx) => (
                          <span key={idx} className="text-[10px] bg-slate-950/80 text-teal-400/90 px-2 py-0.5 rounded border border-teal-500/20 font-mono">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer Meta Details */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2.5 border-t border-slate-800/80">
                      <div className="flex items-center gap-4">
                        <span>📱 <strong className="text-slate-200">{sos.deviceName || sos.id}</strong></span>
                        <span>🔄 Hops: <strong className="text-teal-400 font-mono">{sos.hopCount}</strong></span>
                      </div>
                      <span className="font-mono text-slate-500">
                        {sos.timestamp ? new Date(sos.timestamp).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>

                    {/* Action Controls: Dispatch Button & Resolution Dropdown */}
                    <div className="flex items-center gap-2.5 mt-3 pt-2.5 border-t border-slate-800/80">
                      <button 
                        onClick={() => handleDispatch(sos.id)}
                        disabled={sos.status === 'dispatched' || sos.status === 'resolved' || sos.status === 'false_positive'}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all shadow-sm shadow-teal-900/40 flex items-center gap-1.5 shrink-0"
                      >
                        <span>🚑</span> Dispatch
                      </button>

                      <select
                        onChange={(e) => {
                          handleResolve(sos.id, e.target.value);
                          e.target.value = "";
                        }}
                        disabled={sos.status === 'resolved' || sos.status === 'false_positive'}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-700/80 hover:border-slate-600 text-slate-200 text-xs font-medium rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:opacity-40 disabled:cursor-not-allowed flex-1"
                        defaultValue=""
                      >
                        <option value="" disabled>Resolve Options...</option>
                        <option value="resolved">Resolved</option>
                        <option value="false_positive">False Positive</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Right Panel: Map */}
          <section className="w-1/2 bg-slate-950 flex flex-col p-4 relative overflow-hidden">
            <div className="pb-3 border-b border-slate-800/80 flex justify-between items-center z-10 shrink-0 mb-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Map Area (Delhi EOC)</span>
              </h2>
              <span className="text-xs bg-teal-500/10 text-teal-300 px-3 py-1 rounded-full border border-teal-500/30 font-semibold flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                Grid (28.6139, 77.2090)
              </span>
            </div>

            {/* Leaflet Map Container */}
            <div className="flex-1 rounded-xl overflow-hidden border border-slate-800/90 relative z-0 shadow-2xl shadow-black/80">
              <MapContainer 
                center={[28.6139, 77.2090]} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Fixed Infrastructure Markers */}
                {MOCK_INFRASTRUCTURE.map(infra => (
                  <Marker 
                    key={infra.id} 
                    position={[infra.lat, infra.lng]} 
                    icon={getInfraIcon(infra.type)}
                  >
                    <Popup>
                      <div className="text-slate-900 font-sans p-1">
                        <div className="font-bold text-sm">{infra.name}</div>
                        <div className="text-xs text-slate-600 capitalize font-medium">Facility: {infra.type}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Active SOS Markers (Pulsing Red) */}
                {activeSosForMap.map(sos => {
                  const lat = sos.lat ? Number(sos.lat) : 28.6139 + (Math.random() - 0.5) * 0.05;
                  const lng = sos.lng ? Number(sos.lng) : 77.2090 + (Math.random() - 0.5) * 0.05;
                  
                  return (
                    <Marker 
                      key={sos.id} 
                      position={[lat, lng]} 
                      icon={sosPulsingIcon}
                    >
                      <Popup>
                        <div className="text-slate-900 font-sans p-1">
                          <div className="font-bold text-sm text-red-600 flex items-center gap-1">
                            🚨 {sos.category || 'SOS Emergency'}
                          </div>
                          <p className="text-xs text-slate-700 mt-1 font-medium">{sos.description || 'No description'}</p>
                          <div className="text-[11px] text-slate-500 mt-1 font-mono">
                            Device: {sos.deviceName || sos.id} | Hops: {sos.hopCount}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
