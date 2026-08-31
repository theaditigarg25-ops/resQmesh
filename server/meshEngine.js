const generateBattery = () => Math.floor(Math.random() * (100 - 5 + 1)) + 5;

const relayNodes = [
  { id: 0, name: 'Phone A (Sender)', battery: generateBattery(), isGateway: false },
  { id: 1, name: 'Phone B', battery: generateBattery(), isGateway: false },
  { id: 2, name: 'Phone C', battery: generateBattery(), isGateway: false },
  { id: 3, name: 'Phone D', battery: generateBattery(), isGateway: false },
  { id: 4, name: 'Phone E', battery: generateBattery(), isGateway: false },
  { id: 5, name: 'Emergency Node - Police Station', battery: generateBattery(), isGateway: true }
];

const activeEmergencies = new Map();
const seenPacketIds = new Set();

function routeToGateway(io, sos) {
  const numIntermediates = Math.floor(Math.random() * 2) + 2; // 2 or 3 intermediate nodes
  const visited = new Set([0]); // Start at node 0 (Sender)
  let currentNodeId = 0;
  let hopNumber = 1;
  let hopsRemaining = numIntermediates + 1; // Intermediates + Gateway

  const doHop = () => {
    if (hopsRemaining === 0) return;

    const delay = Math.floor(Math.random() * (1200 - 700 + 1)) + 700;
    
    setTimeout(() => {
      let nextNodeId = -1;
      
      if (hopsRemaining === 1) {
        // Last hop must be the gateway
        const gateway = relayNodes.find(n => n.isGateway);
        nextNodeId = gateway ? gateway.id : 5;
      } else {
        // Pick next unvisited node, preferring higher battery
        const availableNodes = relayNodes.filter(n => !n.isGateway && !visited.has(n.id));
        availableNodes.sort((a, b) => b.battery - a.battery);
        
        if (availableNodes.length > 0) {
          nextNodeId = availableNodes[0].id;
        } else {
          // Fallback if we run out of intermediates
          const gateway = relayNodes.find(n => n.isGateway);
          nextNodeId = gateway ? gateway.id : 5;
        }
      }

      visited.add(nextNodeId);
      
      const prevNode = relayNodes.find(n => n.id === currentNodeId);
      const nextNode = relayNodes.find(n => n.id === nextNodeId);

      sos.ttl -= 1;
      
      const hopData = {
        sosId: sos.id,
        fromNode: prevNode.name,
        toNode: nextNode.name,
        hopNumber,
        batteryAtNode: nextNode.battery
      };

      sos.hops.push(hopData);
      io.emit('sos:hop', hopData);
      
      currentNodeId = nextNodeId;
      hopNumber++;
      hopsRemaining--;

      if (hopsRemaining > 0) {
        if (sos.ttl <= 0) {
          console.log(`\n==========================================`);
          console.log(`🚨 [Mesh Fragmentation] Packet ${sos.id} LOST!`);
          console.log(`   TTL expired at intermediate node: ${nextNode.name}`);
          console.log(`==========================================\n`);
          
          sos.status = 'lost';
          io.emit('sos:statusUpdate', { sosId: sos.id, status: 'lost' });
          return;
        }
        doHop();
      } else {
        sos.status = 'arrived';
        sos.totalHops = hopNumber - 1;
        sos.arrivalTimeMs = Date.now() - sos.receivedAt;
        
        io.emit('sos:arrived', {
          sosId: sos.id,
          totalHops: sos.totalHops,
          arrivalTimeMs: sos.arrivalTimeMs
        });
      }
    }, delay);
  };

  doHop();
}

function initMesh(io) {
  io.on('connection', (socket) => {
    socket.on('sos:trigger', (data) => {
      if (seenPacketIds.has(data.id)) {
        console.log(`[Mesh Engine] Duplicate packet ignored: ${data.id}`);
        return;
      }
      seenPacketIds.add(data.id);

      const record = {
        ...data,
        status: 'relaying',
        hops: [],
        ttl: 6,
        receivedAt: Date.now()
      };
      
      activeEmergencies.set(data.id, record);
      
      // Immediately re-broadcast as 'sos:new' to ALL connected clients
      io.emit('sos:new', record);
      
      // Start the relay simulation
      routeToGateway(io, record);
    });
  });
}

module.exports = {
  relayNodes,
  activeEmergencies,
  initMesh
};
