# Synchronize: TCP-Based WebRTC Watch Party

## Problem
Modern watch parties often suffer from playback drift, high latency, and poor media synchronization. Synchronize solves this by combining WebRTC for ultra-low latency peer-to-peer communication with a strict TCP-based (WebSockets) signaling layer for absolute playback state enforcement.

## Features
- **Spatial 3D UI**: Premium dark mode aesthetic using React Three Fiber.
- **WebRTC Comm Link**: Real-time peer-to-peer video, audio, and chat.
- **Synchronized Playback**: Host-enforced playback controls (play, pause, seek).
- **Graceful Degradation**: Join sessions without a camera.
- **Dynamic Permissions**: Host can unlock playback controls for all participants.
- **Enterprise Security**: Rate limiting, NoSQL injection prevention, and one-time ephemeral room links.
- **Action Auditing**: HTTP requests and room lifecycle events are actively logged.
- **Cloud Ready**: MongoDB persistence and Redis-ready scaling.

## Setup
1. Backend:
   ```bash
   cd backend
   npm install
   ```
   Add your `DATABASE_URL` (MongoDB Atlas) to `backend/.env`.
   Run: `node index.js`

2. Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Demo & Screenshots
*(Add screenshots of the Landing Page Data Stream and Room UI here)*
