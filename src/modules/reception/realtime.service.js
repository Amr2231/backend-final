const { EventEmitter } = require("events");

const bus = new EventEmitter();
bus.setMaxListeners(200);

const CHANNELS = {
  APPOINTMENTS: "appointments",
  QUEUE: "queue",
  ARRIVAL_BOARD: "arrival_board",
  DASHBOARD: "dashboard",
  AVAILABILITY: "availability",
  NOTIFICATIONS: "notifications",
  CHAT: "chat",
};

/** @type {Map<number, import('http').ServerResponse[]>} */
const sseClients = new Map();

function emit(channel, payload) {
  bus.emit(channel, { channel, payload, ts: Date.now() });
  for (const [, clients] of sseClients) {
    const data = JSON.stringify({ channel, payload, ts: Date.now() });
    for (const res of clients) {
      res.write(`event: ${channel}\ndata: ${data}\n\n`);
    }
  }
}

function subscribe(userId, res) {
  if (!sseClients.has(userId)) sseClients.set(userId, []);
  sseClients.get(userId).push(res);

  res.on("close", () => {
    const list = sseClients.get(userId) || [];
    const idx = list.indexOf(res);
    if (idx >= 0) list.splice(idx, 1);
    if (list.length === 0) sseClients.delete(userId);
  });
}

function on(channel, handler) {
  bus.on(channel, handler);
}

module.exports = {
  CHANNELS,
  emit,
  subscribe,
  on,
};
