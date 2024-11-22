from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List, Literal, Tuple
import asyncio
import json
from datetime import datetime
import sys
import os
from concurrent.futures import ThreadPoolExecutor, Future
import traceback
import queue
import threading
import time

# Import research components
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser
from Self_Improving_Search import EnhancedSelfImprovingSearch, SearchMessage, MessageHandler

# Models
class SearchSettings(BaseModel):
    maxAttempts: int = 5
    maxResults: int = 10
    timeRange: Literal['none', 'd', 'w', 'm', 'y'] = 'none'
    searchMode: Literal['research', 'search'] = 'research'

class ResearchRequest(BaseModel):
    query: str
    mode: str = "research"
    settings: Optional[SearchSettings] = None

class ResearchResponse(BaseModel):
    session_id: str
    status: str
    message: Optional[str] = None
    data: Optional[Dict] = None

# Initialize FastAPI app
app = FastAPI(title="Research API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active research sessions and connections
research_sessions: Dict[str, Dict] = {}
active_connections: Dict[str, List[WebSocket]] = {}
active_tasks: Dict[str, Future] = {}
message_processing_tasks: Dict[str, bool] = {}  # Track running message processing tasks

# Message queue for each session
message_queues: Dict[str, queue.Queue] = {}

async def broadcast_message(session_id: str, message: Dict):
    """Send message to all connected WebSocket clients for a session"""
    if session_id in active_connections:
        for connection in active_connections[session_id]:
            try:
                await connection.send_json({
                    **message,
                    "timestamp": message.get("timestamp", datetime.now().isoformat())
                })
                print(f"Successfully sent message to WebSocket")
            except Exception as e:
                print(f"Error sending message: {e}")
                traceback.print_exc()

class AsyncMessageHandler(MessageHandler):
    """Handler that forwards messages to WebSocket clients"""
    def __init__(self, session_id: str):
        self.session_id = session_id
        self._message_queue = queue.Queue(maxsize=1000)  # Use standard Queue for thread safety
        self._stop_event = threading.Event()
        self._last_message = None
        message_queues[session_id] = self._message_queue
        message_processing_tasks[session_id] = False  # Initialize task status
        print(f"Created message queue for session {session_id}")

    def handle_message(self, message: SearchMessage) -> None:
        """Queue message for sending"""
        if not self._stop_event.is_set():
            try:
                # Clean up and validate message
                if message.message:
                    message.message = message.message.strip()
                if not message.message:
                    return

                # Skip if this would be a duplicate of the last message
                if (self._last_message and 
                    message.type == self._last_message.type and 
                    message.message == self._last_message.message):
                    return

                self._last_message = message

                # Try to add to queue
                try:
                    print(f"Queueing message: {message.type} - {message.message[:100]}")
                    self._message_queue.put_nowait(message)
                except queue.Full:
                    print(f"Message queue full, dropping message: {message}")

            except Exception as e:
                print(f"Error handling message: {e}")
                traceback.print_exc()

    def stop(self):
        """Stop message processing"""
        self._stop_event.set()
        if self.session_id in message_processing_tasks:
            message_processing_tasks[self.session_id] = False

async def process_messages(session_id: str):
    """Process messages for a session"""
    if session_id in message_processing_tasks and message_processing_tasks[session_id]:
        print(f"Message processing task already running for session {session_id}")
        return

    print(f"Starting message processing for session {session_id}")
    if session_id not in message_queues:
        print(f"No message queue found for session {session_id}")
        return

    message_processing_tasks[session_id] = True
    message_queue = message_queues[session_id]
    try:
        while session_id in research_sessions and message_processing_tasks[session_id]:
            try:
                # Get message without blocking
                try:
                    message = message_queue.get_nowait()
                    print(f"Processing message: {message.type} - {message.message[:100]}")

                    # Create WebSocket message
                    ws_message = {
                        "type": message.type,
                        "message": message.message.strip() if message.message else "",
                        "timestamp": message.timestamp or datetime.now().isoformat(),
                        "data": message.data
                    }

                    # Only send non-empty messages
                    if ws_message["message"]:
                        if session_id in active_connections and active_connections[session_id]:
                            await broadcast_message(session_id, ws_message)
                            print(f"Broadcasted message to {len(active_connections[session_id])} clients")
                        else:
                            # If no active connections, put message back in queue
                            print(f"No active connections for session {session_id}, re-queueing message")
                            message_queue.put(message)
                            await asyncio.sleep(0.5)  # Wait before retrying

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
        message_processing_tasks[session_id] = False
        # Only clean up queue if session is truly done
        if session_id not in research_sessions:
            if session_id in message_queues:
                del message_queues[session_id]
            print(f"Cleaned up message queue for session {session_id}")

class AsyncSearchEngine(EnhancedSelfImprovingSearch):
    """Search engine that sends updates through WebSocket"""
    def __init__(self, llm: LLMWrapper, parser: UltimateLLMResponseParser, session_id: str, settings: Optional[SearchSettings] = None):
        self.session_id = session_id
        self.message_handler = AsyncMessageHandler(session_id)
        self._stop_event = threading.Event()
        max_attempts = settings.maxAttempts if settings else 5
        super().__init__(llm, parser, message_handler=self.message_handler, max_attempts=max_attempts)
        self.settings = settings or SearchSettings()
        self.last_query = ""
        self.last_time_range = ""

    def should_stop(self) -> bool:
        """Check if search should stop"""
        return self._stop_event.is_set()

    def stop(self):
        """Stop the search process"""
        self._stop_event.set()
        if self.message_handler:
            self.message_handler.stop()

    def send_message(self, type: str, message: str, data: Optional[Dict] = None) -> None:
        """Send message through handler"""
        if self.message_handler and not self.should_stop():
            # Clean up the message
            message = message.strip() if message else ""
            if message:  # Only send non-empty messages
                self.message_handler.handle_message(SearchMessage(
                    type=type,
                    message=message,
                    timestamp=datetime.now().isoformat(),
                    data=data
                ))

    def formulate_query(self, user_query: str, attempt: int) -> Tuple[str, str]:
        """Override to add status updates"""
        self.send_message("info", f"Formulating query (attempt {attempt + 1})...")
        try:
            query, time_range = super().formulate_query(user_query, attempt)
            self.send_message("info", f"Formulated query: {query}")
            self.send_message("info", f"Time range: {time_range}")
            return query, time_range
        except Exception as e:
            self.send_message("error", f"Error formulating query: {str(e)}")
            raise

    def perform_search(self, query: str, time_range: str) -> List[Dict]:
        """Override to add status updates"""
        self.last_query = query
        self.last_time_range = time_range
        self.send_message("info", f"Searching with query: {query}")
        try:
            results = super().perform_search(query, time_range)
            self.send_message("info", f"Found {len(results)} results")
            return results
        except Exception as e:
            self.send_message("error", f"Search error: {str(e)}")
            raise

    def select_relevant_pages(self, search_results: List[Dict], user_query: str) -> List[str]:
        """Override to add status updates"""
        self.send_message("info", "Selecting relevant pages...")
        try:
            urls = super().select_relevant_pages(search_results, user_query)
            self.send_message("info", f"Selected {len(urls)} pages")
            return urls
        except Exception as e:
            self.send_message("error", f"Error selecting pages: {str(e)}")
            raise

    def scrape_content(self, urls: List[str]) -> Dict[str, str]:
        """Override to add status updates"""
        self.send_message("info", f"Scraping {len(urls)} pages...")
        try:
            content = super().scrape_content(urls)
            self.send_message("info", f"Successfully scraped {len(content)} pages")
            return content
        except Exception as e:
            self.send_message("error", f"Error scraping content: {str(e)}")
            raise

    def evaluate_scraped_content(self, user_query: str, scraped_content: Dict[str, str]) -> Tuple[str, str]:
        """Override to add status updates"""
        self.send_message("info", "Evaluating content...")
        try:
            evaluation, decision = super().evaluate_scraped_content(user_query, scraped_content)
            self.send_message("info", f"Evaluation: {evaluation}")
            self.send_message("info", f"Decision: {decision}")
            return evaluation, decision
        except Exception as e:
            self.send_message("error", f"Error evaluating content: {str(e)}")
            raise

    def generate_final_answer(self, user_query: str, scraped_content: Dict[str, str]) -> str:
        """Override to add status updates"""
        self.send_message("info", "Generating final answer...")
        try:
            answer = super().generate_final_answer(user_query, scraped_content)
            self.send_message("result", answer)
            return answer
        except Exception as e:
            self.send_message("error", f"Error generating answer: {str(e)}")
            raise

    def synthesize_final_answer(self, user_query: str) -> str:
        """Override to add status updates"""
        self.send_message("info", "Synthesizing final answer...")
        try:
            answer = super().synthesize_final_answer(user_query)
            self.send_message("result", answer)
            return answer
        except Exception as e:
            self.send_message("error", f"Error synthesizing answer: {str(e)}")
            raise

    def search_and_improve(self, user_query: str) -> str:
        """Override to add status updates and stopping"""
        self.send_message("status", "Starting research process...")
        try:
            attempt = 0
            while attempt < self.max_attempts and not self.should_stop():
                try:
                    self.send_message("info", f"\nSearch attempt {attempt + 1}:")
                    
                    # Check for stop after each major step
                    if self.should_stop():
                        self.send_message("info", "Search stopped by user")
                        return "Search stopped by user"

                    formulated_query, time_range = self.formulate_query(user_query, attempt)
                    if self.should_stop():
                        return "Search stopped by user"

                    search_results = self.perform_search(formulated_query, time_range)
                    if self.should_stop():
                        return "Search stopped by user"

                    if not search_results:
                        self.send_message("info", "No results found, retrying...")
                        attempt += 1
                        continue

                    selected_urls = self.select_relevant_pages(search_results, user_query)
                    if self.should_stop():
                        return "Search stopped by user"

                    if not selected_urls:
                        self.send_message("info", "No relevant URLs found, retrying...")
                        attempt += 1
                        continue

                    scraped_content = self.scrape_content(selected_urls)
                    if self.should_stop():
                        return "Search stopped by user"

                    if not scraped_content:
                        self.send_message("info", "Failed to scrape content, retrying...")
                        attempt += 1
                        continue

                    evaluation, decision = self.evaluate_scraped_content(user_query, scraped_content)
                    if self.should_stop():
                        return "Search stopped by user"

                    if decision == "answer":
                        result = self.generate_final_answer(user_query, scraped_content)
                        return result
                    
                    self.send_message("info", "Need more information, refining search...")
                    attempt += 1

                except Exception as e:
                    self.send_message("error", f"Error during search: {str(e)}")
                    attempt += 1

            if self.should_stop():
                return "Search stopped by user"

            result = self.synthesize_final_answer(user_query)
            return result

        except Exception as e:
            self.send_message("error", f"Error during research: {str(e)}")
            raise
        finally:
            if self.should_stop():
                self.send_message("status", "Search stopped")
            else:
                self.send_message("status", "Search completed")

# Initialize research components
llm_wrapper = LLMWrapper()
parser = UltimateLLMResponseParser()
executor = ThreadPoolExecutor(max_workers=1)

def run_search(search_engine, query: str) -> str:
    """Run search in a separate thread"""
    try:
        return search_engine.search_and_improve(query)
    except Exception as e:
        print(f"Error in search: {e}")
        traceback.print_exc()
        raise


async def run_search_in_thread(search_engine, query: str) -> str:
    """Run search in a thread and handle async communication"""
    loop = asyncio.get_event_loop()
    try:
        # Run the CPU-intensive search in a thread pool
        result = await loop.run_in_executor(
            executor,
            search_engine.search_and_improve,
            query
        )
        return result
    except Exception as e:
        print(f"Error in search: {e}")
        traceback.print_exc()
        raise

@app.post("/research/start", response_model=ResearchResponse)
async def start_research(request: ResearchRequest, background_tasks: BackgroundTasks):
    """Start a new research session"""
    try:
        # Generate unique session ID
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        print(f"Starting new research session: {session_id}")
        
        # Return session ID to frontend so it can establish WebSocket connection
        return ResearchResponse(
            session_id=session_id,
            status="pending",
            message="Session created. Please establish WebSocket connection."
        )
        
    except Exception as e:
        print(f"Error starting research: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/research/{session_id}/begin", response_model=ResearchResponse)
async def begin_research(session_id: str, request: ResearchRequest, background_tasks: BackgroundTasks):
    """Begin research after WebSocket connection is established"""
    try:
        # Check if WebSocket connection exists
        if session_id not in active_connections or not active_connections[session_id]:
            raise HTTPException(
                status_code=400, 
                detail="No active WebSocket connection. Please establish connection first."
            )
        
        # Initialize search engine for this session
        search_engine = AsyncSearchEngine(
            llm=llm_wrapper,
            parser=parser,
            session_id=session_id,
            settings=request.settings
        )
        
        # Store session info
        research_sessions[session_id] = {
            "query": request.query,
            "mode": request.mode,
            "status": "starting",
            "search_engine": search_engine,
            "settings": request.settings
        }
        
        # Start message processing task
        if session_id not in message_processing_tasks or not message_processing_tasks[session_id]:
            background_tasks.add_task(process_messages, session_id)
            print(f"Started message processing task for session {session_id}")
        
        # Start research in background task
        future = executor.submit(run_search, search_engine, request.query)
        active_tasks[session_id] = future
        print(f"Started research task for session {session_id}")
        
        return ResearchResponse(
            session_id=session_id,
            status="started",
            message="Research started successfully"
        )
    except Exception as e:
        print(f"Error starting research: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/research/{session_id}/stop")
async def stop_research(session_id: str):
    """Stop an ongoing research session"""
    session = research_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Research session not found")
    
    try:
        # Stop the search engine
        search_engine = session["search_engine"]
        search_engine.stop()
        
        # Cancel the task if it exists
        if session_id in active_tasks:
            future = active_tasks[session_id]
            future.cancel()
            del active_tasks[session_id]
        
        session["status"] = "stopped"
        
        # Notify clients
        await broadcast_message(session_id, {
            "type": "status",
            "message": "Research stopped by user",
            "data": {"status": "stopped"}
        })
        
        return {"status": "stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, background_tasks: BackgroundTasks):
    """WebSocket endpoint for real-time updates"""
    print(f"New WebSocket connection for session {session_id}")
    try:
        await websocket.accept()
        print(f"WebSocket connection accepted for session {session_id}")
        
        # Store the connection
        if session_id not in active_connections:
            active_connections[session_id] = []
        active_connections[session_id].append(websocket)
        print(f"Added WebSocket connection to active_connections for session {session_id}")
        
        # Send initial connection success message
        await websocket.send_json({
            "type": "status",
            "message": "WebSocket connection established",
            "timestamp": datetime.now().isoformat()
        })
        
        try:
            while True:
                # Keep connection alive and handle incoming messages
                try:
                    data = await websocket.receive_text()
                    if not data:  # Connection closed
                        break
                    
                    # Handle incoming message
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
                    break
                
        except WebSocketDisconnect:
            print(f"WebSocket disconnected for session {session_id}")
        finally:
            # Clean up connection
            if session_id in active_connections:
                active_connections[session_id].remove(websocket)
                if not active_connections[session_id]:
                    del active_connections[session_id]
                print(f"Cleaned up connection for session {session_id}")
                
    except Exception as e:
        print(f"WebSocket error for session {session_id}: {e}")
        traceback.print_exc()
        if session_id in active_connections and websocket in active_connections[session_id]:
            active_connections[session_id].remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
