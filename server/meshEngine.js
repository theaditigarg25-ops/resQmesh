const generateBattery = () => Math.floor(Math.random() * (100 - 5 + 1)) + 5;

const relayNodes = [
  { id: 0, name: 'Phone A (Sender)', battery: generateBattery(), isGateway: false },
  { id: 1, name: 'Phone B', battery: generateBattery(), isGateway: false },
  { id: 2, name: 'Phone C', battery: generateBattery(), isGateway: false },
  { id: 3, name: 'Phone D', battery: generateBattery(), isGateway: false },
  { id: 4, name: 'Phone E', battery: generateBattery(), isGateway: false },
  { id: 5, name: 'Emergency Node - Police Station', battery: generateBattery(), isGateway: true }
];

module.exports = {
  relayNodes
};
