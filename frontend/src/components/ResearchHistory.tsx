import React, { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import ReactMarkdown from "react-markdown";

interface ResearchSession {
  session_id: string;
  query: string;
  mode: string;
  status: string;
  start_time: string;
  end_time?: string;
  result?: string;
  settings?: any;
  research_details?: any;
}

interface ResearchHistoryProps {
  sessions: ResearchSession[];
  onDeleteSession: (session_id: string) => void;
  onRestoreSession: (session_id: string) => void;
}

export const ResearchHistory: React.FC<ResearchHistoryProps> = ({
  sessions,
  onDeleteSession,
  onRestoreSession,
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const handleDelete = (session_id: string) => {
    setSelectedSessionId(session_id);
    setShowConfirmDialog(true);
  };

  const confirmDelete = () => {
    if (selectedSessionId) {
      onDeleteSession(selectedSessionId);
      setShowConfirmDialog(false);
      setSelectedSessionId(null);
      setExpandedSession(null);
    }
  };

  const handleRestore = (session_id: string) => {
    if (!session_id) {
      console.error("Invalid session ID for restore");
      return;
    }
    onRestoreSession(session_id);
    setExpandedSession(null);
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "Invalid date";
    }
  };

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.session_id}
          className="border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {/* Session Header */}
          <div className="p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <button
                  onClick={() =>
                    setExpandedSession(
                      expandedSession === session.session_id
                        ? null
                        : session.session_id
                    )
                  }
                  className="text-sm font-medium text-gray-900 hover:text-indigo-600 text-left w-full"
                >
                  {session.query}
                </button>
                <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                  <span>{formatTime(session.start_time)}</span>
                  <span>•</span>
                  <span
                    className={`px-2 py-0.5 rounded-full ${getStatusColor(
                      session.status
                    )}`}
                  >
                    {session.status}
                  </span>
                </div>
              </div>
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => handleRestore(session.session_id)}
                  className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDelete(session.session_id)}
                  className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          {expandedSession === session.session_id && session.result && (
            <div className="border-t border-gray-200 p-3 bg-gray-50">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{session.result}</ReactMarkdown>
              </div>
              {session.research_details?.knowledge_graph && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    Entities Found:{" "}
                    {session.research_details.knowledge_graph.entities.length}
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    Relationships:{" "}
                    {
                      session.research_details.knowledge_graph.relationships
                        .length
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onCancel={() => setShowConfirmDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Research Session"
        message="Are you sure you want to delete this research session? This action cannot be undone."
      />

      {sessions.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No research sessions yet
        </div>
      )}
    </div>
  );
};
