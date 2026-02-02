# Mobile Integration Quick Start

## Connection Details
**Server:** `https://10.39.159.126:8000`  
**WebSocket:** `wss://10.39.159.126:8000/ws`  
**Protocol:** JSON over WebSocket

## Minimal Example (JavaScript/React Native)

```javascript
class WebRTCClient {
  constructor() {
    this.ws = null;
    this.peerConnection = null;
    this.clientId = null;
  }

  async connect() {
    // 1. Connect to signaling server
    this.ws = new WebSocket('wss://10.39.159.126:8000/ws');
    
    this.ws.onopen = () => console.log('Signaling connected');
    this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
    
    // 2. Setup WebRTC
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    this.peerConnection.ontrack = (event) => {
      // Display remote video stream
      console.log('Remote stream received');
    };
    
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({
          type: 'candidate',
          data: event.candidate
        });
      }
    };
    
    // 3. Get user media
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    
    localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, localStream);
    });
    
    return localStream;
  }

  async handleMessage(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'client_id':
        this.clientId = data;
        console.log('Client ID:', this.clientId);
        break;
        
      case 'offer':
        await this.peerConnection.setRemoteDescription(data);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.sendMessage({ type: 'answer', data: answer });
        break;
        
      case 'answer':
        await this.peerConnection.setRemoteDescription(data);
        break;
        
      case 'candidate':
        await this.peerConnection.addIceCandidate(data);
        break;
    }
  }

  async startCall() {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.sendMessage({ type: 'offer', data: offer });
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

// Usage
const client = new WebRTCClient();
client.connect().then((localStream) => {
  // Show local video
  console.log('Ready to call');
});

// To start a call
// client.startCall();
```

## React Native Dependencies

```json
{
  "dependencies": {
    "react-native-webrtc": "^118.0.0",
    "react-native-get-random-values": "^1.9.0"
  }
}
```

## iOS Swift (Basic Setup)

```swift
import WebRTC
import Starscream

class WebRTCManager {
    var webSocket: WebSocket?
    var peerConnection: RTCPeerConnection?
    var clientId: String?
    
    func connect() {
        // WebSocket connection
        let request = URLRequest(url: URL(string: "wss://10.39.159.126:8000/ws")!)
        webSocket = WebSocket(request: request)
        webSocket?.onEvent = { event in
            switch event {
            case .text(let string):
                self.handleMessage(string)
            default:
                break
            }
        }
        webSocket?.connect()
        
        // WebRTC setup
        let config = RTCConfiguration()
        config.iceServers = [RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"])]
        
        peerConnection = RTCPeerConnectionFactory().peerConnection(
            with: config,
            constraints: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil),
            delegate: self
        )
    }
    
    func handleMessage(_ message: String) {
        // Parse JSON and handle signaling messages
    }
    
    func startCall() {
        peerConnection?.offer(for: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)) { sdp, error in
            // Handle offer creation
        }
    }
}
```

## Android Kotlin (Basic Setup)

```kotlin
import org.webrtc.*
import org.java_websocket.client.WebSocketClient
import org.json.JSONObject

class WebRTCManager {
    private var webSocket: WebSocketClient? = null
    private var peerConnection: PeerConnection? = null
    private var clientId: String? = null
    
    fun connect() {
        // WebSocket connection
        webSocket = object : WebSocketClient(URI("wss://10.39.159.126:8000/ws")) {
            override fun onMessage(message: String) {
                handleMessage(JSONObject(message))
            }
            // ... other overrides
        }
        webSocket?.connect()
        
        // WebRTC setup
        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        )
        
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers)
        peerConnection = peerConnectionFactory.createPeerConnection(rtcConfig, observer)
    }
    
    fun handleMessage(message: JSONObject) {
        when (message.getString("type")) {
            "client_id" -> clientId = message.getString("data")
            "offer" -> handleOffer(message.getJSONObject("data"))
            "answer" -> handleAnswer(message.getJSONObject("data"))
            "candidate" -> handleCandidate(message.getJSONObject("data"))
        }
    }
    
    fun startCall() {
        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                // Send offer via WebSocket
            }
            // ... other overrides
        }, MediaConstraints())
    }
}
```

## Testing Your Integration

1. **Test WebSocket:** Connect and check for `client_id` message
2. **Test Media:** Ensure camera/microphone permissions work
3. **Test Signaling:** Send offer, receive answer
4. **Test Video:** Verify remote stream displays

## Common Issues

- **HTTPS Certificate:** Add certificate exception for development
- **Permissions:** Request camera/microphone permissions first
- **Network:** Handle WebSocket reconnection
- **Threading:** Handle WebRTC callbacks on main thread

Give this documentation to your mobile developers - they can use it to connect their apps to your video call server!