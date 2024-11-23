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
  researchDetails?: {
    urls_accessed: string[];
    successful_urls: string[];
    failed_urls: string[];
    content_summaries: Array<{
      url: string;
      summary: string;
    }>;
  };
}

export const ResearchProgress: React.FC<ResearchProgressProps> = ({
  currentFocus,
  sourcesAnalyzed,
  documentContent,
  sources,
  stage = "initializing",
  researchDetails,
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

      {/* Research Details */}
      {researchDetails && (
        <div className="mt-4 space-y-4">
          {/* URLs Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <div className="text-sm font-medium text-green-800">
                Sources Analyzed
              </div>
              <div className="text-2xl font-semibold text-green-900">
                {sourcesAnalyzed}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="text-sm font-medium text-blue-800">
                Successful URLs
              </div>
              <div className="text-2xl font-semibold text-blue-900">
                {researchDetails.successful_urls.length}
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
              <div className="text-sm font-medium text-yellow-800">
                Failed URLs
              </div>
              <div className="text-2xl font-semibold text-yellow-900">
                {researchDetails.failed_urls.length}
              </div>
            </div>
          </div>

          {/* Content Summaries */}
          {researchDetails.content_summaries.length > 0 && (
            <div className="mt-4">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                Content Summaries
              </h4>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 max-h-48 overflow-y-auto">
                <div className="space-y-4">
                  {researchDetails.content_summaries.map((summary, index) => (
                    <div
                      key={index}
                      className="border-l-4 border-blue-500 pl-3"
                    >
                      <a
                        href={summary.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {new URL(summary.url).hostname}
                      </a>
                      <p className="text-sm text-gray-600 mt-1">
                        {summary.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* URLs List */}
          <div className="mt-4">
            <h4 className="text-md font-medium text-gray-900 mb-2">
              Accessed Sources
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {researchDetails.urls_accessed.map((url, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-2 ${
                      researchDetails.failed_urls.includes(url)
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        researchDetails.failed_urls.includes(url)
                          ? "bg-red-500"
                          : "bg-green-500"
                      }`}
                    />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline truncate"
                    >
                      {url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
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
