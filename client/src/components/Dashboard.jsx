import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  Radio, 
  Shield, 
  MapPin, 
  CheckCircle2, 
  Server, 
  Smartphone,
  RefreshCw,
  Send,
  AlertCircle
} from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const socket = io(SERVER_URL);

const PRIORITY_WEIGHTS = {
  CRITICAL: 3,
  HIGH: 2,
  NORMAL: 1
};

// Infrastructure locations near Delhi (28.6139, 77.2090)
const MOCK_INFRASTRUCTURE = [
  { id: 'p1', name: 'Connaught Place Police Station', type: 'police', lat: 28.6315, lng: 77.2167 },
  { id: 'p2', name: 'Civil Lines Police Station', type: 'police', lat: 28.6812, lng: 77.2227 },
  { id: 'p3', name: 'Lajpat Nagar Police Station', type: 'police', lat: 28.5685, lng: 77.2432 },
  { id: 'h1', name: 'AIIMS Hospital', type: 'hospital', lat: 28.5672, lng: 77.2100 },
  { id: 'h2', name: 'Ram Manohar Lohia Hospital', type: 'hospital', lat: 28.6250, lng: 77.2150 },
  { id: 's1', name: 'Old Delhi Relief Shelter', type: 'shelter', lat: 28.6562, lng: 77.2300 }
];

// Clean custom Leaflet SVG icons with colored circular backgrounds matching accent colors
const policeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`;
const hospitalSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12M6 12h12"/></svg>`;
const shelterSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-10 9h3v8h14v-8h3z"/></svg>`;

const createCustomIcon = (bgColor, svgContent) => L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div class="w-10 h-10 rounded-full ${bgColor} flex items-center justify-center shadow-xl border-2 border-slate-900">${svgContent}</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

const policeIcon = createCustomIcon('bg-slate-900 border-teal-500/60', policeSvg);
const hospitalIcon = createCustomIcon('bg-slate-900 border-emerald-500/60', hospitalSvg);
const shelterIcon = createCustomIcon('bg-slate-900 border-amber-500/60', shelterSvg);

