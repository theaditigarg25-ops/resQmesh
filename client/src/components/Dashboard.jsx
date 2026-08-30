import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import { Activity, Navigation } from 'lucide-react';

// Fix for default Leaflet marker icon issues in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const socket = io('http://localhost:4000');

export default function Dashboard() {
  const [sosList, setSosList] = useState([]);

  useEffect(() => {
    // Initial fetch
    fetch('http://localhost:4000/api/sos')
      .then(res => res.json())
      .then(data => setSosList(data))
      .catch(err => console.error("Failed to fetch initial SOS data", err));

    // Socket listeners
    socket.on('sos:new', (newSos) => {
      setSosList(prev => [newSos, ...prev.filter(s => s.id !== newSos.id)]);
    });

    socket.on('sos:statusUpdate', ({ sosId, status }) => {
      setSosList(prev => prev.map(sos => 
        sos.id === sosId ? { ...sos, status } : sos
      ));
    });
    
    socket.on('sos:triaged', ({ sosId, priority, tags }) => {
      setSosList(prev => prev.map(sos => 
        sos.id === sosId ? { ...sos, priority, tags } : sos
      ));
    });

    socket.on('sos:arrived', ({ sosId, totalHops }) => {
      setSosList(prev => prev.map(sos => 
        sos.id === sosId ? { ...sos, totalHops } : sos
      ));
    });

    return () => {
      socket.off('sos:new');
      socket.off('sos:statusUpdate');
      socket.off('sos:triaged');
      socket.off('sos:arrived');
    };
  }, []);

  const handleDispatch = (sosId) => {
    socket.emit('sos:dispatch', { sosId, responderName: 'Team Alpha' });
  };

  const handleResolve = (sosId, resolution) => {
    socket.emit('sos:resolve', { sosId, resolution });
  };

  // Center map on SF by default, or first SOS if available
  const center = sosList.length > 0 && sosList[0].lat ? [sosList[0].lat, sosList[0].lng] : [37.7749, -122.4194];

  return (
    <div className="h-screen flex bg-slate-900 text-white">
      {/* Sidebar */}
      <div className="w-1/3 border-r border-slate-700 flex flex-col overflow-hidden max-w-sm">
        <div className="p-6 bg-slate-800 border-b border-slate-700 flex items-center justify-between z-10">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <Activity className="w-6 h-6 mr-2 text-red-500" />
              resqmesh
            </h1>
            <p className="text-slate-400 text-sm mt-1">Command Dashboard</p>
          </div>
          <div className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-sm font-semibold flex items-center">
            <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse"></span>
            LIVE
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sosList.length === 0 ? (
            <div className="text-center text-slate-500 mt-10">
              No active distress signals.
            </div>
          ) : (
            sosList.map(sos => (
              <div key={sos.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg relative overflow-hidden group">
                {sos.priority === 'CRITICAL' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>}
                {sos.priority === 'HIGH' && <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>}
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-md font-bold uppercase">
                      {sos.category}
                    </span>
                    {sos.priority && (
                      <span className={`text-xs px-2 py-1 rounded-md font-bold uppercase ${
                        sos.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                        sos.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {sos.priority}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(sos.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                
                <p className="text-sm text-slate-300 pl-2 mb-4 line-clamp-2">
                  {sos.description}
                </p>

                <div className="flex items-center justify-between pl-2 text-xs text-slate-500 mb-4">
                  <span className="flex items-center"><Navigation className="w-3 h-3 mr-1"/> {sos.totalHops ? `${sos.totalHops} hops` : 'Direct'}</span>
                  <span>Battery: {sos.battery}%</span>
                </div>
                
                <div className="flex gap-2 pl-2">
                  {sos.status === 'dispatched' ? (
                     <button className="flex-1 bg-slate-700 text-slate-400 py-2 rounded-lg text-sm font-semibold cursor-not-allowed" disabled>
                       Dispatched
                     </button>
                  ) : sos.status === 'resolved' || sos.status === 'false_positive' ? (
                     <button className="flex-1 bg-emerald-500/20 text-emerald-500 py-2 rounded-lg text-sm font-semibold cursor-not-allowed" disabled>
                       Resolved
                     </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleDispatch(sos.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Dispatch
                      </button>
                      <button 
                        onClick={() => handleResolve(sos.id, 'false_positive')}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative z-0">
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {sosList.map(sos => (
            <Marker key={sos.id} position={[sos.lat, sos.lng]}>
              <Popup className="custom-popup">
                <div className="font-sans text-slate-900">
                  <strong>{sos.category} Emergency</strong><br/>
                  {sos.priority && <span className="text-red-500 font-bold">{sos.priority}</span>}<br/>
                  <p className="mt-1 text-sm text-gray-700">{sos.description}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
