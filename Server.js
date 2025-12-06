// server.js - simple pairing WebSocket server
const WebSocket = require('ws');

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });

console.log('Servidor WebSocket listening on port', PORT);

let waiting = null;

wss.on('connection', (ws) => {
  console.log('Usuario conectado');

  // Si no hay nadie esperando, ponemos a este como "waiting"
  if (waiting === null) {
    waiting = ws;
    ws.send(JSON.stringify({ type: 'info', msg: 'Esperando pareja...' }));
    ws.isWaiting = true;
    return;
  }

  // si hay alguien esperando, lo emparejamos
  const partner = waiting;
  waiting = null;

  // asignamos partner en ambos sockets
  ws.partner = partner;
  partner.partner = ws;

  // avisamos a ambos
  ws.send(JSON.stringify({ type: 'paired', msg: 'Pareado con un extraño' }));
  partner.send(JSON.stringify({ type: 'paired', msg: 'Pareado con un extraño' }));

  // Mensajes que vienen de un cliente los reenviamos al partner
  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      // forward ICE / offer / answer / text / leave
      if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
        // if it's "leave" we forward and then cleanup
        if (data.type === 'leave') {
          ws.partner.send(JSON.stringify({ type: 'leave' }));
          ws.partner.partner = null;
          ws.partner.close();
          ws.partner = null;
          return;
        }
        // forward normally
        ws.partner.send(JSON.stringify(data));
      }
    } catch (e) {
      console.warn('invalid message', e);
    }
  });

  ws.on('close', () => {
    console.log('Usuario desconectado');
    // notify partner
    if (ws.partner && ws.partner.readyState === WebSocket.OPEN) {
      ws.partner.send(JSON.stringify({ type: 'leave' }));
      ws.partner.partner = null;
    }
    // if this ws was waiting, clear waiting
    if (waiting === ws) waiting = null;
  });

  ws.on('error', (err) => {
    console.error('WS error', err);
  });
});
