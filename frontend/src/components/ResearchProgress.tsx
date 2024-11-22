import React from "react";

interface ResearchProgressProps {
  currentFocus?: {
    area: string;
    priority: number;
  };
  sourcesAnalyzed: number;
  documentContent?: string;
  sources: string[];
  stage?: string;
}

export const ResearchProgress: React.FC<ResearchProgressProps> = ({
  currentFocus,
  sourcesAnalyzed,
  documentContent,
  sources,
  stage = "initializing",
}) => {
  // Helper function to get stage display text and description
  const getStageInfo = (
    stage: string
  ): { title: string; description: string } => {
    const stageMap: { [key: string]: { title: string; description: string } } =
      {
        initializing: {
          title: "Initializing",
          description: "Setting up research process...",
        },
        formulating: {
          title: "Formulating Query",
          description: "Creating optimal search query...",
        },
        searching: {
          title: "Searching",
          description: "Looking for relevant information...",
        },
        selecting: {
          title: "Selecting Sources",
          description: "Identifying most relevant sources...",
        },
        scraping: {
          title: "Retrieving Content",
          description: "Gathering information from selected sources...",
        },
        analyzing: {
          title: "Analyzing",
          description: "Processing gathered information...",
        },
        thinking: {
          title: "Processing",
          description: "Synthesizing information...",
        },
        evaluating: {
          title: "Evaluating",
          description: "Assessing information quality...",
        },
        generating: {
          title: "Generating Answer",
          description: "Creating comprehensive response...",
        },
        querying: {
          title: "Querying",
          description: "Executing search query...",
        },
      };
    return (
      stageMap[stage] || {
        title: "Processing",
        description: "Working on your request...",
      }
    );
  };

  const stageInfo = getStageInfo(stage);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Research Progress</h3>
        <span className="text-sm text-gray-500">
          {sourcesAnalyzed} sources analyzed
        </span>
      </div>

      {/* Stage Progress Indicator */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-md font-medium text-blue-900">Current Stage</h4>
          <div className="flex items-center">
            <div className="animate-pulse h-2 w-2 rounded-full bg-blue-500 mr-2" />
            <span className="text-sm text-blue-700">Active</span>
          </div>
        </div>
        <div className="mt-2">
          <div className="text-lg font-semibold text-blue-800">
            {stageInfo.title}
          </div>
          <p className="text-sm text-blue-600 mt-1">{stageInfo.description}</p>
        </div>
      </div>

      {currentFocus && (
        <div className="mb-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
          <h4 className="text-md font-medium text-indigo-900 mb-2">
            Current Focus
          </h4>
          <div className="mt-1">
            <p className="text-sm text-indigo-800 font-medium">
              {currentFocus.area}
            </p>
            <p className="text-xs text-indigo-600 mt-1">
              Priority Level: {currentFocus.priority}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
          <div className="text-sm font-medium text-green-800 mb-1">
            Sources Analyzed
          </div>
          <div className="text-2xl font-semibold text-green-900">
            {sourcesAnalyzed}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
          <div className="text-sm font-medium text-purple-800 mb-1">
            Research Mode
          </div>
          <div className="text-lg font-semibold text-purple-900">
            {currentFocus ? "Strategic Research" : "Basic Search"}
          </div>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="mt-4">
          <h4 className="text-md font-medium text-gray-900 mb-2">
            Analyzed Sources
          </h4>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 max-h-48 overflow-y-auto">
            <ul className="space-y-2">
              {sources.map((source, index) => (
                <li
                  key={index}
                  className="text-sm text-blue-600 hover:text-blue-800 truncate"
                >
                  <a
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <svg
                      className="h-4 w-4 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                    {source}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {documentContent && (
        <div className="mt-4">
          <h4 className="text-md font-medium text-gray-900 mb-2">
            Research Document
          </h4>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 max-h-96 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {documentContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
