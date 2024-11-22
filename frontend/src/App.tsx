import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { ResearchHeader } from "./components/ResearchHeader";
import { SearchBar } from "./components/SearchBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { MessagesList } from "./components/MessagesList";
import { ErrorMessage } from "./components/ErrorMessage";
import { SearchSettings, Message, ResearchSession } from "./types";

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

function App() {
  const [expandedMessages, setExpandedMessages] = useState(true);
  const [hasResult, setHasResult] = useState(false);
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SearchSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const isProcessing = Boolean(
    session &&
      !hasResult &&
      (session.status === "starting" || session.status === "running")
  );

  const connectWebSocket = (sessionId: string, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    return new Promise<void>((resolve, reject) => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (err) {
          console.error("Error closing existing WebSocket:", err);
        }
        wsRef.current = null;
        setIsConnected(false);
      }

      try {
        console.log(
          `Creating WebSocket connection (attempt ${retryCount + 1})...`
        );
        const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);

        const connectionTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            console.log("WebSocket connection timeout");
            ws.close();
            reject(new Error("WebSocket connection timeout"));
          }
        }, 5000);

        ws.onopen = () => {
          console.log("WebSocket Connected");
          clearTimeout(connectionTimeout);
          setIsConnected(true);
          setError(null);
          resolve();
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            console.log("Received message:", data);

            if (data.type === "status" && data.data?.status) {
              const newStatus = data.data.status;
              setSession((prev) =>
                prev ? { ...prev, status: newStatus } : null
              );

              if (newStatus === "completed" || newStatus === "stopped") {
                ws.close();
                wsRef.current = null;
                setIsConnected(false);
              }
            }

            if (data.type === "result") {
              setExpandedMessages(false);
              setHasResult(true);
              setSession((prev) =>
                prev ? { ...prev, status: "completed" } : null
              );
              ws.close();
              wsRef.current = null;
              setIsConnected(false);
            }

            setMessages((prev) => {
              const newMessage = {
                type: data.type,
                message: data.message,
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
          } catch (err) {
            console.error("Error processing message:", err);
          }
        };

        ws.onclose = (event) => {
          console.log("WebSocket Disconnected", event);
          clearTimeout(connectionTimeout);
          wsRef.current = null;
          setIsConnected(false);

          if (
            retryCount < MAX_RETRIES &&
            event.code !== 1000 &&
            event.code !== 1001
          ) {
            console.log(`Retrying WebSocket connection in ${RETRY_DELAY}ms...`);
            setTimeout(() => {
              connectWebSocket(sessionId, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, RETRY_DELAY);
          } else {
            setSession((prev) =>
              prev ? { ...prev, status: "stopped" } : null
            );
            reject(new Error("WebSocket connection closed"));
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket Error:", error);
          wsRef.current = null;
        };

        wsRef.current = ws;
      } catch (err) {
        console.error("Error creating WebSocket:", err);
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying WebSocket connection in ${RETRY_DELAY}ms...`);
          setTimeout(() => {
            connectWebSocket(sessionId, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, RETRY_DELAY);
        } else {
          setError(
            "Failed to create WebSocket connection after multiple attempts"
          );
          reject(err);
        }
      }
    });
  };

  const startResearch = async () => {
    if (!query.trim()) {
      setError("Please enter a query");
      return;
    }

    try {
      // Reset all state for a fresh start
      setSession(null);
      setIsConnected(false);
      setError(null);
      setMessages([]);
      setHasResult(false);
      setExpandedMessages(true); // Reset to expanded state when starting new research

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const requestData = {
        query,
        mode: settings.searchMode,
        settings: {
          maxAttempts: settings.maxAttempts,
          maxResults: settings.maxResults,
          timeRange: settings.timeRange,
        },
      };

      const sessionResponse = await fetch(
        "http://localhost:8000/research/start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        }
      );

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        throw new Error(errorText || "Failed to start research");
      }

      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.session_id;

      try {
        await connectWebSocket(sessionId);
      } catch (err) {
        throw new Error("Failed to establish WebSocket connection");
      }

      const beginResponse = await fetch(
        `http://localhost:8000/research/${sessionId}/begin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        }
      );

      if (!beginResponse.ok) {
        const errorText = await beginResponse.text();
        throw new Error(errorText || "Failed to begin research");
      }

      setSession({
        sessionId: sessionId,
        status: "starting",
        query: query,
        messages: [],
        settings: settings,
      });
    } catch (err) {
      console.error("Error starting research:", err);
      setError(err instanceof Error ? err.message : "Failed to start research");
      setSession(null);
      setIsConnected(false);
      setHasResult(false);
      setExpandedMessages(true); // Also reset on error
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  };

  const stopResearch = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!session) return;

    try {
      const response = await fetch(
        `http://localhost:8000/research/${session.sessionId}/stop`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Failed to stop research");
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setSession((prev) => (prev ? { ...prev, status: "stopped" } : null));
      setIsConnected(false);
      setExpandedMessages(true); // Reset expanded state when stopping
    } catch (err) {
      console.error("Error stopping research:", err);
      setError("Failed to stop research");
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        console.log("Cleaning up WebSocket connection");
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [session?.sessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startResearch();
  };

  const isStartDisabled =
    !query.trim() ||
    ((session?.status === "starting" || session?.status === "running") &&
      isConnected);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <ResearchHeader
          status={session?.status || null}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings(!showSettings)}
        />

        {showSettings && (
          <SettingsPanel
            settings={settings}
            onSettingsChange={setSettings}
            onReset={() => setSettings(defaultSettings)}
          />
        )}

        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onSubmit={handleSubmit}
          onStop={stopResearch}
          isStartDisabled={isStartDisabled}
          showStopButton={!!(session && isConnected)}
        />

        <ErrorMessage message={error} />

        <MessagesList
          messages={messages}
          hasResult={hasResult}
          expandedMessages={expandedMessages}
          onToggleExpand={() => setExpandedMessages(!expandedMessages)}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  );
}

export default App;
