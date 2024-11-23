import React, { useState, useEffect, useRef } from "react";
import config from "./config";
import "./App.css";
import { ResearchHeader } from "./components/ResearchHeader";
import { SearchBar } from "./components/SearchBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { MessagesList } from "./components/MessagesList";
import { ErrorMessage } from "./components/ErrorMessage";
import { ResearchDashboard } from "./components/ResearchDashboard";
import { ResearchHistory } from "./components/ResearchHistory";
import { ResearchControls } from "./components/ResearchControls";
import { ResearchProgress } from "./components/ResearchProgress";

import {
  SearchSettings,
  Message,
  ResearchSession,
  FocusArea,
  AssessmentResult,
  ResearchDetails,
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
  // ... (state declarations remain the same)
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
  const [currentStage, setCurrentStage] = useState<string>("initializing");
  const [researchDetails, setResearchDetails] = useState<ResearchDetails>({
    urls_accessed: [],
    successful_urls: [],
    failed_urls: [],
    content_summaries: [],
  });

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const [researchSessions, setResearchSessions] = useState<ResearchSession[]>(
    []
  );

  // Add handleReconnect function
  const handleReconnect = (session_id: string) => {
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
      setupWebSocket(session_id);
    }, RECONNECT_DELAY);
  };

  // Add handleWebSocketMessage function
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received WebSocket message:", data);

      switch (data.type) {
        case "status":
          if (data.data?.status) {
            setSession((prev) =>
              prev ? { ...prev, status: data.data.status } : null
            );

            if (
              data.data.status === "completed" ||
              data.data.status === "stopped"
            ) {
              cleanupWebSocket();
            }
          }
          break;

        case "analysis":
          if (data.data) {
            setFocusAreas(data.data.focus_areas || []);
            setConfidenceScore(data.data.confidence_score || 0);
          }
          break;

        case "progress":
          if (data.data) {
            setCurrentFocus(data.data.current_focus);
            setSourcesAnalyzed(data.data.sources_analyzed);
            setDocumentContent(data.data.document_content);
            setSources(data.data.sources || []);
            if (data.data.stage) {
              setCurrentStage(data.data.stage);
            }
            if (data.data.research_details) {
              setResearchDetails(data.data.research_details);
            }
          }
          break;

        case "result":
          setExpandedMessages(false);
          setHasResult(true);
          setSession((prev) =>
            prev ? { ...prev, status: "completed" } : null
          );

          if (data.message || data.data) {
            setMessages((prev) => {
              const resultMessage = {
                type: "result",
                message:
                  data.message || data.data?.result || "No result content",
                timestamp: data.timestamp || new Date().toISOString(),
                data: data.data,
              };

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
          break;

        case "message":
          if (data.message || data.data) {
            setMessages((prev) => {
              const newMessage = {
                type: data.type || "message",
                message: data.message || "",
                timestamp: data.timestamp || new Date().toISOString(),
                data: data.data,
              };

              const isDuplicate = prev.some(
                (msg) =>
                  msg.type === newMessage.type &&
                  msg.message === newMessage.message &&
                  msg.timestamp === newMessage.timestamp
              );

              return isDuplicate ? prev : [...prev, newMessage];
            });
          }
          break;

        case "error":
          setError(data.message);
          setSession((prev) => (prev ? { ...prev, status: "error" } : null));
          break;
      }
    } catch (err) {
      console.error("Error processing WebSocket message:", err);
    }
  };

  // Add function to fetch research history
  const fetchResearchHistory = async () => {
    try {
      const response = await fetch("/api/research/sessions");
      if (!response.ok) {
        throw new Error("Failed to fetch research history");
      }
      const sessions = await response.json();
      setResearchSessions(sessions);
    } catch (err) {
      console.error("Error fetching research history:", err);
      setError("Failed to fetch research history");
    }
  };

  // Add function to delete session

  // Add WebSocket setup function
  const setupWebSocket = (session_id: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(`${config.server.wsUrl}/ws/${session_id}`);
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
        handleReconnect(session_id);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket connection error");
    };

    ws.onmessage = handleWebSocketMessage;
  };

  // Add cleanup function
  const cleanupWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  // Update handleDeleteSession parameter
  const handleDeleteSession = async (session_id: string) => {
    try {
      const response = await fetch(`/api/research/sessions/${session_id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete session");
      }
      // Refresh sessions list
      fetchResearchHistory();
    } catch (err) {
      console.error("Error deleting session:", err);
      setError("Failed to delete session");
    }
  };

  // Update handleRestoreSession parameter
  const handleRestoreSession = async (session_id: string) => {
    try {
      // Clear any existing session and messages
      setSession(null);
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
        urls_accessed: [],
        successful_urls: [],
        failed_urls: [],
        content_summaries: [],
      });

      const response = await fetch(
        `/api/research/sessions/${session_id}/restore`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to restore session");
      }

      const result = await response.json();
      console.log("Restore session result:", result);

      // Find the original session
      const restoredSession = researchSessions.find(
        (s) => s.session_id === session_id
      );

      if (restoredSession) {
        setQuery(restoredSession.query);

        // Start new session with restored data
        const newSession: ResearchSession = {
          session_id: result.new_session_id,
          status: "starting",
          query: restoredSession.query,
          mode: restoredSession.mode,
          messages: [],
          settings,
          start_time: new Date().toISOString(),
        };

        setSession(newSession);
        setupWebSocket(result.new_session_id);
      } else {
        throw new Error("Original session not found");
      }
    } catch (err) {
      console.error("Error restoring session:", err);
      setError("Failed to restore session");
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

      // Set initial session state
      const newSession: ResearchSession = {
        session_id: sessionData.session_id,
        status: "pending",
        query,
        mode: settings.searchMode,
        messages: [],
        settings,
        start_time: new Date().toISOString(),
      };

      setSession(newSession);

      // Setup WebSocket connection
      setupWebSocket(newSession.session_id);
    } catch (err) {
      console.error("Error starting research:", err);
      setError(err instanceof Error ? err.message : "Failed to start research");
      setSession(null);
      setIsConnected(false);
      cleanupWebSocket();
    }
  };

  const stopResearch = async () => {
    if (!session?.session_id) return;

    try {
      const response = await fetch(`/api/research/${session.session_id}/stop`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to stop research");
      }

      setSession((prev) => (prev ? { ...prev, status: "stopped" } : null));
      cleanupWebSocket();
    } catch (err) {
      console.error("Error stopping research:", err);
      setError("Failed to stop research");
    }
  };

  // Update handlePause
  const handlePause = async () => {
    if (!session?.session_id) return;
    try {
      const response = await fetch(
        `/api/research/${session.session_id}/pause`,
        {
          method: "POST",
        }
      );
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
    if (!session?.session_id) return;
    try {
      const response = await fetch(
        `/api/research/${session.session_id}/resume`,
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
    if (!session?.session_id) return;
    setIsAssessing(true);
    try {
      const response = await fetch(
        `/api/research/${session.session_id}/assess`,
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

  const showResearchComponents = Boolean(
    session &&
      !hasResult &&
      session.status !== "completed" &&
      session.status !== "stopped" &&
      session.status !== "error"
  );

  // Add useEffect for fetching research history
  useEffect(() => {
    fetchResearchHistory();
  }, []);

  // Update research history when session status changes
  useEffect(() => {
    if (
      session?.status === "completed" ||
      session?.status === "stopped" ||
      session?.status === "error"
    ) {
      fetchResearchHistory();
    }
  }, [session?.status]);

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

        <ResearchHistory
          sessions={researchSessions}
          onDeleteSession={handleDeleteSession}
          onRestoreSession={handleRestoreSession}
        />

        {session && (
          <ResearchDashboard
            currentFocus={currentFocus}
            sourcesAnalyzed={sourcesAnalyzed}
            documentContent={documentContent}
            sources={sources}
            stage={currentStage}
            researchDetails={researchDetails}
            confidenceScore={confidenceScore}
            focusAreas={focusAreas}
            status={session.status}
            startTime={session.start_time}
            isAssessing={isAssessing}
            assessmentResult={assessmentResult}
            hasResult={hasResult}
            onPause={handlePause}
            onResume={handleResume}
            onAssess={handleAssess}
            messages={messages}
            result={
              hasResult
                ? {
                    summary:
                      messages.find((m) => m.type === "result")?.message || "",
                    keyFindings: messages
                      .filter((m) => m.type === "finding")
                      .map((m) => m.message),
                    sources:
                      researchDetails?.successful_urls.map((url: string) => ({
                        url,
                        title: new URL(url).hostname,
                        reliability: 100,
                        content:
                          researchDetails?.content_summaries.find(
                            (s: { url: string }) => s.url === url
                          )?.summary || "",
                      })) || [],
                    analysisSteps: messages
                      .filter((m) => m.type === "progress")
                      .map((m) => ({
                        stage: m.data?.stage || "Unknown",
                        description: m.message,
                        outcome: m.data?.outcome || "",
                      })),
                  }
                : undefined
            }
          />
        )}

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
