from typing import Dict, Optional
from datetime import datetime
from concurrent.futures import Future, ThreadPoolExecutor

from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser
from .models import ResearchRequest, SearchSettings
from .search_engine_manager import AsyncSearchEngine
from .websocket_manager import WebSocketManager

class SessionManager:
    def __init__(self, llm: LLMWrapper, parser: UltimateLLMResponseParser, websocket_manager: WebSocketManager):
        self.llm = llm
        self.parser = parser
        self.websocket_manager = websocket_manager
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.research_sessions: Dict[str, Dict] = {}
        self.active_tasks: Dict[str, Future] = {}

    def create_session(self) -> str:
        """Create a new research session"""
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        print(f"Creating new research session: {session_id}")
        return session_id

    def initialize_session(self, session_id: str, request: ResearchRequest) -> AsyncSearchEngine:
        """Initialize a research session with search engine"""
        # Create search engine
        search_engine = AsyncSearchEngine(
            llm=self.llm,
            parser=self.parser,
            session_id=session_id,
            message_queues=self.websocket_manager.message_queues,
            message_processing_tasks=self.websocket_manager.message_processing_tasks,
            settings=request.settings
        )

        # Store session info
        self.research_sessions[session_id] = {
            "query": request.query,
            "mode": request.mode,
            "status": "starting",
            "search_engine": search_engine,
            "settings": request.settings
        }

        return search_engine

    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session information"""
        return self.research_sessions.get(session_id)

    def start_research(self, session_id: str, query: str) -> Future:
        """Start research process in background"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        search_engine = session["search_engine"]
        future = self.executor.submit(search_engine.search_and_improve, query)
        self.active_tasks[session_id] = future
        return future

    def stop_research(self, session_id: str) -> None:
        """Stop ongoing research"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        # Stop the search engine
        search_engine = session["search_engine"]
        search_engine.stop()

        # Cancel the task if it exists
        if session_id in self.active_tasks:
            future = self.active_tasks[session_id]
            future.cancel()
            del self.active_tasks[session_id]

        session["status"] = "stopped"

    def cleanup_session(self, session_id: str) -> None:
        """Clean up session resources"""
        if session_id in self.research_sessions:
            session = self.research_sessions[session_id]
            if "search_engine" in session:
                search_engine = session["search_engine"]
                search_engine.stop()

            if session_id in self.active_tasks:
                future = self.active_tasks[session_id]
                future.cancel()
                del self.active_tasks[session_id]

            del self.research_sessions[session_id]

    def update_session_status(self, session_id: str, status: str) -> None:
        """Update session status"""
        if session_id in self.research_sessions:
            self.research_sessions[session_id]["status"] = status

    def get_session_status(self, session_id: str) -> Optional[str]:
        """Get current session status"""
        session = self.get_session(session_id)
        return session["status"] if session else None

    def get_active_sessions(self) -> Dict[str, Dict]:
        """Get all active research sessions"""
        return {
            session_id: session
            for session_id, session in self.research_sessions.items()
            if session["status"] not in ["completed", "stopped", "error"]
        }

    def pause_session(self, session_id: str) -> None:
        """Pause research session"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        search_engine = session["search_engine"]
        if hasattr(search_engine, "research_paused"):
            search_engine.research_paused = True
        session["status"] = "paused"

    def resume_session(self, session_id: str) -> None:
        """Resume paused research session"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")

        search_engine = session["search_engine"]
        if hasattr(search_engine, "research_paused"):
            search_engine.research_paused = False
        session["status"] = "running"

    def shutdown(self) -> None:
        """Shutdown session manager and cleanup all sessions"""
        for session_id in list(self.research_sessions.keys()):
            self.cleanup_session(session_id)
        self.executor.shutdown(wait=False)
