---
name: websocket-realtime
description: WebSockets, Socket.io, real-time messaging, reconnection logic, and event broadcasting.
---

# WebSocket Realtime Skill

## Guidelines
1. **Connection Auth**: Authenticate socket connections using tokens on initial handshake.
2. **Auto Reconnection**: Implement exponential backoff reconnection logic on client disconnects.
3. **Heartbeat Pings**: Send ping/pong frames to detect broken sockets promptly.
4. **Room Namespacing**: Organize subscribers into rooms/channels for targeted message broadcasting.
5. **Scaling**: Use Redis Adapter for multi-instance socket broadcasting.
