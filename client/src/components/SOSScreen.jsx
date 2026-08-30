import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:4000');

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

    let battery = Math.floor(Math.random() * 81) + 20; // fallback: random 20-100
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-[400px] bg-slate-900 rounded-[40px] shadow-2xl border-4 border-slate-800 p-8 flex flex-col items-center justify-center min-h-[700px] relative overflow-hidden">

        {/* Mock Status Bar */}
        <div className="absolute top-4 w-full px-6 flex justify-between items-center text-slate-400 text-xs font-semibold">
          <span>9:41</span>
          <div className="flex space-x-2">
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        <h2 className="text-slate-300 font-bold mb-6 text-xl tracking-widest uppercase">Emergency</h2>

        <div className="w-full bg-slate-800 rounded-3xl p-5 mb-8 shadow-inner border border-slate-700/50">
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${category === cat
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
          />
        </div>

        <button
          onClick={startCountdown}
          disabled={status !== 'idle' || countdown !== null}
          className="w-56 h-56 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl bg-red-600 hover:bg-red-500 active:scale-95 shadow-red-600/50 cursor-pointer"
        >
          <span className="text-white text-6xl font-extrabold tracking-wider">SOS</span>
        </button>

        <p className="mt-16 text-slate-500 text-sm text-center px-4">
          Pressing this button will broadcast your location to all nearby mesh nodes immediately.
        </p>

        {/* Home indicator line */}
        <div className="absolute bottom-2 w-32 h-1.5 bg-slate-700 rounded-full"></div>

        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center z-50 rounded-[40px]">
            <span className="text-white text-[10rem] font-extrabold leading-none animate-pulse">
              {countdown}
            </span>
            <p className="text-red-200 text-lg font-semibold mt-4 mb-12">Sending SOS...</p>
            <button
              onClick={cancelCountdown}
              className="px-12 py-4 bg-white/20 border-2 border-white rounded-full text-white text-xl font-bold hover:bg-white/30 active:scale-95 transition-all"
            >
              CANCEL
            </button>
          </div>
        )}

        {/* Meshing Overlay — Sending via mesh with hop visualization */}
        {status === 'meshing' && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center z-50 rounded-[40px] px-6">
            {/* Radar animation */}
            <div className="relative w-40 h-40 mb-10 flex items-center justify-center">
              <div className="absolute w-full h-full rounded-full border-2 border-red-500/30 animate-radar-ping"></div>
              <div className="absolute w-full h-full rounded-full border-2 border-red-500/20 animate-radar-ping-delayed"></div>
              <div className="absolute w-full h-full rounded-full border-2 border-red-500/10 animate-radar-ping-delayed-2"></div>
              <div className="w-10 h-10 bg-red-500 rounded-full shadow-lg shadow-red-500/50"></div>
            </div>

            <p className="text-white text-xl font-bold mb-2 animate-pulse">Sending via mesh...</p>
            <p className="text-slate-400 text-sm mb-12">Relaying through nearby nodes</p>

            {/* Hop node visualization */}
            <div className="flex items-center space-x-3">
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
                      <svg className={`w-5 h-5 ${isReached ? 'text-white' : 'text-slate-500'}`} fill="currentColor" viewBox="0 0 24 24">
                        <rect x="7" y="2" width="10" height="20" rx="2" />
                        <circle cx="12" cy="18" r="1" fill={isReached ? '#1e293b' : '#94a3b8'} />
                      </svg>
                    </div>
                    <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'text-red-400' : isReached ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {i === 0 ? 'You' : i === MESH_NODES - 1 ? 'Base' : `N${i}`}
                    </span>
                    {i < MESH_NODES - 1 && (
                      <div className={`absolute mt-7 ml-12 w-3 h-0.5 ${isReached && i < activeHop ? 'bg-emerald-500' : 'bg-slate-700'}`} style={{ left: `${i * 52 + 26}px` }}></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Arrived Overlay — Success screen */}
        {status === 'arrived' && arrivalData && (
          <div className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center z-50 rounded-[40px] px-6">
            {/* Checkmark */}
            <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mb-8">
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-white text-2xl font-extrabold mb-2">Rescue Notified!</h3>
            <p className="text-emerald-100 text-lg font-semibold text-center">
              Reached Rescue Node in {arrivalData.totalHops} hops, {(arrivalData.arrivalTimeMs / 1000).toFixed(1)}s
            </p>

            <button
              onClick={resetToIdle}
              className="mt-12 px-10 py-4 bg-white/20 border-2 border-white rounded-full text-white text-lg font-bold hover:bg-white/30 active:scale-95 transition-all"
            >
              DONE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
