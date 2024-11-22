import React, { useState, useEffect, useRef } from "react";
import "./App.css";

interface SearchSettings {
  maxAttempts: number;
  maxResults: number;
  timeRange: "none" | "d" | "w" | "m" | "y";
  searchMode: "research" | "search";
  shuffleResults: boolean;
  adaptiveSearch: boolean;
  improveResults: boolean;
  allowRetry: boolean;
}

interface Message {
  type: string;
  message: string;
  timestamp: string;
  data?: any;
}

interface ResearchSession {
  sessionId: string;
  status: string;
  query: string;
  messages: Message[];
  settings: SearchSettings;
}

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

const timeRangeOptions = [
  { value: "none", label: "Any Time" },
  { value: "d", label: "Past 24 Hours" },
  { value: "w", label: "Past Week" },
  { value: "m", label: "Past Month" },
  { value: "y", label: "Past Year" },
];

function App() {
  const [query, setQuery] = useState("");
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SearchSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  const connectWebSocket = (sessionId: string, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second

    return new Promise<void>((resolve, reject) => {
      // Close existing connection if any
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

        // Set a connection timeout
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

            // Update session status if status message received
            if (data.type === "status" && data.data?.status) {
              const newStatus = data.data.status;
              setSession((prev) =>
                prev
                  ? {
                      ...prev,
                      status: newStatus,
                    }
                  : null
              );

              // If research is completed or stopped, close the connection
              if (newStatus === "completed" || newStatus === "stopped") {
                ws.close();
                wsRef.current = null;
                setIsConnected(false);
              }
            }

            // If we receive a result message, consider it completed
            if (data.type === "result") {
              setSession((prev) =>
                prev
                  ? {
                      ...prev,
                      status: "completed",
                    }
                  : null
              );
              ws.close();
              wsRef.current = null;
              setIsConnected(false);
            }

            // Add message to messages list
            setMessages((prev) => {
              const newMessage = {
                type: data.type,
                message: data.message,
                timestamp: data.timestamp || new Date().toISOString(),
                data: data.data,
              };

              // Ensure no duplicate messages
              const isDuplicate = prev.some(
                (msg) =>
                  msg.type === newMessage.type &&
                  msg.message === newMessage.message &&
                  msg.timestamp === newMessage.timestamp
              );

              return isDuplicate ? prev : [...prev, newMessage];
            });

            // Auto-scroll after message added
            setTimeout(scrollToBottom, 100);
          } catch (err) {
            console.error("Error processing message:", err);
          }
        };

        ws.onclose = (event) => {
          console.log("WebSocket Disconnected", event);
          clearTimeout(connectionTimeout);
          wsRef.current = null;
          setIsConnected(false);

          // Retry connection if not at max retries and not a normal closure
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
            // Update session status only if max retries reached or normal closure
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    status: "stopped",
                  }
                : null
            );
            reject(new Error("WebSocket connection closed"));
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket Error:", error);
          // Don't set error message here, let onclose handle retries
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

      // Close any existing WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      console.log("Starting research with query:", query);
      console.log("Settings:", settings);

      // Create request payload
      const requestData = {
        query,
        mode: settings.searchMode,
        settings: {
          maxAttempts: settings.maxAttempts,
          maxResults: settings.maxResults,
          timeRange: settings.timeRange,
        },
      };

      // First get a session ID from the server
      const sessionResponse = await fetch(
        "http://localhost:8000/research/start",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        }
      );

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error("Error response:", errorText);
        throw new Error(errorText || "Failed to start research");
      }

      const sessionData = await sessionResponse.json();
      const sessionId = sessionData.session_id;
      console.log("Got session ID:", sessionId);

      // Then establish WebSocket connection
      try {
        await connectWebSocket(sessionId);
        console.log("WebSocket connection established");
      } catch (err) {
        console.error("Failed to establish WebSocket connection:", err);
        throw new Error("Failed to establish WebSocket connection");
      }

      // Finally begin the research
      const beginResponse = await fetch(
        `http://localhost:8000/research/${sessionId}/begin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        }
      );

      if (!beginResponse.ok) {
        const errorText = await beginResponse.text();
        console.error("Error response:", errorText);
        throw new Error(errorText || "Failed to begin research");
      }

      const data = await beginResponse.json();
      console.log("Research started:", data);

      // Initialize session state
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

      // Reset session if error occurs
      setSession(null);
      setIsConnected(false);

      // Close WebSocket if it exists
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  };

  const stopResearch = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    if (!session) return;

    try {
      // Stop research on the server
      const response = await fetch(
        `http://localhost:8000/research/${session.sessionId}/stop`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to stop research");
      }

      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Update session status and reset connection state
      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: "stopped",
            }
          : null
      );
      setIsConnected(false);
    } catch (err) {
      console.error("Error stopping research:", err);
      setError("Failed to stop research");
    }
  };

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        console.log("Cleaning up WebSocket connection");
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [session?.sessionId]); // Cleanup when session ID changes

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startResearch();
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  // Check if research is in progress
  const isResearchInProgress =
    (session?.status === "starting" || session?.status === "running") &&
    isConnected;

  // Update isStartDisabled to handle completed state
  const isStartDisabled = !query.trim() || isResearchInProgress;

  const getStatusColor = () => {
    if (!session) return "bg-gray-500";
    switch (session.status) {
      case "starting":
        return "bg-yellow-500";
      case "running":
        return "bg-green-500";
      case "stopped":
      case "completed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const Toggle = ({
    enabled,
    onChange,
    label,
    description,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description: string;
  }) => (
    <div className="flex items-center justify-between py-4 border-b border-gray-100">
      <div className="flex-1">
        <h3 className="text-sm font-medium text-gray-900">{label}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        className={`${
          enabled ? "bg-indigo-600" : "bg-gray-200"
        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
        onClick={() => onChange(!enabled)}
      >
        <span
          className={`${
            enabled ? "translate-x-5" : "translate-x-0"
          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Web Researcher</h1>
            <p className="mt-1 text-sm text-gray-500">
              AI-powered research assistant
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
              <span className="text-sm text-gray-600">
                {session ? session.status : "Ready"}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Settings
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">
                  Research Settings
                </h2>
                <button
                  onClick={resetSettings}
                  className="text-sm text-indigo-600 hover:text-indigo-900"
                >
                  Reset to Defaults
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Search Mode
                    </label>
                    <select
                      value={settings.searchMode}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          searchMode: e.target.value as "research" | "search",
                        }))
                      }
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="research">Research</option>
                      <option value="search">Basic Search</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Time Range
                    </label>
                    <select
                      value={settings.timeRange}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          timeRange: e.target.value as
                            | "none"
                            | "d"
                            | "w"
                            | "m"
                            | "y",
                        }))
                      }
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      {timeRangeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Max Attempts
                    </label>
                    <input
                      type="number"
                      value={settings.maxAttempts}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          maxAttempts: parseInt(e.target.value) || 1,
                        }))
                      }
                      min="1"
                      max="10"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Max Results
                    </label>
                    <input
                      type="number"
                      value={settings.maxResults}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          maxResults: parseInt(e.target.value) || 1,
                        }))
                      }
                      min="1"
                      max="50"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <Toggle
                    enabled={settings.shuffleResults}
                    onChange={(value) =>
                      setSettings((prev) => ({
                        ...prev,
                        shuffleResults: value,
                      }))
                    }
                    label="Shuffle results"
                    description="Randomly select results from the search pool"
                  />
                  <Toggle
                    enabled={settings.adaptiveSearch}
                    onChange={(value) =>
                      setSettings((prev) => ({
                        ...prev,
                        adaptiveSearch: value,
                      }))
                    }
                    label="Adaptive search"
                    description="Automatically adjust search parameters based on results"
                  />
                  <Toggle
                    enabled={settings.improveResults}
                    onChange={(value) =>
                      setSettings((prev) => ({
                        ...prev,
                        improveResults: value,
                      }))
                    }
                    label="Improve results"
                    description="Use AI to enhance search results quality"
                  />
                  <Toggle
                    enabled={settings.allowRetry}
                    onChange={(value) =>
                      setSettings((prev) => ({ ...prev, allowRetry: value }))
                    }
                    label="Allow retry"
                    description="Automatically retry failed searches"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your research query..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm pl-4 pr-12 py-3"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isStartDisabled}
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Start Research
            </button>
            {session && isConnected && (
              <button
                onClick={stopResearch}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Stop
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <div className="flow-root">
              <ul role="list" className="-mb-8">
                {messages.map((msg, idx) => (
                  <li key={idx}>
                    <div className="relative pb-8">
                      {idx !== messages.length - 1 && (
                        <span
                          className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex items-start space-x-3">
                        <div className="relative">
                          <span
                            className={`h-10 w-10 rounded-full flex items-center justify-center ring-8 ring-white ${
                              msg.type === "error"
                                ? "bg-red-500"
                                : msg.type === "result"
                                ? "bg-green-500"
                                : msg.type === "status"
                                ? "bg-blue-500"
                                : "bg-gray-500"
                            }`}
                          >
                            <svg
                              className="h-5 w-5 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              {msg.type === "error" ? (
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                  clipRule="evenodd"
                                />
                              ) : msg.type === "result" ? (
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              ) : (
                                <path
                                  fillRule="evenodd"
                                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                  clipRule="evenodd"
                                />
                              )}
                            </svg>
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div>
                            <div className="text-sm">
                              <span className="font-medium text-gray-900">
                                {msg.type.charAt(0).toUpperCase() +
                                  msg.type.slice(1)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm text-gray-500">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="mt-2 text-sm text-gray-700">
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                          </div>
                          {msg.data && (
                            <div className="mt-2 text-sm">
                              <pre className="bg-gray-50 rounded p-3 text-xs overflow-x-auto">
                                {JSON.stringify(msg.data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
