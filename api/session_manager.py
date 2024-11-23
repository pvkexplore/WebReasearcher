from typing import Dict, Optional, List
from datetime import datetime
from concurrent.futures import Future, ThreadPoolExecutor
import traceback

from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser
from .models import ResearchRequest, SearchSettings, WebSocketMessage
from .search_engine_manager import AsyncSearchEngine
from .websocket_manager import WebSocketManager
from .database import DatabaseManager

class SessionManager:
    def __init__(self, llm: LLMWrapper, parser: UltimateLLMResponseParser, websocket_manager: WebSocketManager):
        self.llm = llm
        self.parser = parser
        self.websocket_manager = websocket_manager
        self.executor = ThreadPoolExecutor(max_workers=5)
        self.research_sessions: Dict[str, Dict] = {}
        self.active_tasks: Dict[str, Future] = {}
        self.db = DatabaseManager()

    def create_session(self, query: str = "", mode: str = "research") -> str:
        """Create a new research session with improved initialization"""
        try:
            session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
            print(f"Creating new research session: {session_id}")
            
            # Initialize message queue
            message_queue = self.websocket_manager.get_message_queue(session_id)
            
            # Initialize session state with required fields
            session_data = {
                "status": "pending",
                "created_at": datetime.now().isoformat(),
                "last_active": datetime.now().isoformat(),
                "search_engine": None,
                "settings": None,
                "query": query,  # Ensure query is set
                "mode": mode    # Ensure mode is set
            }
            
            self.research_sessions[session_id] = session_data
            
            # Save to database with required fields
            self.db.save_session(session_id, session_data)
            
            return session_id
            
        except Exception as e:
            print(f"Error creating session: {e}")
            traceback.print_exc()
            raise

    def initialize_session(self, session_id: str, request: ResearchRequest) -> AsyncSearchEngine:
        """Initialize a research session with database updates"""
        try:
            # Validate session exists
            if session_id not in self.research_sessions:
                raise ValueError(f"Session {session_id} not found")
            
            # Create settings dictionary
            settings = {}
            if request.settings:
                settings.update(request.settings.dict())
            
            settings.update({
                "searchMode": request.mode,
                "improveResults": request.mode == "research",
                "adaptiveSearch": request.mode == "research"
            })

            # Create search engine
            search_engine = AsyncSearchEngine(
                llm=self.llm,
                parser=self.parser,
                session_id=session_id,
                message_queues=self.websocket_manager.message_queues,
                message_processing_tasks=self.websocket_manager.message_processing_tasks,
                settings=settings
            )

            # Update session info
            session_data = {
                "query": request.query,
                "mode": request.mode,
                "status": "starting",
                "search_engine": search_engine,
                "settings": settings,
                "last_active": datetime.now().isoformat()
            }
            
            self.research_sessions[session_id].update(session_data)
            
            # Update database
            self.db.save_session(session_id, session_data)

            # Send initial status
            message_queue = self.websocket_manager.get_message_queue(session_id)
            message_queue.put({
                "type": "status",
                "data": {
                    "status": "starting",
                    "mode": request.mode
                },
                "timestamp": datetime.now().isoformat()
            })

            return search_engine
            
        except Exception as e:
            print(f"Error initializing session: {e}")
            traceback.print_exc()
            self.cleanup_session(session_id)
            raise

    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session information from memory or database"""
        # First try memory
        session = self.research_sessions.get(session_id)
        if session:
            session["last_active"] = datetime.now().isoformat()
            return session
            
        # If not in memory, try database
        return self.db.get_session(session_id)

    def get_all_sessions(self) -> List[Dict]:
        """Get all research sessions from database"""
        return self.db.get_all_sessions()

    def start_research(self, session_id: str, query: str) -> Future:
        """Start research process with database updates"""
        try:
            session = self.get_session(session_id)
            if not session:
                raise ValueError("Session not found")

            search_engine = session["search_engine"]
            if not search_engine:
                raise ValueError("Search engine not initialized")

            # Update session status
            session["status"] = "running"
            session["last_active"] = datetime.now().isoformat()
            
            # Update database
            self.db.update_session_status(session_id, "running")

            # Start research in background
            future = self.executor.submit(search_engine.search_and_improve, query)
            self.active_tasks[session_id] = future
            
            # Send status update
            message_queue = self.websocket_manager.get_message_queue(session_id)
            message_queue.put({
                "type": "status",
                "data": {"status": "running"},
                "timestamp": datetime.now().isoformat()
            })

            return future
            
        except Exception as e:
            print(f"Error starting research: {e}")
            traceback.print_exc()
            self.update_session_status(session_id, "error")
            raise

    def stop_research(self, session_id: str) -> None:
        """Stop ongoing research with database updates"""
        try:
            session = self.get_session(session_id)
            if not session:
                raise ValueError("Session not found")

            # Stop search engine
            search_engine = session.get("search_engine")
            if search_engine:
                search_engine.stop()

            # Cancel task
            if session_id in self.active_tasks:
                future = self.active_tasks[session_id]
                future.cancel()
                del self.active_tasks[session_id]

            # Update session status
            session["status"] = "stopped"
            session["last_active"] = datetime.now().isoformat()
            
            # Update database
            self.db.update_session_status(session_id, "stopped")

            # Send status update
            message_queue = self.websocket_manager.get_message_queue(session_id)
            message_queue.put({
                "type": "status",
                "data": {"status": "stopped"},
                "timestamp": datetime.now().isoformat()
            })
            
        except Exception as e:
            print(f"Error stopping research: {e}")
            traceback.print_exc()

    def cleanup_session(self, session_id: str) -> None:
        """Clean up session resources with database update"""
        try:
            if session_id in self.research_sessions:
                session = self.research_sessions[session_id]
                
                # Stop search engine
                if "search_engine" in session:
                    search_engine = session["search_engine"]
                    search_engine.stop()

                # Cancel task
                if session_id in self.active_tasks:
                    future = self.active_tasks[session_id]
                    future.cancel()
                    del self.active_tasks[session_id]

                # Update database before removing from memory
                self.db.update_session_status(session_id, "completed")

                # Remove from memory
                del self.research_sessions[session_id]

                print(f"Cleaned up session {session_id}")
                
        except Exception as e:
            print(f"Error cleaning up session: {e}")
            traceback.print_exc()

    def delete_session(self, session_id: str) -> bool:
        """Delete a session from both memory and database"""
        try:
            # Remove from memory if present
            if session_id in self.research_sessions:
                self.cleanup_session(session_id)
            
            # Remove from database
            return self.db.delete_session(session_id)
        except Exception as e:
            print(f"Error deleting session: {e}")
            return False

    def update_session_status(self, session_id: str, status: str, result: Optional[str] = None) -> None:
        """Update session status with database persistence"""
        try:
            if session_id in self.research_sessions:
                self.research_sessions[session_id]["status"] = status
                self.research_sessions[session_id]["last_active"] = datetime.now().isoformat()
                if result:
                    self.research_sessions[session_id]["result"] = result
                
                # Update database
                self.db.update_session_status(session_id, status, result)
                
                # Send status update
                message_queue = self.websocket_manager.get_message_queue(session_id)
                message_queue.put({
                    "type": "status",
                    "data": {"status": status, "result": result} if result else {"status": status},
                    "timestamp": datetime.now().isoformat()
                })
                
        except Exception as e:
            print(f"Error updating session status: {e}")
            traceback.print_exc()

    def get_session_status(self, session_id: str) -> Optional[str]:
        """Get current session status from memory or database"""
        session = self.get_session(session_id)
        return session["status"] if session else None

    def get_active_sessions(self) -> Dict[str, Dict]:
        """Get all active research sessions from memory"""
        return {
            session_id: session
            for session_id, session in self.research_sessions.items()
            if session["status"] not in ["completed", "stopped", "error"]
        }

    def shutdown(self) -> None:
        """Shutdown session manager with database cleanup"""
        try:
            # Stop all active sessions
            for session_id in list(self.research_sessions.keys()):
                try:
                    self.stop_research(session_id)
                    self.cleanup_session(session_id)
                except Exception as e:
                    print(f"Error cleaning up session {session_id}: {e}")

            # Shutdown executor
            self.executor.shutdown(wait=False)
            
        except Exception as e:
            print(f"Error during shutdown: {e}")
            traceback.print_exc()
