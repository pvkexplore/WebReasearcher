import React from "react";

interface ResearchHeaderProps {
  status: string | null;
  showSettings: boolean;
  onToggleSettings: () => void;
}

const getStatusColor = (status: string | null) => {
  if (!status) return "bg-gray-500";
  switch (status) {
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

export const ResearchHeader: React.FC<ResearchHeaderProps> = ({
  status,
  showSettings,
  onToggleSettings,
}) => {
  return (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Web Researcher</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI-powered research assistant
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
          <span className="text-sm text-gray-600">{status || "Ready"}</span>
        </div>
        <button
          onClick={onToggleSettings}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Settings
        </button>
      </div>
    </div>
  );
};
