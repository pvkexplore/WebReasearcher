from pydantic import BaseModel
from typing import List, Dict, Optional, Union, Literal
from datetime import datetime

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

class StrategicAnalysisResponse(BaseModel):
    original_question: str
    focus_areas: List[Dict[str, Union[str, int]]]
    confidence_score: float
    timestamp: str

class ResearchProgress(BaseModel):
    session_id: str
    status: str
    current_focus: Optional[Dict[str, Union[str, int]]] = None
    sources_analyzed: int
    timestamp: str
