from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Dict, Optional
from datetime import datetime

from .models import ResearchProgress, ResearchRequest, ResearchResponse
from .session_manager import SessionManager
from .websocket_manager import WebSocketManager

router = APIRouter(prefix="/research-management", tags=["research-management"])

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

@router.get("/{session_id}/progress", response_model=ResearchProgress)
async def get_research_progress(
    session_id: str,
    session: Dict = Depends(get_active_session)
):
    """Get current research progress"""
    try:
        search_engine = session.get("search_engine")
        if not search_engine:
            raise HTTPException(status_code=400, detail="Search engine not initialized")

        # Get current focus area if available
        current_focus = None
        if hasattr(search_engine, "current_focus") and search_engine.current_focus:
            current_focus = {
                "area": search_engine.current_focus.area,
                "priority": search_engine.current_focus.priority
            }

        # Get number of analyzed sources
        sources_analyzed = len(search_engine.searched_urls) if hasattr(search_engine, "searched_urls") else 0

        return ResearchProgress(
            session_id=session_id,
            status=session["status"],
            current_focus=current_focus,
            sources_analyzed=sources_analyzed,
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/pause")
async def pause_research(
    session_id: str,
    managers: tuple[SessionManager, WebSocketManager] = Depends(get_managers)
):
    """Pause research for assessment"""
    try:
        session_manager, websocket_manager = managers
        session_manager.pause_session(session_id)

        await websocket_manager.broadcast_message(session_id, {
            "type": "status",
            "message": "Research paused for assessment",
            "data": {"status": "paused"}
        })

        return {"status": "paused"}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/resume")
async def resume_research(
    session_id: str,
    managers: tuple[SessionManager, WebSocketManager] = Depends(get_managers)
):
    """Resume paused research"""
    try:
        session_manager, websocket_manager = managers
        session_manager.resume_session(session_id)

        await websocket_manager.broadcast_message(session_id, {
            "type": "status",
            "message": "Research resumed",
            "data": {"status": "running"}
        })

        return {"status": "running"}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/document")
async def get_research_document(
    session_id: str,
    session: Dict = Depends(get_active_session)
):
    """Get current research document content"""
    try:
        search_engine = session.get("search_engine")
        if not search_engine:
            raise HTTPException(status_code=400, detail="Search engine not initialized")

        # Get document path from search engine
        document_path = getattr(search_engine, "document_path", None)
        if not document_path or not os.path.exists(document_path):
            return {"content": "", "sources": []}

        # Read document content
        with open(document_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Get list of analyzed sources
        sources = list(search_engine.searched_urls) if hasattr(search_engine, "searched_urls") else []

        return {
            "content": content,
            "sources": sources,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/assess")
async def assess_research_progress(
    session_id: str,
    session: Dict = Depends(get_active_session)
):
    """Assess if current research content is sufficient"""
    try:
        search_engine = session.get("search_engine")
        if not search_engine:
            raise HTTPException(status_code=400, detail="Search engine not initialized")

        # Get document content
        document_path = getattr(search_engine, "document_path", None)
        if not document_path or not os.path.exists(document_path):
            return {
                "assessment": "insufficient",
                "reason": "No research data found to assess"
            }

        with open(document_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()

        if not content:
            return {
                "assessment": "insufficient",
                "reason": "No research data was collected to assess"
            }

        # Get original query
        original_query = session.get("query", "")

        # Prepare assessment prompt
        assessment_prompt = f"""
Based on the following research content, please assess whether the original query "{original_query}" can be answered sufficiently with the collected information.

Research Content:
{content}

Instructions:
1. If the research content provides enough information to answer the original query in detail, respond with: "sufficient"
2. If not, respond with: "insufficient"
3. Provide a brief reason for your assessment.

Assessment:
"""

        # Get LLM assessment
        llm = search_engine.llm
        assessment = llm.generate(assessment_prompt, max_tokens=200)

        # Parse assessment
        is_sufficient = "sufficient" in assessment.lower()
        
        result = {
            "assessment": "sufficient" if is_sufficient else "insufficient",
            "reason": assessment.strip()
        }

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
