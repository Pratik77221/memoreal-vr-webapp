const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const easyrtc = require("open-easyrtc");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Configure CORS for production
const io = socketIo(server, {
  cors: {
    origin: ["https://memoreal.pratikmane.tech", "http://localhost:8080", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const port = process.env.PORT || 8080;

console.log("Starting MemoReal Multiplayer Server...");
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Serve static files from current directory (FrontEnd)
app.use(express.static(__dirname));

// Main routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/vr", (req, res) => {
  res.sendFile(path.join(__dirname, "vr.html"));
});

app.get("/videovr", (req, res) => {
  res.sendFile(path.join(__dirname, "videovr.html"));
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "MemoReal multiplayer server is running",
    timestamp: new Date().toISOString(),
    multiplayer: "enabled",
    port: port,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Initialize EasyRTC for multiplayer VR support
easyrtc.listen(app, io, null, (err, rtcRef) => {
  if (err) {
    console.error("EasyRTC error:", err);
    return;
  }
  console.log("EasyRTC multiplayer server started");
  console.log("Multiplayer VR features enabled");
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
  
  // Handle VR room events
  socket.on('joinVRRoom', (roomName) => {
    socket.join(roomName);
    console.log(`User ${socket.id} joined VR room: ${roomName}`);
    socket.to(roomName).emit('userJoinedVR', socket.id);
  });
  
  socket.on('leaveVRRoom', (roomName) => {
    socket.leave(roomName);
    console.log(`User ${socket.id} left VR room: ${roomName}`);
    socket.to(roomName).emit('userLeftVR', socket.id);
  });
});

server.listen(port, () => {
  console.log(`MemoReal server running at http://localhost:${port}`);
  console.log(`Main app: http://localhost:${port}/`);
  console.log(`VR experience: http://localhost:${port}/vr`);
  console.log(`Multiplayer: Enabled`);
  console.log(`Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down MemoReal server...');
  server.close(() => {
    console.log('Server closed gracefully');
    process.exit(0);
  });
});
