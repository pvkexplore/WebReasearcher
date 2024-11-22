from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class SearchSettings(BaseModel):
    maxAttempts: int = 5
    maxResults: int = 10
    timeRange: str = "none"
    searchMode: str = "research"
    shuffleResults: bool = True
    adaptiveSearch: bool = False
    improveResults: bool = True
    allowRetry: bool = True

class ResearchRequest(BaseModel):
    query: str
    mode: Optional[str] = "research"
    settings: Optional[SearchSettings] = None

class ResearchResponse(BaseModel):
    session_id: str
    status: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class FocusArea(BaseModel):
    area: str
    priority: int
    timestamp: str

class StrategicAnalysisResponse(BaseModel):
    original_question: str
    focus_areas: List[FocusArea]
    confidence_score: float
    timestamp: str

class ResearchProgress(BaseModel):
    session_id: str
    status: str
    current_focus: Optional[Dict[str, Any]] = None
    sources_analyzed: int
    timestamp: str

class WebSocketMessage(BaseModel):
    type: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True

    @classmethod
    def create(cls, type: str, message: Optional[str] = None, data: Optional[Dict[str, Any]] = None):
        return cls(
            type=type,
            message=message,
            data=data,
            timestamp=datetime.now().isoformat()
        )

class ResearchDocument(BaseModel):
    content: str
    sources: List[str]
    timestamp: str

class AssessmentResult(BaseModel):
    assessment: str  # 'sufficient' or 'insufficient'
    reason: str

class AnalysisStatus(BaseModel):
    status: str  # 'not_analyzed', 'analyzed'
    confidence_score: float
    focus_areas_count: Optional[int] = None
    timestamp: Optional[str] = None

class ResearchStatus(BaseModel):
    status: str  # 'pending', 'starting', 'running', 'paused', 'completed', 'stopped', 'error'
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
