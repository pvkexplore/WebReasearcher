from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional
from datetime import datetime
import json
import asyncio
import queue
import traceback

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.message_queues: Dict[str, queue.Queue] = {}
        self.message_processing_tasks: Dict[str, bool] = {}

    async def connect(self, websocket: WebSocket, session_id: str) -> None:
        """Connect a new WebSocket client"""
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)
        print(f"WebSocket connected for session {session_id}")

    def disconnect(self, websocket: WebSocket, session_id: str) -> None:
        """Disconnect a WebSocket client"""
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        print(f"WebSocket disconnected for session {session_id}")

    async def broadcast_message(self, session_id: str, message: Dict) -> None:
        """Send message to all connected WebSocket clients for a session"""
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json({
                        **message,
                        "timestamp": message.get("timestamp", datetime.now().isoformat())
                    })
                    print(f"Successfully sent message to WebSocket")
                except Exception as e:
                    print(f"Error sending message: {e}")
                    traceback.print_exc()

    async def process_messages(self, session_id: str, research_sessions: Dict) -> None:
        """Process messages for a session"""
        if session_id in self.message_processing_tasks and self.message_processing_tasks[session_id]:
            print(f"Message processing task already running for session {session_id}")
            return

        print(f"Starting message processing for session {session_id}")
        if session_id not in self.message_queues:
            print(f"No message queue found for session {session_id}")
            return

        self.message_processing_tasks[session_id] = True
        message_queue = self.message_queues[session_id]

        try:
            while session_id in research_sessions and self.message_processing_tasks[session_id]:
                try:
                    try:
                        message = message_queue.get_nowait()
                        print(f"Processing message: {message.type} - {message.message[:100]}")

                        ws_message = {
                            "type": message.type,
                            "message": message.message.strip() if message.message else "",
                            "timestamp": message.timestamp or datetime.now().isoformat(),
                            "data": message.data
                        }

                        if ws_message["message"]:
                            if session_id in self.active_connections and self.active_connections[session_id]:
                                await self.broadcast_message(session_id, ws_message)
                                print(f"Broadcasted message to {len(self.active_connections[session_id])} clients")
                            else:
                                print(f"No active connections for session {session_id}, re-queueing message")
                                message_queue.put(message)
                                await asyncio.sleep(0.5)

                        message_queue.task_done()

                    except queue.Empty:
                        await asyncio.sleep(0.1)
                        continue

                except Exception as e:
                    print(f"Error processing message: {e}")
                    traceback.print_exc()
                    await asyncio.sleep(0.1)

        finally:
            print(f"Stopping message processing for session {session_id}")
            self.message_processing_tasks[session_id] = False
            if session_id not in research_sessions:
                if session_id in self.message_queues:
                    del self.message_queues[session_id]
                print(f"Cleaned up message queue for session {session_id}")

    async def handle_client_message(self, websocket: WebSocket, session_id: str, research_sessions: Dict) -> None:
        """Handle incoming messages from WebSocket client"""
        try:
            data = await websocket.receive_text()
            if not data:
                return

            try:
                message = json.loads(data)
                if message.get("type") == "status":
                    session = research_sessions.get(session_id)
                    if session:
                        await websocket.send_json({
                            "type": "status",
                            "data": {
                                "status": session["status"],
                                "query": session["query"],
                                "mode": session["mode"],
                                "settings": session.get("settings")
                            },
                            "timestamp": datetime.now().isoformat()
                        })
            except json.JSONDecodeError:
                pass

        except WebSocketDisconnect:
            print(f"WebSocket disconnected for session {session_id}")
            self.disconnect(websocket, session_id)

    def get_message_queue(self, session_id: str) -> queue.Queue:
        """Get or create message queue for session"""
        if session_id not in self.message_queues:
            self.message_queues[session_id] = queue.Queue(maxsize=1000)
        return self.message_queues[session_id]

    def is_connected(self, session_id: str) -> bool:
        """Check if session has active connections"""
        return session_id in self.active_connections and bool(self.active_connections[session_id])
