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

app.get('/api/sos', (req, res) => {
  res.json([]);
});

app.get('/api/nodes', (req, res) => {
  res.json([]);
});

app.post('/api/triage', (req, res) => {
  res.json({ priority: 'NORMAL', tags: [] });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('sos:trigger', (data) => {
    // Broadcast immediately per contract
    io.emit('sos:new', data);
  });
  
  socket.on('sos:dispatch', (data) => {
    // ...
  });
  
  socket.on('sos:resolve', (data) => {
    // ...
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
