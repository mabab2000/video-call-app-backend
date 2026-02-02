# WebRTC Video Call API Documentation

## Server Connection

**WebSocket Endpoint:** `wss://10.39.159.126:8000/ws`  
**Protocol:** WebSocket over HTTPS (required for camera access)  
**Content-Type:** JSON

## Connection Flow

### 1. Connect to WebSocket
```
WebSocket URL: wss://10.39.159.126:8000/ws
```

### 2. Receive Client ID
After connection, server sends your unique client ID:
```json
{
  "type": "client_id",
  "data": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Signaling Protocol

### WebRTC Offer (Caller → Server → Receiver)
```json
{
  "type": "offer",
  "data": {
    "type": "offer",
    "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

### WebRTC Answer (Receiver → Server → Caller)  
```json
{
  "type": "answer",
  "data": {
    "type": "answer", 
    "sdp": "v=0\r\no=- 987654321 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

### ICE Candidates (Both directions)
```json
{
  "type": "candidate",
  "data": {
    "candidate": "candidate:1 1 UDP 2013266431 192.168.1.100 54400 typ host",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
  }
}
```

## WebRTC Configuration

### ICE Servers
```json
{
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" }
  ]
}
```

### Media Constraints
```json
{
  "video": true,
  "audio": true
}
```

## Mobile Implementation Steps

### 1. WebSocket Connection
```javascript
// React Native / JavaScript
const ws = new WebSocket('wss://10.39.159.126:8000/ws');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => handleSignalingMessage(JSON.parse(event.data));
```

```swift
// iOS Swift
import Starscream
let socket = WebSocket(request: URLRequest(url: URL(string: "wss://10.39.159.126:8000/ws")!))
socket.connect()
```

```kotlin
// Android Kotlin  
import org.java_websocket.client.WebSocketClient
val client = object : WebSocketClient(URI("wss://10.39.159.126:8000/ws")) {
    override fun onMessage(message: String) {
        handleSignalingMessage(JSONObject(message))
    }
}
```

### 2. WebRTC Setup
```javascript
// Create peer connection
const peerConnection = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Add local stream
const localStream = await navigator.mediaDevices.getUserMedia({ 
  video: true, 
  audio: true 
});
localStream.getTracks().forEach(track => {
  peerConnection.addTrack(track, localStream);
});

// Handle remote stream
peerConnection.ontrack = (event) => {
  const remoteStream = event.streams[0];
  // Display remote video
};

// Handle ICE candidates
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    ws.send(JSON.stringify({
      type: 'candidate',
      data: event.candidate
    }));
  }
};
```

### 3. Initiating a Call
```javascript
async function startCall() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  ws.send(JSON.stringify({
    type: 'offer',
    data: offer
  }));
}
```

### 4. Answering a Call
```javascript
async function handleOffer(offer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  
  ws.send(JSON.stringify({
    type: 'answer',
    data: answer
  }));
}
```

## Platform-Specific Libraries

### React Native
- **WebRTC:** `react-native-webrtc`
- **WebSocket:** Built-in `WebSocket` or `@react-native-community/netinfo`

### iOS (Swift)
- **WebRTC:** `GoogleWebRTC` pod
- **WebSocket:** `Starscream` library

### Android (Kotlin)
- **WebRTC:** `org.webrtc:google-webrtc`
- **WebSocket:** `Java-WebSocket` or `OkHttp WebSocket`

### Flutter
- **WebRTC:** `flutter_webrtc` package
- **WebSocket:** `web_socket_channel` package

## Testing

### Test Connection
```bash
# Test WebSocket connection
wscat -c wss://10.39.159.126:8000/ws
```

### Expected Flow
1. Connect → Receive client_id
2. Start call → Send offer → Receive answer
3. Exchange ICE candidates
4. Video streams established

## Error Handling

### Common Issues
- **Certificate errors:** Use development certificates or implement certificate pinning
- **HTTPS required:** WebRTC requires secure contexts on mobile
- **Network connectivity:** Handle WebSocket reconnection
- **Permissions:** Camera/microphone permissions required

### Status Codes
- WebSocket connects successfully
- No HTTP status codes (pure WebSocket communication)
- Connection drops trigger reconnection logic

## Server Logs
Server will show:
```
Client abc123 connected. Total clients: 1
Received from abc123: {"type":"offer",...}
Forwarded to def456
Client abc123 disconnected. Total clients: 0
```