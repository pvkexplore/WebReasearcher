import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { ResearchHeader } from "./components/ResearchHeader";
import { SearchBar } from "./components/SearchBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { MessagesList } from "./components/MessagesList";
import { ErrorMessage } from "./components/ErrorMessage";
import { StrategicAnalysis } from "./components/StrategicAnalysis";
import { ResearchControls } from "./components/ResearchControls";
import { ResearchProgress } from "./components/ResearchProgress";
import {
  SearchSettings,
  Message,
  ResearchSession,
  FocusArea,
  AssessmentResult,
} from "./types";

const defaultSettings: SearchSettings = {
  maxAttempts: 5,
  maxResults: 10,
  timeRange: "none",
  searchMode: "research",
  shuffleResults: true,
  adaptiveSearch: false,
  improveResults: true,
  allowRetry: true,
};

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000;

function App() {
  // State
  const [expandedMessages, setExpandedMessages] = useState(true);
  const [hasResult, setHasResult] = useState(false);
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SearchSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [currentFocus, setCurrentFocus] = useState<
    { area: string; priority: number } | undefined
  >();
  const [sourcesAnalyzed, setSourcesAnalyzed] = useState(0);
  const [documentContent, setDocumentContent] = useState<string | undefined>();
  const [sources, setSources] = useState<string[]>([]);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<
    AssessmentResult | undefined
  >();

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const isProcessing = Boolean(
    session &&
      !hasResult &&
      (session.status === "starting" || session.status === "running")
  );
  const [currentStage, setCurrentStage] = useState<string>("initializing");

  const [researchDetails, setResearchDetails] = useState<{
    urls_accessed: string[];
    successful_urls: string[];
    failed_urls: string[];
    content_summaries: Array<{
      url: string;
      summary: string;
    }>;
  }>({
    urls_accessed: [],
    successful_urls: [],
    failed_urls: [],
    content_summaries: [],
  });

  // WebSocket setup
  const setupWebSocket = (sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);
    wsRef.current = ws;
    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event);
      setIsConnected(false);
      wsRef.current = null;

      // Attempt reconnection if session is active
      if (session?.status === "running" || session?.status === "starting") {
        handleReconnect(sessionId);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket connection error");
    };

    ws.onmessage = handleWebSocketMessage;
  };

  const handleReconnect = (sessionId: string) => {
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      setError("Failed to reconnect to server");
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttempts.current++;
      console.log(
        `Attempting to reconnect (${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`
      );
      setupWebSocket(sessionId);
    }, RECONNECT_DELAY);
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received WebSocket message:", data);

      switch (data.type) {
        case "status":
          handleStatusUpdate(data);
          break;
        case "analysis":
          handleAnalysisUpdate(data);
          break;
        case "progress":
          handleProgressUpdate(data);
          break;
        case "result":
          handleResultUpdate(data);
          break;
        case "message":
          handleMessageUpdate(data);
          break;
        case "error":
          handleErrorUpdate(data);
          break;
      }
    } catch (err) {
      console.error("Error processing WebSocket message:", err);
    }
  };

  const handleStatusUpdate = (data: any) => {
    if (data.data?.status) {
      setSession((prev) =>
        prev ? { ...prev, status: data.data.status } : null
      );

      if (data.data.status === "completed" || data.data.status === "stopped") {
        cleanupWebSocket();
      }
    }
  };

  const handleAnalysisUpdate = (data: any) => {
    if (data.data) {
      setFocusAreas(data.data.focus_areas || []);
      setConfidenceScore(data.data.confidence_score || 0);
    }
  };
  const handleProgressUpdate = (data: any) => {
    if (data.data) {
      setCurrentFocus(data.data.current_focus);
      setSourcesAnalyzed(data.data.sources_analyzed);
      setDocumentContent(data.data.document_content);
      setSources(data.data.sources || []);
      // Update current stage
      if (data.data.stage) {
        setCurrentStage(data.data.stage);
      }
      // Update research details
      if (data.data.research_details) {
        setResearchDetails(data.data.research_details);
      }
    }
  };

  const handleResultUpdate = (data: any) => {
    setExpandedMessages(false);
    setHasResult(true);
    setSession((prev) => (prev ? { ...prev, status: "completed" } : null));

    // Add the result message to messages list
    if (data.message || data.data) {
      setMessages((prev) => {
        const resultMessage = {
          type: "result",
          message: data.message || data.data?.result || "No result content",
          timestamp: data.timestamp || new Date().toISOString(),
          data: data.data,
        };

        // Check for duplicates
        const isDuplicate = prev.some(
          (msg) =>
            msg.type === resultMessage.type &&
            msg.message === resultMessage.message &&
            msg.timestamp === resultMessage.timestamp
        );

        return isDuplicate ? prev : [...prev, resultMessage];
      });
    }

    cleanupWebSocket();
  };

  const handleMessageUpdate = (data: any) => {
    if (data.message || data.data) {
      setMessages((prev) => {
        const newMessage = {
          type: data.type || "message",
          message: data.message || "",
          timestamp: data.timestamp || new Date().toISOString(),
          data: data.data,
        };

        // Check for duplicates
        const isDuplicate = prev.some(
          (msg) =>
            msg.type === newMessage.type &&
            msg.message === newMessage.message &&
            msg.timestamp === newMessage.timestamp
        );

        return isDuplicate ? prev : [...prev, newMessage];
      });
    }
  };

  const handleErrorUpdate = (data: any) => {
    setError(data.message);
    setSession((prev) => (prev ? { ...prev, status: "error" } : null));
  };

  const cleanupWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  // Research control functions
  const handlePause = async () => {
    if (!session?.sessionId) return;

    try {
      const response = await fetch(`/api/research/${session.sessionId}/pause`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to pause research");
      }

      setSession((prev) => (prev ? { ...prev, status: "paused" } : null));
    } catch (err) {
      console.error("Error pausing research:", err);
      setError("Failed to pause research");
    }
  };

  const handleResume = async () => {
    if (!session?.sessionId) return;

    try {
      const response = await fetch(
        `/api/research/${session.sessionId}/resume`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to resume research");
      }

      setSession((prev) => (prev ? { ...prev, status: "running" } : null));
    } catch (err) {
      console.error("Error resuming research:", err);
      setError("Failed to resume research");
    }
  };

  const handleAssess = async () => {
    if (!session?.sessionId) return;

    setIsAssessing(true);
    try {
      const response = await fetch(
        `/api/research/${session.sessionId}/assess`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to assess research");
      }

      const result = await response.json();
      setAssessmentResult(result);
    } catch (err) {
      console.error("Error assessing research:", err);
      setError("Failed to assess research");
    } finally {
      setIsAssessing(false);
    }
  };

  const startResearch = async () => {
    if (!query.trim()) {
      setError("Please enter a query");
      return;
    }

    try {
      // Reset state
      setSession(null);
      setIsConnected(false);
      setError(null);
      setMessages([]);
      setHasResult(false);
      setExpandedMessages(true);
      setFocusAreas([]);
      setConfidenceScore(0);
      setCurrentFocus(undefined);
      setSourcesAnalyzed(0);
      setDocumentContent(undefined);
      setSources([]);
      setAssessmentResult(undefined);
      setCurrentStage("initializing");
      setResearchDetails({
        // Reset research details
        urls_accessed: [],
        successful_urls: [],
        failed_urls: [],
        content_summaries: [],
      });

      // Create session
      const sessionResponse = await fetch("/api/research/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          mode: settings.searchMode,
          settings: settings,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error(await sessionResponse.text());
      }

      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.session_id;

      // Set initial session state
      setSession({
        sessionId,
        status: "pending",
        query,
        messages: [],
        settings,
      });

      // Setup WebSocket connection
      setupWebSocket(sessionId);
    } catch (err) {
      console.error("Error starting research:", err);
      setError(err instanceof Error ? err.message : "Failed to start research");
      setSession(null);
      setIsConnected(false);
      cleanupWebSocket();
    }
  };

  const stopResearch = async () => {
    if (!session?.sessionId) return;

    try {
      const response = await fetch(`/api/research/${session.sessionId}/stop`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to stop research");
      }

      setSession((prev) => (prev ? { ...prev, status: "stopped" } : null));
      cleanupWebSocket();
      setExpandedMessages(true);
    } catch (err) {
      console.error("Error stopping research:", err);
      setError("Failed to stop research");
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupWebSocket();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);
  const showResearchComponents = Boolean(
    session &&
      !hasResult &&
      session.status !== "completed" &&
      session.status !== "stopped" &&
      session.status !== "error"
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className={`max-w-7xl mx-auto px-4 py-6 ${
          showSettings ? "mr-80" : ""
        } transition-all duration-200`}
      >
        <ResearchHeader
          status={session?.status || null}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings(!showSettings)}
        />

        {showSettings && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowSettings(false)}
          />
        )}

        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onSubmit={(e) => {
            e.preventDefault();
            startResearch();
          }}
          onStop={stopResearch}
          isStartDisabled={
            !query.trim() || (session?.status === "running" && isConnected)
          }
          showStopButton={!!(session && isConnected)}
        />

        <ErrorMessage message={error} />

        {/* Show progress for both research and basic search modes */}
        {showResearchComponents && session && (
          <>
            {settings.searchMode === "research" && (
              <>
                <StrategicAnalysis
                  focusAreas={focusAreas}
                  confidenceScore={confidenceScore}
                />

                <ResearchControls
                  status={session.status}
                  onPause={handlePause}
                  onResume={handleResume}
                  onAssess={handleAssess}
                  isAssessing={isAssessing}
                  assessmentResult={assessmentResult}
                />
              </>
            )}

            <ResearchProgress
              currentFocus={currentFocus}
              sourcesAnalyzed={sourcesAnalyzed}
              documentContent={documentContent}
              sources={sources}
              stage={currentStage}
              researchDetails={researchDetails}
            />
          </>
        )}

        <MessagesList
          messages={messages}
          hasResult={hasResult}
          expandedMessages={expandedMessages}
          onToggleExpand={() => setExpandedMessages(!expandedMessages)}
          isProcessing={isProcessing}
        />

        {showSettings && (
          <SettingsPanel
            settings={settings}
            onSettingsChange={setSettings}
            onReset={() => setSettings(defaultSettings)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
