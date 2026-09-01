import React, { useState } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { AlertCircle, Send, CheckCircle } from 'lucide-react';

const socket = io('http://localhost:4000');
socket.on('connect', () => console.log('socket connected'));
socket.on('connect_error', (error) => console.log('socket connection failed', error));

const CATEGORIES = ['Medical', 'Fire', 'Police', 'Rescue', 'Other'];

export default function SOSTrigger() {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [status, setStatus] = useState('idle'); // idle, sending, sent, error
  const [errorMessage, setErrorMessage] = useState('');
  
  const handleTrigger = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      // Gather geolocation (mock or real)
      let lat = 0, lng = 0;
      if (navigator.geolocation) {
         try {
           const pos = await new Promise((resolve, reject) => {
             navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
           });
           lat = pos.coords.latitude;
           lng = pos.coords.longitude;
         } catch (geoError) {
           console.warn("Could not get exact location, using fallback.");
           // Fallback to rough generic coordinates (e.g. San Francisco)
           lat = 37.7749 + (Math.random() - 0.5) * 0.1;
           lng = -122.4194 + (Math.random() - 0.5) * 0.1;
         }
      }

      // Gather battery (mock or real)
      let battery = 100;
      if (navigator.getBattery) {
        try {
          const batt = await navigator.getBattery();
          battery = Math.round(batt.level * 100);
        } catch (err) {}
      }

      const payload = {
        id: uuidv4(),
        category,
        description,
        lat,
        lng,
        battery,
        timestamp: Date.now(),
        deviceName: navigator.userAgent.substring(0, 50) || 'Unknown Device'
      };

      socket.emit('sos:trigger', payload);
      
      setStatus('sent');
      setTimeout(() => {
        setStatus('idle');
        setDescription('');
        setCategory(CATEGORIES[0]);
      }, 3000);
      
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage('Failed to trigger SOS. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
        <div className="bg-red-600 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <AlertCircle className="w-20 h-20 text-white mx-auto mb-4 relative z-10" />
          <h1 className="text-4xl font-extrabold text-white tracking-tight relative z-10">SOS EMERGENCY</h1>
          <p className="text-red-100 mt-2 font-medium relative z-10">Transmit distress signal via mesh network</p>
        </div>
        
        <form onSubmit={handleTrigger} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Emergency Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all cursor-pointer"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Description / Details</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="4"
              placeholder="Provide critical details (e.g., injuries, hazards, people involved)..."
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all resize-none"
              required
            ></textarea>
          </div>

          {status === 'error' && (
             <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-xl text-sm">
               {errorMessage}
             </div>
          )}

          <button
            type="submit"
            disabled={status === 'sending' || status === 'sent'}
            className={`w-full py-4 rounded-xl font-extrabold text-xl flex items-center justify-center transition-all shadow-lg ${
              status === 'sent' 
                ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-600/30 active:scale-[0.98]'
            }`}
          >
            {status === 'idle' && (
              <>
                <Send className="w-6 h-6 mr-3" />
                BROADCAST SOS
              </>
            )}
            {status === 'sending' && (
              <span className="animate-pulse">TRANSMITTING...</span>
            )}
            {status === 'sent' && (
              <>
                <CheckCircle className="w-6 h-6 mr-3" />
                SIGNAL SENT
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
