import React, { useState, useEffect } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

interface ResearchSession {
  sessionId: string;
  query: string;
  startTime: string;
  status: string;
  result?: string;
}

interface ResearchHistoryProps {
  sessions: ResearchSession[];
  onDeleteSession: (sessionId: string) => void;
  onRestoreSession: (sessionId: string) => void;
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

  const handleDelete = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowConfirmDialog(true);
  };

  const confirmDelete = () => {
    if (selectedSessionId) {
      onDeleteSession(selectedSessionId);
      setShowConfirmDialog(false);
      setSelectedSessionId(null);
    }
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        Research History
      </h2>
      <div className="space-y-4">
        {sessions.map((session) => (
          <div
            key={session.sessionId}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  {session.query}
                </h3>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{formatTime(session.startTime)}</span>
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
              <div className="flex space-x-2">
                <button
                  onClick={() => onRestoreSession(session.sessionId)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDelete(session.sessionId)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
            {session.result && (
              <div className="mt-2 text-sm text-gray-600">
                <div className="line-clamp-2">{session.result}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onCancel={() => setShowConfirmDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Research Session"
        message="Are you sure you want to delete this research session? This action cannot be undone."
      />

      {sessions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No research sessions yet
        </div>
      )}
    </div>
  );
};
