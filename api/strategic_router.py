from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, List
from datetime import datetime
import os

from strategic_analysis_parser import StrategicAnalysisParser
from .models import ResearchRequest, StrategicAnalysisResponse
from .session_manager import SessionManager
from .websocket_manager import WebSocketManager

router = APIRouter(prefix="/strategic", tags=["strategic"])

# Initialize parser
strategic_parser = StrategicAnalysisParser()

# Dependency to get managers
async def get_managers():
    """Get session and websocket managers from app state"""
    from .main import session_manager, websocket_manager
    return session_manager, websocket_manager

async def get_active_session(
    session_id: str,
    managers: tuple[SessionManager, WebSocketManager] = Depends(get_managers)
) -> Dict:
    """Dependency to get active session"""
    session_manager, _ = managers
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Research session not found")
    return session

@router.post("/{session_id}/analyze", response_model=StrategicAnalysisResponse)
async def analyze_research_query(
    session_id: str,
    request: ResearchRequest,
    session: Dict = Depends(get_active_session),
    managers: tuple[SessionManager, WebSocketManager] = Depends(get_managers)
):
    """Analyze research query to determine focus areas"""
    try:
        _, websocket_manager = managers
        search_engine = session.get("search_engine")
        if not search_engine:
            raise HTTPException(status_code=400, detail="Search engine not initialized")

        # Perform strategic analysis using search engine's LLM
        analysis_result = strategic_parser.parse_analysis(request.query)
        if not analysis_result:
            raise HTTPException(status_code=500, detail="Failed to analyze query")

        # Convert focus areas to dict for response
        focus_areas = [
            {
                "area": focus.area,
                "priority": focus.priority,
                "timestamp": focus.timestamp
            }
            for focus in analysis_result.focus_areas
        ]

        # Store analysis result in session
        session["analysis_result"] = analysis_result

        # Send analysis through WebSocket
        await websocket_manager.broadcast_message(session_id, {
            "type": "analysis",
            "data": {
                "focus_areas": focus_areas,
                "confidence_score": analysis_result.confidence_score
            }
        })

        return StrategicAnalysisResponse(
            original_question=analysis_result.original_question,
            focus_areas=focus_areas,
            confidence_score=analysis_result.confidence_score,
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/focus-areas")
async def get_focus_areas(
    session_id: str,
    session: Dict = Depends(get_active_session)
):
    """Get current focus areas for research session"""
    try:
        analysis_result = session.get("analysis_result")
        if not analysis_result:
            return {"focus_areas": []}

        focus_areas = [
            {
                "area": focus.area,
                "priority": focus.priority,
                "timestamp": focus.timestamp
            }
            for focus in analysis_result.focus_areas
        ]

        return {"focus_areas": focus_areas}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/focus-areas/reanalyze")
async def reanalyze_focus_areas(
    session_id: str,
    request: ResearchRequest,
    session: Dict = Depends(get_active_session),
    managers: tuple[SessionManager, WebSocketManager] = Depends(get_managers)
):
    """Reanalyze and update focus areas"""
    try:
        _, websocket_manager = managers
        search_engine = session.get("search_engine")
        if not search_engine:
            raise HTTPException(status_code=400, detail="Search engine not initialized")

        # Perform new analysis using search engine's LLM
        analysis_result = strategic_parser.parse_analysis(request.query)
        if not analysis_result:
            raise HTTPException(status_code=500, detail="Failed to analyze query")

        # Update session with new analysis
        session["analysis_result"] = analysis_result

        # Convert focus areas to dict for response
        focus_areas = [
            {
                "area": focus.area,
                "priority": focus.priority,
                "timestamp": focus.timestamp
            }
            for focus in analysis_result.focus_areas
        ]

        # Send update through WebSocket
        await websocket_manager.broadcast_message(session_id, {
            "type": "analysis_update",
            "data": {
                "focus_areas": focus_areas,
                "confidence_score": analysis_result.confidence_score
            }
        })

        return {
            "focus_areas": focus_areas,
            "confidence_score": analysis_result.confidence_score
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/analysis-status")
async def get_analysis_status(
    session_id: str,
    session: Dict = Depends(get_active_session)
):
    """Get current analysis status and confidence score"""
    try:
        analysis_result = session.get("analysis_result")
        if not analysis_result:
            return {
                "status": "not_analyzed",
                "confidence_score": 0.0
            }

        return {
            "status": "analyzed",
            "confidence_score": analysis_result.confidence_score,
            "focus_areas_count": len(analysis_result.focus_areas),
            "timestamp": analysis_result.timestamp
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
