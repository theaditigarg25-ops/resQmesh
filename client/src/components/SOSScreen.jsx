import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Radio, Battery, Zap } from 'lucide-react';

const socket = io(import.meta.env.VITE_SERVER_URL || window.location.origin);
socket.on('connect', () => console.log('socket connected'));
socket.on('connect_error', (error) => console.log('socket connection failed', error));

const CATEGORIES = ['Flood', 'Fire', 'Earthquake', 'Accident', 'Medical', 'Personal Safety'];

const MESH_NODES = 5;

export default function SOSScreen() {
  const [status, setStatus] = useState('idle');
  const [category, setCategory] = useState('Medical');
  const [description, setDescription] = useState('');
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);
  const [activeSosId, setActiveSosId] = useState(null);
  const [activeHop, setActiveHop] = useState(-1);
  const [arrivalData, setArrivalData] = useState(null);
  const [relayMode, setRelayMode] = useState(true);
  const [batteryDisplay, setBatteryDisplay] = useState(null);

  useEffect(() => {
    const fetchBattery = async () => {
      if (navigator.getBattery) {
        try {
          const batt = await navigator.getBattery();
          setBatteryDisplay(Math.round(batt.level * 100));
          batt.addEventListener('levelchange', () => {
            setBatteryDisplay(Math.round(batt.level * 100));
          });
        } catch (err) {
          setBatteryDisplay(Math.floor(Math.random() * 81) + 20);
        }
      } else {
        setBatteryDisplay(Math.floor(Math.random() * 81) + 20);
      }
    };
    fetchBattery();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeSosId) return;

    const onHop = (data) => {
      if (data.sosId === activeSosId) {
        setActiveHop(data.hopNumber);
      }
    };

    const onArrived = (data) => {
      if (data.sosId === activeSosId) {
        setArrivalData(data);
        setStatus('arrived');
      }
    };

    socket.on('sos:hop', onHop);
    socket.on('sos:arrived', onArrived);

    return () => {
      socket.off('sos:hop', onHop);
      socket.off('sos:arrived', onArrived);
    };
  }, [activeSosId]);

  const startCountdown = () => {
    setCountdown(3);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setCountdown(null);
          handleSOS();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(null);
  };

  const handleSOS = async () => {
    setStatus('sending');
    let lat = 28.6139, lng = 77.2090;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (err) {
        // Fallback to Delhi coordinates
      }
    }

    let battery = Math.floor(Math.random() * 81) + 20;
    if (navigator.getBattery) {
      try {
        const batt = await navigator.getBattery();
        battery = Math.round(batt.level * 100);
      } catch (err) { /* keep random fallback */ }
    }

    const id = crypto.randomUUID();
    const payload = {
      id,
      category,
      description,
      lat,
      lng,
      battery,
      timestamp: Date.now(),
      deviceName: 'Phone A'
    };

    setActiveSosId(id);
    setActiveHop(-1);
    setArrivalData(null);
    socket.emit('sos:trigger', payload);
    setStatus('meshing');
  };

  const resetToIdle = () => {
    setStatus('idle');
    setActiveSosId(null);
    setActiveHop(-1);
    setArrivalData(null);
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-red-950/30 p-6 overflow-hidden">
      <div className="w-full max-w-[400px] bg-gradient-to-b from-slate-900 to-slate-950 rounded-[36px] shadow-[0_0_60px_rgba(220,38,38,0.15)] border border-red-900/30 p-6 pt-14 pb-8 flex flex-col items-center h-full max-h-[640px] relative overflow-hidden">

        {/* Settings Row */}
        <div className="absolute top-0 left-0 right-0 px-5 pt-3.5 pb-3 bg-slate-900/90 backdrop-blur-sm border-b border-red-900/20 rounded-t-[36px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setRelayMode(!relayMode)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${relayMode ? 'bg-orange-500' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${relayMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
              </button>
              <span className="text-xs font-semibold text-slate-200">Relay Mode</span>
            </div>
            <div className="flex items-center gap-2">
              <Battery className={`w-4 h-4 ${(batteryDisplay || 0) > 30 ? 'text-orange-400' : 'text-red-400'}`} strokeWidth={2} />
              <span className={`text-xs font-bold ${(batteryDisplay || 0) > 30 ? 'text-orange-400' : 'text-red-400'}`}>
                {batteryDisplay ?? '--'}%
              </span>
            </div>
          </div>
        </div>

        <h2 className="text-slate-200 font-bold mb-4 text-base tracking-widest uppercase mt-3">Emergency</h2>

        <div className="w-full bg-slate-800/60 rounded-2xl p-4 mb-6 shadow-inner border border-red-900/20">
          <div className="flex flex-wrap gap-2 mb-3 justify-center">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${category === cat
                  ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md shadow-red-500/30'
                  : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600 hover:text-slate-100'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <input
            type="text"
            maxLength={100}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's happening? (optional)"
            className="w-full bg-slate-900/80 border border-red-900/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
          />
        </div>

        <button
          onClick={startCountdown}
          disabled={status !== 'idle' || countdown !== null}
          className="w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-[0_0_40px_rgba(220,38,38,0.4)] bg-gradient-to-br from-red-500 via-red-600 to-orange-700 hover:from-red-400 hover:via-red-500 hover:to-orange-600 active:scale-[0.98] cursor-pointer border-2 border-red-400/30 shrink-0"
        >
          <span className="text-white text-5xl font-extrabold tracking-wider drop-shadow-lg">SOS</span>
        </button>

        <p className="mt-6 text-slate-400 text-xs text-center px-6 leading-relaxed">
          Broadcasts your location to nearby mesh nodes immediately.
        </p>

        {/* Home indicator line */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1.5 bg-slate-700 rounded-full"></div>

        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center z-50 rounded-[36px]">
            <span className="text-white text-8xl font-extrabold leading-none animate-pulse">
              {countdown}
            </span>
            <p className="text-red-100 text-lg font-semibold mt-6 mb-8">Sending SOS...</p>
            <button
              onClick={cancelCountdown}
              className="px-10 py-3.5 bg-white/20 border-2 border-white rounded-full text-white text-base font-bold hover:bg-white/30 active:scale-[0.98] transition-all cursor-pointer"
            >
              CANCEL
            </button>
          </div>
        )}

        {/* Meshing Overlay — Sending via mesh with hop visualization */}
        {status === 'meshing' && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center z-50 rounded-[36px] px-6">
            {/* Radar animation */}
            <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
              <div className="absolute w-full h-full rounded-full border-2 border-red-500/30 animate-radar-ping"></div>
              <div className="absolute w-full h-full rounded-full border-2 border-red-500/20 animate-radar-ping-delayed"></div>
              <div className="absolute w-full h-full rounded-full border-2 border-red-500/10 animate-radar-ping-delayed-2"></div>
              <div className="w-10 h-10 bg-red-500 rounded-full shadow-lg shadow-red-500/50"></div>
            </div>

            <p className="text-white text-lg font-bold mb-1.5 animate-pulse">Sending via mesh...</p>
            <p className="text-slate-300 text-sm mb-8">Relaying through nearby nodes</p>

            {/* Hop node visualization */}
            <div className="flex items-center gap-3">
              {Array.from({ length: MESH_NODES }).map((_, i) => {
                const isReached = i <= activeHop;
                const isActive = i === activeHop;
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div className={`w-10 h-14 rounded-lg flex items-center justify-center transition-all duration-300 ${isActive
                      ? 'bg-red-500 shadow-lg shadow-red-500/50 scale-110 animate-hop-glow'
                      : isReached
                        ? 'bg-emerald-500/80 shadow-md shadow-emerald-500/30'
                        : 'bg-slate-700'
                      }`}>
                      {/* Phone icon */}
                      <svg className={`w-5 h-5 ${isReached ? 'text-white' : 'text-slate-400'}`} fill="currentColor" viewBox="0 0 24 24">
                        <rect x="7" y="2" width="10" height="20" rx="2" />
                        <circle cx="12" cy="18" r="1" fill={isReached ? '#1e293b' : '#94a3b8'} />
                      </svg>
                    </div>
                    <span className={`text-xs mt-1.5 font-semibold ${isActive ? 'text-red-400' : isReached ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {i === 0 ? 'You' : i === MESH_NODES - 1 ? 'Base' : `N${i}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Arrived Overlay — Success screen */}
        {status === 'arrived' && arrivalData && (
          <div className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center z-50 rounded-[36px] px-6">
            {/* Checkmark */}
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6">
              <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-white text-2xl font-extrabold mb-2">Rescue Notified!</h3>
            <p className="text-emerald-100 text-base font-semibold text-center leading-relaxed">
              Reached Rescue Node in {arrivalData.totalHops} hops, {(arrivalData.arrivalTimeMs / 1000).toFixed(1)}s
            </p>

            <button
              onClick={resetToIdle}
              className="mt-8 px-10 py-3.5 bg-white/20 border-2 border-white rounded-full text-white text-base font-bold hover:bg-white/30 active:scale-[0.98] transition-all cursor-pointer"
            >
              DONE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
