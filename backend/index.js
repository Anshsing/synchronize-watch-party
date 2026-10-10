require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Security & Logging & Comforts
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Redis Client & Adapter for Scalable WebSockets
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

const app = express();

// Middlewares
app.use(helmet({ crossOriginResourcePolicy: false })); // Allow cross-origin images/videos
app.use(cors());
app.use(express.json());
// express-mongo-sanitize removed due to Express 5 compatibility issue (Mongoose schema types provide native protection)
app.use(morgan('[:date[iso]] HTTP :method :url :status - :response-time ms')); // Logging

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Setup Local Uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    // Sanitize original filename (remove special chars)
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + safeName);
  }
});
const upload = multer({ storage });

// Mongoose Setup
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('✅ Connected to MongoDB Atlas!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  videoUrl: { type: String, required: true },
  hostToken: { type: String, required: true },
  hostSocketId: { type: String, default: null },
  controlsLocked: { type: Boolean, default: false },
  isBlacklisted: { type: Boolean, default: false }, // Feature: Expire links
  createdAt: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', roomSchema);

// REST APIs
app.post('/api/create-room', upload.single('video'), async (req, res) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hostToken = Math.random().toString(36).substring(2, 12);
    let videoUrl = req.body.videoUrl;

    if (req.file) {
        videoUrl = `http://localhost:${process.env.PORT || 3001}/uploads/${req.file.filename}`;
    }

    if (!videoUrl) return res.status(400).json({ error: 'Video file or URL is required' });

    try {
      await Room.create({ roomId, videoUrl, hostToken });
      console.log(`[ACTIVITY] Room Created: ${roomId} with media: ${videoUrl.substring(0, 50)}...`);
      res.json({ roomId, videoUrl, hostToken });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error creating room' });
    }
});

app.get('/api/room/:roomId', async (req, res) => {
    try {
      // Basic sanitization of URL param
      const safeRoomId = req.params.roomId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const room = await Room.findOne({ roomId: safeRoomId });
      
      if (!room) {
          return res.status(404).json({ error: 'Room not found', code: 'NOT_FOUND' });
      }
      
      if (room.isBlacklisted) {
          return res.status(403).json({ error: 'Room link has expired (Blacklisted)', code: 'EXPIRED' });
      }

      res.json({ videoUrl: room.videoUrl, controlsLocked: room.controlsLocked }); 
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error fetching room', code: 'SERVER_ERROR' });
    }
});

const server = http.createServer(app);

// WebSocket Setup
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const activeRooms = {}; 
const blacklistTimeouts = {}; 

async function setupRedisAdapter() {
  if (process.env.REDIS_URL && !process.env.REDIS_URL.includes("localhost")) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      await pubClient.connect();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      console.log("✅ Redis Adapter connected for scalable WebSockets!");
    } catch (err) {
      console.log("⚠️ Redis connection failed. Falling back to in-memory Socket.io adapter.");
    }
  } else {
      console.log("ℹ️ Skipping Redis (local env or no URL). Using in-memory adapter.");
  }
}
setupRedisAdapter();

// Helper to sanitize chat
const sanitizeString = (str) => str ? String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

