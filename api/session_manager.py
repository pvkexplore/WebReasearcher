from typing import Dict, Optional
from datetime import datetime
from concurrent.futures import Future, ThreadPoolExecutor
import traceback

from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser
from .models import ResearchRequest, SearchSettings, WebSocketMessage
from .search_engine_manager import AsyncSearchEngine
from .websocket_manager import WebSocketManager

class SessionManager:
    def __init__(self, llm: LLMWrapper, parser: UltimateLLMResponseParser, websocket_manager: WebSocketManager):
        self.llm = llm
        self.parser = parser
        self.websocket_manager = websocket_manager
        self.executor = ThreadPoolExecutor(max_workers=5)  # Increased for better concurrency
        self.research_sessions: Dict[str, Dict] = {}
        self.active_tasks: Dict[str, Future] = {}

    def create_session(self) -> str:
        """Create a new research session with improved initialization"""
        try:
            session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
            print(f"Creating new research session: {session_id}")
            
            # Initialize message queue
            message_queue = self.websocket_manager.get_message_queue(session_id)
            
            # Initialize session state
            self.research_sessions[session_id] = {
                "status": "pending",
                "created_at": datetime.now().isoformat(),
                "last_active": datetime.now().isoformat(),
                "search_engine": None,
                "settings": None,
                "query": None,
                "mode": None
            }
            
            return session_id
            
        except Exception as e:
            print(f"Error creating session: {e}")
            traceback.print_exc()
            raise

    def initialize_session(self, session_id: str, request: ResearchRequest) -> AsyncSearchEngine:
        """Initialize a research session with improved error handling"""
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
            self.research_sessions[session_id].update({
                "query": request.query,
                "mode": request.mode,
                "status": "starting",
                "search_engine": search_engine,
                "settings": settings,
                "last_active": datetime.now().isoformat()
            })

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
        """Get session information with validation"""
        session = self.research_sessions.get(session_id)
        if session:
            session["last_active"] = datetime.now().isoformat()
        return session

    def start_research(self, session_id: str, query: str) -> Future:
        """Start research process with improved error handling"""
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
        """Stop ongoing research with cleanup"""
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
        """Clean up session resources with improved error handling"""
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

                # Remove session
                del self.research_sessions[session_id]

                print(f"Cleaned up session {session_id}")
                
        except Exception as e:
            print(f"Error cleaning up session: {e}")
            traceback.print_exc()

    def update_session_status(self, session_id: str, status: str) -> None:
        """Update session status with notification"""
        try:
            if session_id in self.research_sessions:
                self.research_sessions[session_id]["status"] = status
                self.research_sessions[session_id]["last_active"] = datetime.now().isoformat()
                
                # Send status update
                message_queue = self.websocket_manager.get_message_queue(session_id)
                message_queue.put({
                    "type": "status",
                    "data": {"status": status},
                    "timestamp": datetime.now().isoformat()
                })
                
        except Exception as e:
            print(f"Error updating session status: {e}")
            traceback.print_exc()

    def get_session_status(self, session_id: str) -> Optional[str]:
        """Get current session status with validation"""
        session = self.get_session(session_id)
        return session["status"] if session else None

    def get_active_sessions(self) -> Dict[str, Dict]:
        """Get all active research sessions"""
        return {
            session_id: session
            for session_id, session in self.research_sessions.items()
            if session["status"] not in ["completed", "stopped", "error"]
        }

    def shutdown(self) -> None:
        """Shutdown session manager with improved cleanup"""
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
