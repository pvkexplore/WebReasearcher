from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# Import research components
from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser

# Import routers and managers
from .models import ResearchRequest, ResearchResponse
from .strategic_router import router as strategic_router
from .research_router import router as research_router
from .websocket_manager import WebSocketManager
from .session_manager import SessionManager

# Initialize FastAPI app
app = FastAPI(title="Research API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(strategic_router)
app.include_router(research_router)

# Initialize managers
llm_wrapper = LLMWrapper()
parser = UltimateLLMResponseParser()
websocket_manager = WebSocketManager()
session_manager = SessionManager(llm_wrapper, parser, websocket_manager)

@app.post("/research/start", response_model=ResearchResponse)
async def start_research(request: ResearchRequest):
    """Start a new research session"""
    try:
        session_id = session_manager.create_session()
        return ResearchResponse(
            session_id=session_id,
            status="pending",
            message="Session created. Please establish WebSocket connection."
        )
    except Exception as e:
        print(f"Error starting research: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/research/{session_id}/begin", response_model=ResearchResponse)
async def begin_research(session_id: str, request: ResearchRequest, background_tasks: BackgroundTasks):
    """Begin research after WebSocket connection is established"""
    try:
        if not websocket_manager.is_connected(session_id):
            raise HTTPException(
                status_code=400, 
                detail="No active WebSocket connection. Please establish connection first."
            )
        
        # Initialize session with search engine
        search_engine = session_manager.initialize_session(session_id, request)
        
        # Start message processing
        background_tasks.add_task(
            websocket_manager.process_messages,
            session_id,
            session_manager.research_sessions
        )
        
        # Start research in background
        session_manager.start_research(session_id, request.query)
        
        return ResearchResponse(
            session_id=session_id,
            status="started",
            message="Research started successfully"
        )
    except Exception as e:
        print(f"Error starting research: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/research/{session_id}/stop")
async def stop_research(session_id: str):
    """Stop an ongoing research session"""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Research session not found")
        
        session_manager.stop_research(session_id)
        
        await websocket_manager.broadcast_message(session_id, {
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
    try:
        await websocket_manager.connect(websocket, session_id)
        
        # Send initial connection success message
        await websocket.send_json({
            "type": "status",
            "message": "WebSocket connection established",
            "timestamp": datetime.now().isoformat()
        })
        
        try:
            while True:
                await websocket_manager.handle_client_message(
                    websocket,
                    session_id,
                    session_manager.research_sessions
                )
        except WebSocketDisconnect:
            websocket_manager.disconnect(websocket, session_id)
            
    except Exception as e:
        print(f"WebSocket error for session {session_id}: {e}")
        websocket_manager.disconnect(websocket, session_id)

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on application shutdown"""
    session_manager.shutdown()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
