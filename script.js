// Redirect to HTTPS if on HTTP (except localhost)
if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  log('Redirecting to HTTPS for WebRTC support...');
  location.replace('https:' + location.href.substring(location.protocol.length));
}

const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:8000/ws`;
const ws = new WebSocket(wsUrl);

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

let sendQueue = [];
function safeSend(obj) {
  const str = JSON.stringify(obj);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(str);
  } else {
    sendQueue.push(str);
  }
}

ws.onopen = () => {
  log('Signaling connected');
  wsConnected = true;
  setStatus('Ready to call');
  // flush queue
  while (sendQueue.length) ws.send(sendQueue.shift());
};

ws.onclose = () => {
  log('Signaling disconnected');
  wsConnected = false;
  setStatus('Disconnected');
};

ws.onerror = (err) => {
  log('Websocket error: ' + err);
  wsConnected = false;
  setStatus('Connection error');
};

let localStream = null;

async function setupUserMedia() {
  try {
    if (localStream) return localStream;
    
    // Check if WebRTC APIs are available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access requires HTTPS. Please use https://' + location.host);
    }
    
    // Additional check for secure context
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      throw new Error('WebRTC requires HTTPS. Please use https://' + location.host);
    }
    
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    log('Camera and microphone access granted');
    return localStream;
  } catch (err) {
    log('getUserMedia error: ' + err.message);
    setStatus('Media access failed: ' + err.message);
    throw err;
  }
}

let clientId = null;
let remoteClientConnected = false;

pc.ontrack = event => {
  log('Received remote track from peer');
  const stream = event.streams[0];
  if (stream) {
    remoteVideo.srcObject = stream;
    setStatus('Connected - showing remote video');
    remoteClientConnected = true;
  } else {
    log('Warning: No stream in track event');
  }
};

pc.oniceconnectionstatechange = () => {
  log('ICE connection state: ' + pc.iceConnectionState);
  if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
    setStatus('Video call connected!');
  } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
    setStatus('Connection lost');
    remoteClientConnected = false;
  }
};

pc.onicecandidate = event => {
  if (event.candidate) {
    safeSend({ type: "candidate", data: event.candidate });
  }
};

async function startCall() {
  try {
    log('Starting call...');
    setStatus('Setting up media...');
    
    // Ensure we have media access first
    await setupUserMedia();
    
    setStatus('Creating offer...');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    safeSend({ type: "offer", data: offer });
    log('Offer sent');
    setStatus('Call started - waiting for peer');
  } catch (err) {
    log('startCall error: ' + err.message);
    setStatus('Call failed: ' + err.message);
  }
}

// attach start button safely when DOM is ready
function onDomReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
  else fn();
}

function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

function log(...args) {
  console.log(...args);
  const el = document.getElementById('log');
  if (!el) return;
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  el.textContent += msg + '\n';
  el.scrollTop = el.scrollHeight;
}

let wsConnected = false;

onDomReady(() => {
  log('DOM ready, setting up UI...');
  log('Current URL: ' + location.href);
  log('Protocol: ' + location.protocol + ', Secure Context: ' + window.isSecureContext);
  
  // Check WebRTC support
  if (!window.RTCPeerConnection) {
    log('ERROR: WebRTC not supported in this browser');
    setStatus('WebRTC not supported');
    return;
  }
  
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const httpsUrl = 'https://' + location.host + location.pathname;
    log('ERROR: Camera access requires HTTPS. Use: ' + httpsUrl);
    setStatus('Camera access requires HTTPS');
    
    // Show redirect button for convenience
    const btn = document.getElementById('startBtn');
    if (btn) {
      btn.textContent = 'Switch to HTTPS';
      btn.addEventListener('click', () => {
        location.href = httpsUrl;
      });
    }
    return;
  }
  
  const btn = document.getElementById('startBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      log('Start button clicked');
      if (!wsConnected) {
        setStatus('Websocket not connected');
        log('Cannot start call - websocket not connected');
        return;
      }
      setStatus('Calling...');
      startCall();
    });
    log('Start button event listener attached');
  } else {
    log('ERROR: Start button not found!');
  }
  
  // Try to set up media early only if API is available
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    setupUserMedia().catch(err => {
      log('Early media setup failed: ' + err.message);
    });
  }
});

ws.onmessage = async message => {
  const msg = JSON.parse(message.data);
  log('Received: ' + msg.type);

  try {
    if (msg.type === "client_id") {
      clientId = msg.data;
      log('Assigned client ID: ' + clientId);
      return;
    }
    
    if (msg.type === "offer") {
      log('Processing offer from remote peer');
      await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      safeSend({ type: "answer", data: answer });
      log('Sent answer back to peer');
      setStatus('Answering call...');
    }

    if (msg.type === "answer") {
      log('Processing answer from remote peer');
      await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
      log('Call established!');
    }

    if (msg.type === "candidate") {
      if (msg.data && msg.data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(msg.data));
        log('Added ICE candidate');
      }
    }
  } catch (err) {
    log('Error handling message: ' + err.message);
  }
};
