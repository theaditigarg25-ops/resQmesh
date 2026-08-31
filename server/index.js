const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { relayNodes, activeEmergencies, initMesh } = require('./meshEngine');

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

app.get('/api/sos', (req, res) => {
  res.json(Array.from(activeEmergencies.values()));
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

initMesh(io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('sos:dispatch', ({ sosId, responderName }) => {
    const record = activeEmergencies.get(sosId);
    if (record) {
      record.status = 'dispatched';
      record.responderName = responderName;
      io.emit('sos:statusUpdate', { sosId, status: 'dispatched' });
    }
  });
  
  socket.on('sos:resolve', ({ sosId, resolution }) => {
    const record = activeEmergencies.get(sosId);
    if (record) {
      record.status = resolution;
      io.emit('sos:statusUpdate', { sosId, status: resolution });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Error: Port ${PORT} is already in use by another process.`);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

