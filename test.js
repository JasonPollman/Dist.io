var socket = require('socket.io-client')('http://localhost:1337');
socket.on('connect', () => {
  console.log('connected');
});
