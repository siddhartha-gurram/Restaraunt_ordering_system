const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { v4: uuid } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// serve files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// in-memory list of orders
let orders = [];
let orderNumber = 1;

io.on('connection', (socket) => {
  console.log('new device connected');
  socket.emit('orders', orders);

  // tablet → create
  socket.on('createOrder', (data) => {
    const items = (data.items || [])
      .filter(it => it && it.name && Number(it.qty) > 0)
      .map(it => ({ id: it.id || uuid(), name: it.name, qty: Number(it.qty) || 1 }));

    if (!items.length) return;

    const order = {
      id: uuid(),
      number: orderNumber++,
      items,
      tableName: data.tableName || 'ToGo',
      notes: data.notes || '',
      status: 'new', // 'new' | 'preparing' | 'completed'
      createdAt: Date.now()
    };
    orders.push(order);
    io.emit('orders', orders);
  });

  // tablet → update (edit items/notes/table)
  socket.on('updateOrder', (data) => {
    const { id, items, tableName, notes } = data || {};
    const o = orders.find(x => x.id === id);
    if (!o) return;

    if (Array.isArray(items)) {
      o.items = items
        .filter(it => it && it.name && Number(it.qty) > 0)
        .map(it => ({ id: it.id || uuid(), name: it.name, qty: Number(it.qty) || 1 }));
    }
    if (typeof tableName === 'string') o.tableName = tableName.trim() || o.tableName;
    if (typeof notes === 'string') o.notes = notes;

    io.emit('orders', orders);
  });

  // optional: set preparing
  socket.on('setPreparing', (id) => {
    const o = orders.find(x => x.id === id);
    if (!o) return;
    o.status = 'preparing';
    io.emit('orders', orders);
  });

  // tv double-OK → complete
  socket.on('completeOrder', (id) => {
    const o = orders.find(x => x.id === id);
    if (!o) return;
    o.status = 'completed';
    io.emit('orders', orders);
  });

  // tv triple-OK → remove
  socket.on('removeOrder', (id) => {
    orders = orders.filter(o => o.id !== id);
    io.emit('orders', orders);
  });
});

server.listen(PORT, () => {
  console.log(`server running at http://localhost:${PORT}`);
});