const sosPulsingIcon = L.divIcon({
  className: 'custom-sos-marker',
  html: `
    <div class="relative flex items-center justify-center w-8 h-8">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-5 w-5 bg-red-600 border-2 border-white shadow-xl shadow-red-950"></span>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

export default function Dashboard() {
  const [sosList, setSosList] = useState([]);
  const [newSosIds, setNewSosIds] = useState(new Set());
  const [flashingHops, setFlashingHops] = useState({});
  const [flashingPriority, setFlashingPriority] = useState({});

  useEffect(() => {
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

      // Highlight new SOS card with entrance animation
      setNewSosIds(prev => new Set(prev).add(newRecord.id));
      setTimeout(() => {
        setNewSosIds(prev => {
          const next = new Set(prev);
          next.delete(newRecord.id);
          return next;
        });
      }, 1200);
    };

    const handleHop = ({ sosId, hopNumber }) => {
      setSosList(prev => prev.map(item => {
        if (item.id === sosId) {
          return { ...item, hopCount: hopNumber };
        }
        return item;
      }));

      // Trigger hop count scale/color flash animation
      setFlashingHops(prev => ({ ...prev, [sosId]: Date.now() }));
      setTimeout(() => {
        setFlashingHops(prev => {
          const next = { ...prev };
          delete next[sosId];
          return next;
        });
      }, 800);
    };

    const handleTriaged = ({ sosId, priority, tags }) => {
      setSosList(prev => prev.map(item => {
        if (item.id === sosId) {
          return { ...item, priority, tags: tags || [] };
        }
        return item;
      }));

      // Trigger priority badge pop/flash animation
      setFlashingPriority(prev => ({ ...prev, [sosId]: Date.now() }));
      setTimeout(() => {
        setFlashingPriority(prev => {
          const next = { ...prev };
          delete next[sosId];
          return next;
        });
      }, 900);
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

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  const sortedSosList = [...sosList].sort((a, b) => {
    const weightA = a.priority ? (PRIORITY_WEIGHTS[a.priority] || 0) : 0;
    const weightB = b.priority ? (PRIORITY_WEIGHTS[b.priority] || 0) : 0;
    if (weightB !== weightA) {
      return weightB - weightA;
    }
    return new Date(b.timestamp || b.receivedAt || 0) - new Date(a.timestamp || a.receivedAt || 0);
  });

  const activeSosForMap = sortedSosList.filter(s => s.status !== 'resolved' && s.status !== 'false_positive');
  const criticalCount = activeSosForMap.filter(s => s.priority === 'CRITICAL').length;
  const currentPath = window.location.pathname;

  const renderPriorityBadge = (priority) => {
    if (priority === 'CRITICAL') {
      return (
        <span className="bg-red-600 text-white text-xs px-2.5 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-sm shadow-red-600/40 animate-pulse flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-white" strokeWidth={2.5} /> CRITICAL
        </span>
      );
    }
    if (priority === 'HIGH') {
      return (
        <span className="bg-orange-500 text-slate-950 text-xs px-2.5 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-sm shadow-orange-500/30 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-slate-950" strokeWidth={2.5} /> HIGH
        </span>
      );
    }
    if (priority === 'NORMAL') {
      return (
        <span className="bg-teal-500 text-slate-950 text-xs px-2.5 py-0.5 rounded font-extrabold uppercase tracking-wider shadow-sm shadow-teal-500/30 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" strokeWidth={2.5} /> NORMAL
        </span>
      );
    }
    return (
      <span className="bg-slate-800 text-slate-400 border border-slate-700/80 text-xs px-2.5 py-0.5 rounded font-semibold uppercase tracking-wider animate-pulse">
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
        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.2} /> Resolved
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
      {/* Fixed Left Sidebar */}
      <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col p-5 shrink-0 shadow-2xl z-30 justify-between">
        <div className="space-y-5">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-11 h-11 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shadow-md shrink-0">
              <Radio className="w-6 h-6 text-teal-400 animate-pulse" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                ResQMesh
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono font-bold">
                  v1.0
                </span>
              </h1>
              <p className="text-xs font-semibold text-teal-400 tracking-wider uppercase">Emergency Ops</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-1">
              Navigation
            </div>
            <button
              onClick={() => navigateTo('/dashboard')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                currentPath === '/dashboard' || currentPath === '/'
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-md shadow-teal-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-teal-400" strokeWidth={2.2} />
                </div>
                <span>Dashboard</span>
              </div>
              <span className="text-xs bg-slate-800 text-teal-400 px-2 py-0.5 rounded-full font-mono font-bold border border-slate-700/60">
                {activeSosForMap.length}
              </span>
            </button>

            <button
              onClick={() => navigateTo('/sos')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                currentPath === '/sos'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30 shadow-md shadow-red-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <Radio className="w-5 h-5 text-orange-400" strokeWidth={2.2} />
                </div>
                <span>SOS Device</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping"></span>
            </button>
          </nav>

          {/* Infrastructure & System Monitor */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3 mb-1">
              System Overview
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shrink-0">
                  <Server className="w-4 h-4 text-teal-400" strokeWidth={2} />
                </div>
                <span>Active Relays</span>
              </div>
              <span className="font-mono text-teal-400 font-bold">6 Nodes</span>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-orange-400" strokeWidth={2} />
                </div>
                <span>EOC Command</span>
              </div>
              <span className="text-xs bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded font-mono font-bold">
                Online
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
            Mesh Ready
          </span>
          <span className="text-slate-400">Delhi EOC</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-5 gap-5 overflow-hidden bg-slate-950">
        
        {/* Header Stat Bar (Three Stat Cards Side by Side) */}
        <header className="grid grid-cols-1 md:grid-cols-3 gap-5 shrink-0">
          
          {/* Card 1: Total Active SOS */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-sm hover:border-slate-700/80 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-3xl font-extrabold font-mono text-slate-100 tracking-tight">
                {activeSosForMap.length}
              </div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Total Active SOS
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center shadow-md shrink-0">
              <Radio className="w-6 h-6 text-teal-400" strokeWidth={2.2} />
            </div>
          </div>

          {/* Card 2: Critical Count */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-sm hover:border-slate-700/80 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-3xl font-extrabold font-mono text-orange-400 tracking-tight">
                {criticalCount}
              </div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Critical Count
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center shadow-md shrink-0">
              <AlertTriangle className="w-6 h-6 text-orange-400 animate-pulse" strokeWidth={2.2} />
            </div>
          </div>

          {/* Card 3: Avg Response Time */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-sm hover:border-slate-700/80 transition-all flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-3xl font-extrabold font-mono text-cyan-300 tracking-tight">
                1.8 <span className="text-lg font-normal text-slate-300 font-sans">mins</span>
              </div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Avg Response Time
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shadow-md shrink-0">
              <Clock className="w-6 h-6 text-cyan-400" strokeWidth={2.2} />
            </div>
          </div>

        </header>

        {/* Two-Column Grid: Left (Live SOS Feed), Right (Map) */}
        <main className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0 overflow-hidden">
          
          {/* Left Column: Live SOS Feed */}
          <section className="flex flex-col bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl overflow-hidden backdrop-blur-sm">
            
            {/* Header */}
            <div className="pb-3.5 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-teal-400" strokeWidth={2.2} />
                </div>
                <span>Live SOS Feed</span>
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping"></span>
              </h2>
              <span className="text-xs bg-slate-950 text-teal-300 px-3 py-1 rounded-full border border-teal-500/30 font-mono font-bold shadow-sm">
                {sortedSosList.length} Total ({activeSosForMap.length} Active)
              </span>
            </div>
            
            {/* Scrollable Card List */}
            <div className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1">
              {sortedSosList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mb-3 text-teal-400 shadow-inner">
                    <Radio className="w-7 h-7 text-teal-400 opacity-80" strokeWidth={2} />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">Live SOS Feed Initialized</p>
                  <p className="text-xs text-slate-400 mt-1">Waiting for incoming mesh network distress signals...</p>
                </div>
              ) : (
                sortedSosList.map(sos => {
                  const isNewCard = newSosIds.has(sos.id);
                  const isFlashingHop = !!flashingHops[sos.id];
                  const isFlashingPriority = !!flashingPriority[sos.id];

                  return (
                    <div 
                      key={sos.id} 
                      className={`p-4 rounded-xl border bg-slate-950/90 shadow-lg shadow-black/40 transition-all duration-200 relative overflow-hidden backdrop-blur-sm ${
                        isNewCard ? 'animate-new-card' : ''
                      } ${
                        sos.status === 'resolved' || sos.status === 'false_positive' ? 'opacity-60 border-slate-800/60' :
                        sos.priority === 'CRITICAL' ? 'border-l-4 border-l-red-500 border-t-red-500/30 border-r-red-500/30 border-b-red-500/30 shadow-red-950/30' :
                        sos.priority === 'HIGH' ? 'border-l-4 border-l-orange-500 border-t-orange-500/30 border-r-orange-500/30 border-b-orange-500/30' :
                        'border-slate-800/90 hover:border-slate-700/80'
                      }`}
                    >
                      {/* Card Header: Category, Status & Priority */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider bg-slate-800/90 text-teal-300 px-2.5 py-1 rounded border border-teal-500/20">
                            {sos.category || 'Emergency'}
                          </span>
                          {renderStatusLabel(sos.status, sos.responderName)}
                        </div>
                        
                        {/* Animated Priority Badge */}
                        <div className={isFlashingPriority ? 'animate-priority-pop' : ''}>
                          {renderPriorityBadge(sos.priority)}
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-slate-200 font-medium mb-3 line-clamp-2 leading-relaxed">
                        {sos.description || 'No description provided.'}
                      </p>

                      {/* Tags */}
                      {sos.tags && sos.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {sos.tags.map((tag, idx) => (
                            <span key={idx} className="text-[10px] bg-slate-900 text-teal-400/90 px-2 py-0.5 rounded border border-teal-500/20 font-mono">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Meta Footer */}
                      <div className="flex items-center justify-between text-xs text-slate-400 pt-2.5 border-t border-slate-800/80">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1.5">
                            <Smartphone className="w-4 h-4 text-slate-400" strokeWidth={2} />
                            <strong className="text-slate-200">{sos.deviceName || sos.id}</strong>
                          </span>
                          
                          {/* Animated Hop Counter */}
                          <span className={`flex items-center gap-1.5 transition-all ${isFlashingHop ? 'animate-hop-flash text-teal-300 font-extrabold' : ''}`}>
                            <RefreshCw className={`w-4 h-4 text-teal-400 ${isFlashingHop ? 'animate-spin' : ''}`} strokeWidth={2} />
                            Hops: <strong className="text-teal-400 font-mono">{sos.hopCount}</strong>
                          </span>
                        </div>
                        
                        <span className="font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
                          {sos.timestamp ? new Date(sos.timestamp).toLocaleTimeString() : 'Just now'}
                        </span>
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center gap-2.5 mt-3 pt-2.5 border-t border-slate-800/80">
                        <button 
                          onClick={() => handleDispatch(sos.id)}
                          disabled={sos.status === 'dispatched' || sos.status === 'resolved' || sos.status === 'false_positive'}
                          className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all shadow-sm shadow-teal-900/40 flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 text-white" strokeWidth={2.2} /> Dispatch
                        </button>

                        <select
                          onChange={(e) => {
                            handleResolve(sos.id, e.target.value);
                            e.target.value = "";
                          }}
                          disabled={sos.status === 'resolved' || sos.status === 'false_positive'}
                          className="px-3 py-1.5 bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 text-xs font-medium rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 disabled:opacity-40 disabled:cursor-not-allowed flex-1 cursor-pointer"
                          defaultValue=""
                        >
                          <option value="" disabled>Resolve Options...</option>
                          <option value="resolved">Resolved</option>
                          <option value="false_positive">False Positive</option>
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Right Column: Map */}
          <section className="flex flex-col bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl overflow-hidden backdrop-blur-sm relative">
            
            {/* Map Header */}
            <div className="pb-3 border-b border-slate-800 flex justify-between items-center shrink-0 mb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-teal-400" strokeWidth={2.2} />
                </div>
                <span>Map — Delhi EOC</span>
              </h2>
              <span className="text-xs bg-teal-500/10 text-teal-300 px-3 py-1 rounded-full border border-teal-500/30 font-semibold flex items-center gap-1.5 font-mono shadow-sm">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                Grid (28.6139, 77.2090)
              </span>
            </div>

            {/* Leaflet Map Container */}
            <div className="flex-1 rounded-xl overflow-hidden border border-slate-800 relative z-0 shadow-2xl shadow-black/80">
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
                          <div className="font-bold text-sm text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-red-600 inline" strokeWidth={2.2} />
                            {sos.category || 'SOS Emergency'}
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
