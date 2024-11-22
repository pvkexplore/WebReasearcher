from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import asyncio

# Import research components
from llm_wrapper import LLMWrapper
from llm_response_parser import UltimateLLMResponseParser

# Import routers and managers
from .models import ResearchRequest, ResearchResponse, ResearchStatus
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

# Initialize managers
llm_wrapper = LLMWrapper()
parser = UltimateLLMResponseParser()
websocket_manager = WebSocketManager()
session_manager = SessionManager(llm_wrapper, parser, websocket_manager)

# Mount routers with /api prefix
app.include_router(strategic_router, prefix="/api")
app.include_router(research_router, prefix="/api/research-management")

@app.post("/api/research/start", response_model=ResearchResponse)
async def start_research(request: ResearchRequest):
    """Create a new research session"""
    try:
        # Create session
        session_id = session_manager.create_session()
        
        # Initialize session with request details but don't start research yet
        session_manager.research_sessions[session_id].update({
            "query": request.query,
            "mode": request.mode,
            "settings": request.settings.dict() if request.settings else None,
            "status": "pending"
        })
        
        return ResearchResponse(
            session_id=session_id,
            status="pending",
            message="Session created. Waiting for WebSocket connection."
        )
    except Exception as e:
        print(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint with improved session handling"""
    try:
        # Get session
        session = session_manager.get_session(session_id)
        if not session:
            await websocket.close(code=4000, reason="Invalid session")
            return

        # Accept connection
        await websocket_manager.connect(websocket, session_id)
        
        # Start message processing
        message_processing_task = asyncio.create_task(
            websocket_manager.process_messages(session_id, session_manager.research_sessions)
        )

        try:
            # Send initial connection success
            await websocket.send_json({
                "type": "status",
                "message": "WebSocket connection established",
                "data": {
                    "status": session["status"],
                    "query": session["query"],
                    "mode": session["mode"]
                },
                "timestamp": datetime.now().isoformat()
            })

            # Initialize search engine if not already done
            if not session.get("search_engine"):
                search_engine = session_manager.initialize_session(
                    session_id,
                    ResearchRequest(
                        query=session["query"],
                        mode=session["mode"],
                        settings=session.get("settings")
                    )
                )

                # Start research process
                future = session_manager.start_research(session_id, session["query"])
                session["research_future"] = future

            # Handle WebSocket messages
            while True:
                try:
                    data = await websocket.receive_text()
                    await websocket_manager.handle_client_message(
                        websocket,
                        session_id,
                        session_manager.research_sessions
                    )
                except WebSocketDisconnect:
                    break

        except Exception as e:
            print(f"Error in WebSocket connection: {e}")
            session_manager.update_session_status(session_id, "error")
        finally:
            # Clean up
            websocket_manager.disconnect(websocket, session_id)
            message_processing_task.cancel()
            try:
                await message_processing_task
            except asyncio.CancelledError:
                pass

    except Exception as e:
        print(f"Error in WebSocket endpoint: {e}")
        try:
            await websocket.close(code=4000)
        except:
            pass

@app.post("/api/research/{session_id}/stop")
async def stop_research(session_id: str):
    """Stop an ongoing research session"""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Research session not found")
        
        session_manager.stop_research(session_id)
        
        return {"status": "stopped"}
    except Exception as e:
        print(f"Error stopping research: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/research/{session_id}/status", response_model=ResearchStatus)
async def get_research_status(session_id: str):
    """Get current status of research session"""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Research session not found")
        
        return ResearchStatus(
            status=session["status"],
            message=f"Research is {session['status']}",
            data={
                "mode": session.get("mode", "research"),
                "query": session.get("query", ""),
                "settings": session.get("settings", {})
            }
        )
    except Exception as e:
        print(f"Error getting status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on application shutdown"""
    active_sessions = session_manager.get_active_sessions()
    for session_id in active_sessions:
        try:
            session_manager.stop_research(session_id)
        except:
            pass
    session_manager.shutdown()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
