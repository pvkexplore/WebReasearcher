export interface LLMInteraction {
  stage: string;
  prompt: string;
  response: string;
  timestamp: string;
}

export interface AnalysisStep {
  stage: string;
  description: string;
  outcome?: string;
  timestamp: string;
}

export interface SourceMetrics {
  reliability: number;
  content_length: number;
  scrape_time: string;
}

export interface ScrapedContent {
  content: string;
  timestamp: string;
}

export interface KnowledgeGraphEntity {
  name: string;
  type: string;
  description: string;
}

export interface KnowledgeGraphRelationship {
  source: string;
  target: string;
  type: string;
}

export interface KnowledgeGraph {
  entities: KnowledgeGraphEntity[];
  relationships: KnowledgeGraphRelationship[];
}

export interface ResearchDetails {
  urls_accessed: string[];
  successful_urls: string[];
  failed_urls: string[];
  content_summaries: Array<{
    url: string;
    summary: string;
  }>;
  analysis_steps?: AnalysisStep[];
  source_metrics?: { [url: string]: SourceMetrics };
  llm_interactions?: LLMInteraction[];
  scraped_content?: { [url: string]: ScrapedContent };
  knowledge_graph?: KnowledgeGraph;
}

export interface ResearchResult {
  summary: string;
  keyFindings: string[];
  sources: Array<{
    url: string;
    title: string;
    reliability: number;
    content: string;
  }>;
  analysisSteps: Array<{
    stage: string;
    description: string;
    outcome: string;
  }>;
}

export interface ResearchDashboardProps {
  // Progress Data
  currentFocus?: {
    area: string;
    priority: number;
  };
  sourcesAnalyzed: number;
  documentContent?: string;
  sources: string[];
  stage?: string;
  researchDetails?: ResearchDetails;
  // Analysis Data
  confidenceScore: number;
  focusAreas: Array<{
    area: string;
    priority: number;
  }>;
  // Status
  status: string;
  startTime?: string;
  isAssessing?: boolean;
  assessmentResult?: {
    assessment: "sufficient" | "insufficient";
    reason: string;
  };
  // Result Data
  hasResult: boolean;
  result?: ResearchResult;
}
// Settings Types
export interface SearchSettings {
  maxAttempts: number;
  maxResults: number;
  timeRange: "none" | "d" | "w" | "m" | "y";
  searchMode: "research" | "search";
  shuffleResults: boolean;
  adaptiveSearch: boolean;
  improveResults: boolean;
  allowRetry: boolean;
}

// Message Types
export interface Message {
  type: string;
  message: string;
  timestamp: string;
  data?: any;
}

// Session Types
export interface ResearchSession {
  sessionId: string;
  status: ResearchStatus;
  query: string;
  messages: Message[];
  settings: SearchSettings;
  startTime: string;
  result?: string;
  endTime?: string;
  research_details?: ResearchDetails;
}

// Add ResearchHistory component props
export interface ResearchHistoryProps {
  sessions: ResearchSession[];
  onDeleteSession: (sessionId: string) => void;
  onRestoreSession: (sessionId: string) => void;
}

// Add ConfirmDialog component props
export interface ConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

// Research Types
export type ResearchStatus =
  | "pending"
  | "starting"
  | "running"
  | "paused"
  | "completed"
  | "stopped"
  | "error";

export interface FocusArea {
  area: string;
  priority: number;
  timestamp: string;
}

export interface StrategicAnalysisResult {
  original_question: string;
  focus_areas: FocusArea[];
  confidence_score: number;
  timestamp: string;
}

export interface ResearchProgress {
  session_id: string;
  status: ResearchStatus;
  current_focus?: {
    area: string;
    priority: number;
  };
  sources_analyzed: number;
  timestamp: string;
}

export interface DocumentContent {
  content: string;
  sources: string[];
  timestamp: string;
}

export interface AssessmentResult {
  assessment: "sufficient" | "insufficient";
  reason: string;
}

// API Response Types
export interface ResearchResponse {
  session_id: string;
  status: string;
  message?: string;
  data?: any;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: string;
  message?: string;
  data?: any;
  timestamp: string;
}

// Component Props Types
export interface ResearchHeaderProps {
  status: ResearchStatus | null;
  showSettings: boolean;
  onToggleSettings: () => void;
}

export interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStop: (e: React.MouseEvent) => void;
  isStartDisabled: boolean;
  showStopButton: boolean;
}

export interface SettingsPanelProps {
  settings: SearchSettings;
  onSettingsChange: (settings: SearchSettings) => void;
  onReset: () => void;
}

export interface MessagesListProps {
  messages: Message[];
  hasResult: boolean;
  expandedMessages: boolean;
  onToggleExpand: () => void;
  isProcessing: boolean;
}

export interface StrategicAnalysisProps {
  focusAreas: FocusArea[];
  confidenceScore: number;
  onReanalyze?: () => void;
}

export interface ResearchControlsProps {
  status: ResearchStatus;
  onPause: () => void;
  onResume: () => void;
  onAssess: () => void;
  isAssessing?: boolean;
  assessmentResult?: AssessmentResult;
}

export interface ResearchProgressProps {
  currentFocus?: {
    area: string;
    priority: number;
  };
  sourcesAnalyzed: number;
  documentContent?: string;
  sources: string[];
}

export interface ErrorMessageProps {
  message: string | null;
}
