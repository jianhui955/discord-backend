if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require('ws');
}
