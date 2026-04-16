require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, "http://localhost:5173"]
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", rooms: Object.keys(rooms).length });
});

// ─── Rooms ─────────────────────────────────────────────────────────────────
const rooms = {};

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getAvatar(name) {
  const colors = ["#e11d48","#7c3aed","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#14b8a6"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return { color: colors[Math.abs(hash) % colors.length], initials: name.slice(0, 2).toUpperCase() };
}

setInterval(() => {
  const now = Date.now();
  for (const id in rooms) {
    if (rooms[id].users.length === 0 && now - rooms[id].createdAt > 10 * 60 * 1000) delete rooms[id];
  }
}, 5 * 60 * 1000);

// ─── Socket.IO ─────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {

  // ── Create Room ──────────────────────────────────────────────────────────
  socket.on("create-room", ({ name, roomName, password }) => {
    if (!name?.trim() || !roomName?.trim() || !password?.trim()) {
      return socket.emit("room-error", { message: "All fields are required." });
    }
    const roomId = makeRoomId();
    const user = { id: socket.id, name: name.trim().slice(0,20), isHost: true, avatar: getAvatar(name) };
    rooms[roomId] = {
      id: roomId, name: roomName.trim().slice(0,40), password: password.trim(),
      hostId: socket.id, users: [user],
      currentMovie: null, isPlaying: false, currentTime: 0,
      lastSyncAt: Date.now(), createdAt: Date.now(),
    };
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.user = user;
    socket.emit("room-created", { roomId, roomName: rooms[roomId].name, user });
    console.log(`[ROOM] "${roomName}" (${roomId}) by ${name}`);
  });

  // ── Join Room ────────────────────────────────────────────────────────────
  socket.on("join-room", ({ name, roomId, password }) => {
    if (!name?.trim() || !roomId?.trim() || !password?.trim()) {
      return socket.emit("room-error", { message: "All fields are required." });
    }
    const room = rooms[roomId.trim().toUpperCase()];
    if (!room) return socket.emit("room-error", { message: "Room not found. Check the Room ID." });
    if (room.password !== password.trim()) return socket.emit("room-error", { message: "Wrong password." });

    const user = { id: socket.id, name: name.trim().slice(0,20), isHost: false, avatar: getAvatar(name) };
    room.users.push(user);
    socket.join(room.id);
    socket.data.roomId = room.id;
    socket.data.user = user;

    socket.emit("join-success", {
      roomId: room.id, roomName: room.name, user,
      roomState: {
        currentMovie: room.currentMovie,
        isPlaying: room.isPlaying,
        currentTime: room.currentTime,
        hostId: room.hostId,
      },
    });
    io.to(room.id).emit("users-update", room.users);
    io.to(room.id).emit("system-message", { text: `${user.name} joined the party 🎉`, timestamp: Date.now() });

    // Tell host a new viewer needs a WebRTC connection
    if (room.hostId && room.hostId !== socket.id) {
      socket.to(room.hostId).emit("viewer-joined", { viewerId: socket.id, viewerName: user.name });
    }
    console.log(`[JOIN] ${name} → ${room.id}`);
  });

  // ── WebRTC Signalling ────────────────────────────────────────────────────
  // Host → Viewer: send offer
  socket.on("webrtc-offer", ({ viewerId, offer }) => {
    socket.to(viewerId).emit("webrtc-offer", { hostId: socket.id, offer });
  });

  // Viewer → Host: send answer
  socket.on("webrtc-answer", ({ hostId, answer }) => {
    socket.to(hostId).emit("webrtc-answer", { viewerId: socket.id, answer });
  });

  // ICE candidates (both directions)
  socket.on("webrtc-ice", ({ targetId, candidate }) => {
    socket.to(targetId).emit("webrtc-ice", { fromId: socket.id, candidate });
  });

  // ── Playback sync (host → all viewers) ──────────────────────────────────
  socket.on("host-play", ({ currentTime }) => {
    const room = getRoom(socket);
    if (!room || !isHost(socket, room)) return;
    room.isPlaying = true; room.currentTime = currentTime; room.lastSyncAt = Date.now();
    socket.to(room.id).emit("sync-play", { currentTime });
  });

  socket.on("host-pause", ({ currentTime }) => {
    const room = getRoom(socket);
    if (!room || !isHost(socket, room)) return;
    room.isPlaying = false; room.currentTime = currentTime; room.lastSyncAt = Date.now();
    socket.to(room.id).emit("sync-pause", { currentTime });
  });

  socket.on("host-seek", ({ currentTime }) => {
    const room = getRoom(socket);
    if (!room || !isHost(socket, room)) return;
    room.currentTime = currentTime; room.lastSyncAt = Date.now();
    socket.to(room.id).emit("sync-seek", { currentTime });
  });

  // Host announces movie info (name only, no file)
  socket.on("host-set-movie", ({ movieName }) => {
    const room = getRoom(socket);
    if (!room || !isHost(socket, room)) return;
    room.currentMovie = { name: movieName };
    room.isPlaying = false; room.currentTime = 0;
    io.to(room.id).emit("movie-set", { movieName });
    io.to(room.id).emit("system-message", { text: `${socket.data.user.name} loaded: ${movieName} 🎬`, timestamp: Date.now() });
  });

  socket.on("request-sync", () => {
    const room = getRoom(socket);
    if (!room) return;
    socket.emit("sync-state", { currentTime: room.currentTime, isPlaying: room.isPlaying, currentMovie: room.currentMovie });
  });

  // ── Chat ─────────────────────────────────────────────────────────────────
  socket.on("chat-message", ({ text }) => {
    const room = getRoom(socket); const user = socket.data.user;
    if (!room || !user) return;
    io.to(room.id).emit("chat-message", {
      id: `${Date.now()}-${socket.id}`, userId: socket.id,
      name: user.name, avatar: user.avatar,
      text: text.trim().slice(0, 300), timestamp: Date.now(),
    });
  });

  // ── Reactions ────────────────────────────────────────────────────────────
  socket.on("reaction", ({ emoji }) => {
    const room = getRoom(socket); const user = socket.data.user;
    if (!room || !user) return;
    io.to(room.id).emit("reaction", { id: `${Date.now()}-${socket.id}`, emoji, name: user.name, x: Math.random() * 80 + 10 });
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const room = getRoom(socket); const user = socket.data.user;
    if (!room || !user) return;

    // Tell all peers to close their connection to this socket
    socket.to(room.id).emit("peer-disconnected", { peerId: socket.id });

    room.users = room.users.filter((u) => u.id !== socket.id);
    if (room.hostId === socket.id && room.users.length > 0) {
      room.users[0].isHost = true; room.hostId = room.users[0].id;
      io.to(room.id).emit("host-changed", { newHostId: room.hostId });
      io.to(room.id).emit("system-message", { text: `${room.users[0].name} is now the host 👑`, timestamp: Date.now() });
    }
    io.to(room.id).emit("users-update", room.users);
    io.to(room.id).emit("system-message", { text: `${user.name} left`, timestamp: Date.now() });
  });
});

function getRoom(socket) { return socket.data.roomId ? rooms[socket.data.roomId] : null; }
function isHost(socket, room) { return room.hostId === socket.id; }

server.listen(PORT, () => console.log(`\n🎬 CineSync running on port ${PORT}\n`));
