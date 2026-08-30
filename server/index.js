const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 4000;

// State
let sosRecords = [];
const { relayNodes } = require('./meshEngine');

app.get('/api/sos', (req, res) => {
  res.json(sosRecords);
});

app.get('/api/nodes', (req, res) => {
  res.json(relayNodes);
});

app.post('/api/triage', (req, res) => {
  const { description, category } = req.body;
  
  let priority = 'NORMAL';
  let tags = [];
  
  const text = (description || '').toLowerCase();
  if (text.includes('fire') || text.includes('unconscious') || text.includes('bleeding')) {
    priority = 'CRITICAL';
    tags.push('immediate_dispatch');
  } else if (text.includes('broken') || text.includes('trapped')) {
    priority = 'HIGH';
    tags.push('medical_required');
  }

  res.json({ priority, tags });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('sos:trigger', (data) => {
    const record = {
      ...data,
      status: 'pending',
      totalHops: 0
    };
    
    sosRecords.unshift(record);
    io.emit('sos:new', record);
    
    // Simulate Mesh Network Hops
    let currentHop = 0;
    const maxHops = Math.floor(Math.random() * 3) + 1;
    
    const simulateHop = () => {
      currentHop++;
      if (currentHop <= maxHops) {
        const node = relayNodes[Math.floor(Math.random() * relayNodes.length)];
        io.emit('sos:hop', {
          sosId: record.id,
          fromNode: currentHop === 1 ? 'origin' : `node_${Math.floor(Math.random() * 5)}`,
          toNode: node.id,
          hopNumber: currentHop,
          batteryAtNode: node.battery
        });
        
        setTimeout(simulateHop, 1500);
      } else {
        record.totalHops = maxHops;
        io.emit('sos:arrived', {
          sosId: record.id,
          totalHops: maxHops,
          arrivalTimeMs: Date.now()
        });
        
        // Trigger AI Triage
        setTimeout(() => {
          let priority = 'NORMAL';
          let tags = [];
          const text = (record.description || '').toLowerCase();
          if (text.includes('fire') || text.includes('unconscious') || text.includes('bleeding')) {
            priority = 'CRITICAL';
            tags.push('immediate_dispatch');
          } else if (text.includes('broken') || text.includes('trapped')) {
            priority = 'HIGH';
            tags.push('medical_required');
          }
          
          record.priority = priority;
          record.tags = tags;
          io.emit('sos:triaged', { sosId: record.id, priority, tags });
        }, 1000);
      }
    };
    
    setTimeout(simulateHop, 1000);
  });
  
  socket.on('sos:dispatch', ({ sosId, responderName }) => {
    const record = sosRecords.find(r => r.id === sosId);
    if (record) {
      record.status = 'dispatched';
      record.responderName = responderName;
      io.emit('sos:statusUpdate', { sosId, status: 'dispatched' });
    }
  });
  
  socket.on('sos:resolve', ({ sosId, resolution }) => {
    const record = sosRecords.find(r => r.id === sosId);
    if (record) {
      record.status = resolution;
      io.emit('sos:statusUpdate', { sosId, status: resolution });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
