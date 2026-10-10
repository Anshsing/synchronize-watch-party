# Load Testing

## Scenarios
1. **Signaling Server Load**: Testing the ability of Socket.io to handle 10,000 concurrent WebSocket connections.
2. **WebRTC Mesh Limits**: Benchmarking client-side CPU/Network when the room exceeds 5 participants.

## Environment
- Backend: Render / AWS EC2 (t3.micro).
- Load Tester: Artillery for WebSocket connections.

## Benchmark Results (Simulated)
- **Signaling**: Can handle ~500 rooms (2,000 sockets) per Node instance.
- **Video Serving**: Direct MP4 serving limits out at ~50 concurrent viewers before network saturation (hence the planned move to HLS/CDN).
