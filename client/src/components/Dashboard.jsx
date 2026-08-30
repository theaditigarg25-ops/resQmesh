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

// Helper to construct custom Leaflet DivIcons
const createCustomIcon = (colorClass, iconSymbol) => L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div class="w-8 h-8 rounded-full ${colorClass} text-white flex items-center justify-center font-bold text-sm shadow-md border-2 border-white">${iconSymbol}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const policeIcon = createCustomIcon('bg-blue-600', '🚓');
const hospitalIcon = createCustomIcon('bg-emerald-600', '🏥');
const shelterIcon = createCustomIcon('bg-amber-500', '⛺');

const sosPulsingIcon = L.divIcon({
  className: 'custom-sos-marker',
  html: `
    <div class="relative flex items-center justify-center w-6 h-6">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-white shadow-lg"></span>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

export default function Dashboard() {
  const [sosList, setSosList] = useState([]);

  useEffect(() => {
    // Fetch initial SOS records on mount so refresh doesn't lose data
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

  // Active SOS cases (remove when resolved/false_positive)
  const activeSosForMap = sortedSosList.filter(s => s.status !== 'resolved' && s.status !== 'false_positive');
  
  // Critical active count
  const criticalCount = activeSosForMap.filter(s => s.priority === 'CRITICAL').length;

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

  const renderStatusLabel = (status, responderName) => {
    if (!status) return null;
    if (status === 'dispatched') {
      return (
        <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
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
        <span className="text-[10px] bg-slate-700 text-slate-400 border border-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
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
            <span className="text-xs bg-red-500/20 px-2 py-0.5 rounded-full font-bold">{activeSosForMap.length}</span>
          </div>
          <div className="px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800/50 transition-colors cursor-pointer">
            Node Topology
          </div>
          <div className="px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800/50 transition-colors cursor-pointer">
            System Logs
          </div>
        </nav>
      </aside>

      {/* Main Container Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Stat Bar */}
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Total Active SOS Stat */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-base">
                🚨
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Total Active SOS</div>
                <div className="text-lg font-bold text-slate-100 font-mono leading-none mt-0.5">{activeSosForMap.length}</div>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800"></div>

            {/* Critical Count Stat */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-base">
                ⚡
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Critical Count</div>
                <div className="text-lg font-bold text-red-400 font-mono leading-none mt-0.5">{criticalCount}</div>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800"></div>

            {/* Avg Response Time Stat */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-base">
                ⏱️
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Avg Response Time</div>
                <div className="text-lg font-bold text-blue-400 font-mono leading-none mt-0.5">1.8 mins</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-medium text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Socket Live Engine
          </div>
        </header>

        {/* Two Main Side-by-Side Panels */}
        <main className="flex-1 flex overflow-hidden">
          {/* Left Panel: Live SOS Feed */}
          <section className="w-1/2 border-r border-slate-800 bg-slate-900/50 flex flex-col p-4 overflow-hidden">
            <div className="pb-3 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-slate-200">Live SOS Feed</h2>
              <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700 font-mono">
                {sortedSosList.length} Total ({activeSosForMap.length} Active)
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
                      sos.status === 'resolved' || sos.status === 'false_positive' ? 'opacity-60 border-slate-800/50' :
                      sos.priority === 'CRITICAL' ? 'border-red-500/50 shadow-red-950/20' :
                      sos.priority === 'HIGH' ? 'border-orange-500/50' :
                      'border-slate-800'
                    }`}
                  >
                    {/* Top Bar: Category, Status Label & Priority Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wide bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-700">
                          {sos.category || 'Emergency'}
                        </span>
                        {renderStatusLabel(sos.status, sos.responderName)}
                      </div>
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

                    {/* Action Controls: Dispatch Button & Resolution Dropdown */}
                    <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-800/80">
                      <button 
                        onClick={() => handleDispatch(sos.id)}
                        disabled={sos.status === 'dispatched' || sos.status === 'resolved' || sos.status === 'false_positive'}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shrink-0"
                      >
                        <span>🚑</span> Dispatch
                      </button>

                      <select
                        onChange={(e) => {
                          handleResolve(sos.id, e.target.value);
                          e.target.value = "";
                        }}
                        disabled={sos.status === 'resolved' || sos.status === 'false_positive'}
                        className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-medium rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex-1"
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
            <div className="pb-3 border-b border-slate-800 flex justify-between items-center z-10 shrink-0 mb-4">
              <h2 className="text-lg font-bold text-slate-200">Map Area (Delhi EOC)</h2>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Grid (28.6139, 77.2090)
              </span>
            </div>

            {/* Leaflet Map */}
            <div className="flex-1 rounded-xl overflow-hidden border border-slate-800 relative z-0">
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
                          <div className="text-[11px] text-slate-500 mt-1">
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