io.on('connection', (socket) => {
  
  socket.on('join-room', async ({ roomId, name, hostToken, hasCamera }) => {
    if (!roomId) return;
    roomId = String(roomId).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    const room = await Room.findOne({ roomId });
    if (!room || room.isBlacklisted) {
      socket.emit('error', { title: 'Access Denied', message: 'Room not found or has expired.' });
      return;
    }

    socket.join(roomId);
    
    const isHost = (hostToken === room.hostToken);
    if (isHost) {
      await Room.updateOne({ roomId }, { hostSocketId: socket.id });
    }

    const safeName = sanitizeString(name || "Anonymous");
    
    if (!activeRooms[roomId]) activeRooms[roomId] = { users: {} };
    activeRooms[roomId].users[socket.id] = { name: safeName, isHost, hasCamera: hasCamera !== false };
    
    // Cancel any pending blacklist timeout if someone joins
    if (blacklistTimeouts[roomId]) {
      clearTimeout(blacklistTimeouts[roomId]);
      delete blacklistTimeouts[roomId];
      console.log(`[ACTIVITY] Cancelled blacklisting for ${roomId} (User joined)`);
    }

    console.log(`[ACTIVITY] User joined: ${safeName} (Host: ${isHost}) in room ${roomId}`);
    
    socket.emit('room-joined', { users: activeRooms[roomId].users, isHost, controlsLocked: room.controlsLocked });
    socket.to(roomId).emit('user-joined', { socketId: socket.id, name: safeName, isHost, hasCamera: hasCamera !== false });
  });

  const verifyHost = async (roomId, socketId) => {
    const room = await Room.findOne({ roomId: String(roomId).toUpperCase() });
    return room && !room.isBlacklisted && room.hostSocketId === socketId;
  };

  const canControl = async (roomId, socketId) => {
    const room = await Room.findOne({ roomId: String(roomId).toUpperCase() });
    if (!room || room.isBlacklisted) return false;
    if (!room.controlsLocked) return true;
    return room.hostSocketId === socketId;
  };

  socket.on('play', async ({ roomId, time }) => {
    if (await canControl(roomId, socket.id)) socket.to(String(roomId).toUpperCase()).emit('play', time);
  });
  socket.on('pause', async ({ roomId, time }) => {
    if (await canControl(roomId, socket.id)) socket.to(String(roomId).toUpperCase()).emit('pause', time);
  });
  socket.on('seek', async ({ roomId, time }) => {
    if (await canControl(roomId, socket.id)) socket.to(String(roomId).toUpperCase()).emit('seek', time);
  });

  socket.on('toggle-controls', async ({ roomId, locked }) => {
    if (await verifyHost(roomId, socket.id)) {
      await Room.updateOne({ roomId: String(roomId).toUpperCase() }, { controlsLocked: locked });
      io.to(String(roomId).toUpperCase()).emit('controls-toggled', locked);
    }
  });

  socket.on('kick-user', async ({ roomId, targetSocketId }) => {
    if (await verifyHost(roomId, socket.id)) {
      console.log(`[ACTIVITY] Host kicked user ${targetSocketId} from ${roomId}`);
      io.to(targetSocketId).emit('error', { title: 'Terminated', message: 'You were removed by the host.' });
      io.to(String(roomId).toUpperCase()).emit('user-left', targetSocketId);
      
      if (activeRooms[roomId]?.users[targetSocketId]) {
        delete activeRooms[roomId].users[targetSocketId];
      }
      
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(String(roomId).toUpperCase());
        targetSocket.disconnect(true);
      }
    }
  });

  socket.on('send-message', ({ roomId, senderName, message }) => {
    io.to(String(roomId).toUpperCase()).emit('receive-message', {
      senderName: sanitizeString(senderName),
      message: sanitizeString(message),
      timestamp: new Date().toISOString(),
      senderId: socket.id
    });
  });

  socket.on('webrtc-offer', ({ to, offer }) => socket.to(to).emit('webrtc-offer', { from: socket.id, offer }));
  socket.on('webrtc-answer', ({ to, answer }) => socket.to(to).emit('webrtc-answer', { from: socket.id, answer }));
  socket.on('webrtc-ice-candidate', ({ to, candidate }) => socket.to(to).emit('webrtc-ice-candidate', { from: socket.id, candidate }));

  socket.on('disconnect', async () => {
    for (const roomId in activeRooms) {
      if (activeRooms[roomId].users[socket.id]) {
        const wasHost = activeRooms[roomId].users[socket.id].isHost;
        const userName = activeRooms[roomId].users[socket.id].name;
        
        delete activeRooms[roomId].users[socket.id];
        console.log(`[ACTIVITY] User left: ${userName} from room ${roomId}`);
        
        socket.to(roomId).emit('user-left', socket.id);

        const usersLeftCount = Object.keys(activeRooms[roomId].users).length;
        
        if (usersLeftCount === 0) {
          console.log(`[ACTIVITY] Room empty, scheduling blacklist for: ${roomId} in 10s`);
          
          blacklistTimeouts[roomId] = setTimeout(async () => {
            console.log(`[ACTIVITY] Executing blacklist for: ${roomId}`);
            try {
              await Room.updateOne({ roomId }, { isBlacklisted: true, hostSocketId: null });
            } catch(e) { console.error("Error blacklisting room:", e); }
            delete activeRooms[roomId];
            delete blacklistTimeouts[roomId];
          }, 10000); // 10 seconds buffer for React StrictMode / refreshes
          
        } else if (wasHost) {
          try {
            await Room.updateOne({ roomId }, { hostSocketId: null });
          } catch (e) {}
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
