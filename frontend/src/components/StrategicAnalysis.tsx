import React from "react";

interface FocusArea {
  area: string;
  priority: number;
  timestamp: string;
}

interface StrategicAnalysisProps {
  focusAreas: FocusArea[];
  confidenceScore: number;
  onReanalyze?: () => void;
}

export const StrategicAnalysis: React.FC<StrategicAnalysisProps> = ({
  focusAreas,
  confidenceScore,
  onReanalyze,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Strategic Analysis</h3>
        <div className="flex items-center">
          <span className="text-sm text-gray-500 mr-2">Confidence Score:</span>
          <span
            className={`text-sm font-medium ${
              confidenceScore >= 0.7 ? "text-green-600" : "text-yellow-600"
            }`}
          >
            {(confidenceScore * 100).toFixed(1)}%
          </span>
          {onReanalyze && (
            <button
              onClick={onReanalyze}
              className="ml-4 text-sm text-indigo-600 hover:text-indigo-900"
            >
              Reanalyze
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {focusAreas.map((focus, index) => (
          <div key={index} className="border-l-4 border-indigo-500 pl-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="text-md font-medium">{focus.area}</h4>
                <p className="text-sm text-gray-500">
                  Priority Level: {focus.priority}
                </p>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(focus.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
