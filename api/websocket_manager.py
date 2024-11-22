from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional
from datetime import datetime
import json
import asyncio
import queue
import traceback
from .models import WebSocketMessage

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.message_queues: Dict[str, queue.Queue] = {}
        self.message_processing_tasks: Dict[str, bool] = {}
        self.connection_status: Dict[str, bool] = {}

    async def connect(self, websocket: WebSocket, session_id: str) -> None:
        """Connect a new WebSocket client with improved error handling"""
        try:
            await websocket.accept()
            
            # Initialize session structures
            if session_id not in self.active_connections:
                self.active_connections[session_id] = []
            self.active_connections[session_id].append(websocket)
            
            # Create or get message queue
            if session_id not in self.message_queues:
                self.message_queues[session_id] = queue.Queue(maxsize=1000)
            
            # Update connection status
            self.connection_status[session_id] = True
            
            print(f"WebSocket connected for session {session_id}")
            
            # Send connection confirmation
            await self.broadcast_message(session_id, {
                "type": "status",
                "message": "WebSocket connection established",
                "data": {"status": "connected"},
                "timestamp": datetime.now().isoformat()
            })
            
        except Exception as e:
            print(f"Error connecting WebSocket for session {session_id}: {e}")
            self.connection_status[session_id] = False
            raise

    def disconnect(self, websocket: WebSocket, session_id: str) -> None:
        """Disconnect a WebSocket client with cleanup"""
        try:
            # Remove from active connections
            if session_id in self.active_connections:
                if websocket in self.active_connections[session_id]:
                    self.active_connections[session_id].remove(websocket)
                
                # If no more connections for this session
                if not self.active_connections[session_id]:
                    self._cleanup_session(session_id)
            
            print(f"WebSocket disconnected for session {session_id}")
            
        except Exception as e:
            print(f"Error disconnecting WebSocket for session {session_id}: {e}")

    def _cleanup_session(self, session_id: str) -> None:
        """Clean up session resources"""
        try:
            # Clean up connection list
            if session_id in self.active_connections:
                del self.active_connections[session_id]
            
            # Clean up message queue
            if session_id in self.message_queues:
                del self.message_queues[session_id]
            
            # Stop message processing
            if session_id in self.message_processing_tasks:
                self.message_processing_tasks[session_id] = False
                del self.message_processing_tasks[session_id]
            
            # Update connection status
            self.connection_status[session_id] = False
            
            print(f"Cleaned up session resources for {session_id}")
            
        except Exception as e:
            print(f"Error cleaning up session {session_id}: {e}")

    async def broadcast_message(self, session_id: str, message: Dict) -> None:
        """Send message to all connected WebSocket clients for a session"""
        if session_id not in self.active_connections:
            return

        disconnected = []
        for connection in self.active_connections[session_id]:
            try:
                await connection.send_json({
                    **message,
                    "timestamp": message.get("timestamp", datetime.now().isoformat())
                })
            except Exception as e:
                print(f"Error sending message to WebSocket: {e}")
                disconnected.append(connection)
                continue

        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection, session_id)

    async def process_messages(self, session_id: str, research_sessions: Dict) -> None:
        """Process messages for a session with improved error handling"""
        print(f"Starting message processing for session {session_id}")
        
        if session_id not in self.message_queues:
            self.message_queues[session_id] = queue.Queue(maxsize=1000)
        
        self.message_processing_tasks[session_id] = True
        message_queue = self.message_queues[session_id]

        try:
            while (session_id in research_sessions and 
                   self.message_processing_tasks.get(session_id, False) and 
                   self.connection_status.get(session_id, False)):
                try:
                    # Try to get message with timeout
                    try:
                        message_dict = message_queue.get_nowait()
                    except queue.Empty:
                        await asyncio.sleep(0.1)
                        continue

                    # Process message
                    message = WebSocketMessage(
                        type=message_dict["type"],
                        message=message_dict.get("message", ""),
                        data=message_dict.get("data"),
                        timestamp=message_dict.get("timestamp", datetime.now().isoformat())
                    )

                    # Prepare WebSocket message
                    ws_message = {
                        "type": message.type,
                        "message": message.message.strip() if message.message else "",
                        "timestamp": message.timestamp,
                        "data": message.data
                    }

                    # Send message if it has content
                    if ws_message["message"] or ws_message["data"]:
                        if self.is_connected(session_id):
                            await self.broadcast_message(session_id, ws_message)
                        else:
                            # Re-queue message if no active connections
                            message_queue.put(message_dict)
                            await asyncio.sleep(0.5)

                    message_queue.task_done()

                except Exception as e:
                    print(f"Error processing message: {e}")
                    traceback.print_exc()
                    await asyncio.sleep(0.1)

        except Exception as e:
            print(f"Error in message processing loop: {e}")
            traceback.print_exc()
        finally:
            print(f"Stopping message processing for session {session_id}")
            self.message_processing_tasks[session_id] = False
            if session_id not in research_sessions:
                self._cleanup_session(session_id)

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
                print(f"Error decoding client message: {data}")

        except WebSocketDisconnect:
            print(f"WebSocket disconnected for session {session_id}")
            self.disconnect(websocket, session_id)
        except Exception as e:
            print(f"Error handling client message: {e}")
            traceback.print_exc()

    def get_message_queue(self, session_id: str) -> queue.Queue:
        """Get or create message queue for session"""
        if session_id not in self.message_queues:
            self.message_queues[session_id] = queue.Queue(maxsize=1000)
            print(f"Created message queue for session {session_id}")
        return self.message_queues[session_id]

    def is_connected(self, session_id: str) -> bool:
        """Check if session has active connections"""
        return (session_id in self.active_connections and 
                bool(self.active_connections[session_id]) and 
                self.connection_status.get(session_id, False))
