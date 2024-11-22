import React, { useRef, useEffect } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

interface Message {
  type: string;
  message: string;
  timestamp: string;
  data?: any;
}

interface MessagesListProps {
  messages: Message[];
  hasResult: boolean;
  expandedMessages: boolean;
  onToggleExpand: () => void;
  isProcessing: boolean; // Changed from optional to required boolean
}

export const MessagesList: React.FC<MessagesListProps> = ({
  messages,
  hasResult,
  expandedMessages,
  onToggleExpand,
  isProcessing,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const visibleMessages = messages.filter(
    (msg) => expandedMessages || msg.type === "result"
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-5 sm:p-6">
        {hasResult && (
          <div className="mb-4 flex justify-between items-center sticky top-0 bg-white z-10">
            <span className="text-sm text-gray-500">
              {expandedMessages
                ? "Showing all messages"
                : "Showing only result"}
            </span>
            <button
              onClick={onToggleExpand}
              className="text-sm text-indigo-600 hover:text-indigo-900"
            >
              {expandedMessages
                ? "Collapse Status Messages"
                : "Show All Messages"}
            </button>
          </div>
        )}
        <div
          ref={scrollContainerRef}
          className="flow-root overflow-y-auto"
          style={{
            maxHeight: "500px",
            scrollBehavior: "smooth",
          }}
        >
          <ul role="list" className="-mb-8">
            {visibleMessages.map((msg, idx) => (
              <li key={idx}>
                <div className="relative pb-8">
                  {idx !== visibleMessages.length - 1 && (
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
          {isProcessing && <LoadingSpinner />}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};
