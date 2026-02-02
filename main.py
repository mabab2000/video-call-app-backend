import uuid
from typing import Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store clients with unique IDs
clients: Dict[str, WebSocket] = {}


@app.get("/")
async def index():
    return HTMLResponse(open("index.html", "r", encoding="utf-8").read())


@app.get("/script.js")
async def script():
    return FileResponse("script.js", media_type="application/javascript")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = str(uuid.uuid4())
    clients[client_id] = websocket
    
    print(f"Client {client_id} connected. Total clients: {len(clients)}")
    
    # Notify client of their ID
    await websocket.send_text(f'{{"type": "client_id", "data": "{client_id}"}}')
    
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received from {client_id}: {data}")
            
            # Broadcast to all other clients
            disconnected_clients = []
            for other_id, other_client in clients.items():
                if other_id != client_id:
                    try:
                        await other_client.send_text(data)
                        print(f"Forwarded to {other_id}")
                    except:
                        disconnected_clients.append(other_id)
            
            # Clean up disconnected clients
            for dc_id in disconnected_clients:
                del clients[dc_id]
                
    except WebSocketDisconnect:
        if client_id in clients:
            del clients[client_id]
        print(f"Client {client_id} disconnected. Total clients: {len(clients)}")
