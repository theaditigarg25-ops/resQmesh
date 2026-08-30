import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:4000');

const CATEGORIES = ['Flood', 'Fire', 'Earthquake', 'Accident', 'Medical', 'Personal Safety'];

export default function SOSScreen() {
  const [status, setStatus] = useState('idle');
  const [category, setCategory] = useState('Medical');
  const [description, setDescription] = useState('');
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

    const payload = {
      id: crypto.randomUUID(),
      category,
      description,
      lat,
      lng,
      battery,
      timestamp: Date.now(),
      deviceName: 'Phone A'
    };

    socket.emit('sos:trigger', payload);

    setStatus('sent');
    setTimeout(() => setStatus('idle'), 3000);
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
          className={`w-56 h-56 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl ${status === 'sent'
            ? 'bg-emerald-500 shadow-emerald-500/50 scale-95'
            : 'bg-red-600 hover:bg-red-500 active:scale-95 shadow-red-600/50 cursor-pointer'
            }`}
        >
          {status === 'idle' && (
            <span className="text-white text-6xl font-extrabold tracking-wider">SOS</span>
          )}
          {status === 'sending' && (
            <span className="text-white text-xl font-bold animate-pulse">SENDING</span>
          )}
          {status === 'sent' && (
            <span className="text-white text-2xl font-bold">SENT!</span>
          )}
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
      </div>
    </div>
  );
}
