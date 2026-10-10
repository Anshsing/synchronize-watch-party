# Playback Synchronization

## Timeline Model
The playback state is strictly managed by the Host. When the Host plays, pauses, or seeks, a WebSocket event is emitted to the server with the current timestamp. 

## Drift Correction
When a client receives a `play` or `seek` event, it compares its local `video.currentTime` to the server's time. If the drift exceeds 1 second, it forces a hard seek to match the Host.

## Reconnection
If a user disconnects, their WebRTC peer connections are torn down. Upon reconnection, they request the current video state from the backend and automatically seek to the current timeline.
