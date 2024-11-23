import React, { useState, useEffect, useRef } from "react";
import KnowledgeGraph from "./KnowledgeGraph"; // Changed from { KnowledgeGraph }
import { ResearchHistory } from "./ResearchHistory";
import {
  ResearchDashboardProps,
  ResearchDetails,
  LLMInteraction,
  ScrapedContent,
  KnowledgeGraph as KnowledgeGraphType,
} from "../types";

export const ResearchDashboard: React.FC<ResearchDashboardProps> = ({
  currentFocus,
  sourcesAnalyzed,
  documentContent,
  sources,
  stage,
  researchDetails,
  confidenceScore,
  focusAreas,
  status,
  startTime,
  isAssessing,
  assessmentResult,
  hasResult,
  result,
}) => {
  // Switch to results tab automatically when results are available
  const [activeTab, setActiveTab] = useState<"progress" | "results">(
    hasResult ? "results" : "progress"
  );

  const [resultTab, setResultTab] = useState<
    "summary" | "analysis" | "sources" | "details" | "thinking" | "graph"
  >("summary");

  // Ref for research trail auto-scroll
  const researchTrailRef = useRef<HTMLDivElement>(null);

  // Auto-scroll research trail when new steps are added
  useEffect(() => {
    if (researchTrailRef.current) {
      researchTrailRef.current.scrollTop =
        researchTrailRef.current.scrollHeight;
    }
  }, [researchDetails?.analysis_steps]);

  // Extract key findings from research content
  const extractKeyFindings = (content: string): string[] => {
    const findings: string[] = [];

    // Split content into sentences
    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);

    // Look for key findings indicators
    sentences.forEach((sentence) => {
      const trimmed = sentence.trim();
      if (
        trimmed.includes("importantly") ||
        trimmed.includes("key") ||
        trimmed.includes("significant") ||
        trimmed.includes("found that") ||
        trimmed.includes("shows that") ||
        trimmed.includes("indicates that") ||
        trimmed.includes("demonstrates") ||
        /^(First|Second|Third|Finally|Moreover|Furthermore|In addition)/i.test(
          trimmed
        )
      ) {
        findings.push(trimmed + ".");
      }
    });

    // If no findings were extracted, create findings from main points
    if (findings.length === 0) {
      const mainPoints = sentences
        .filter(
          (s) => s.length > 30 && !s.toLowerCase().includes("i apologize")
        )
        .slice(0, 3)
        .map((s) => s.trim() + ".");
      findings.push(...mainPoints);
    }

    return findings;
  };

  useEffect(() => {
    if (hasResult) {
      setActiveTab("results");
      // Brief delay to allow animation
      setTimeout(() => setResultTab("summary"), 100);
    }
  }, [hasResult]);

  const getElapsedTime = () => {
    if (!startTime) return "";
    const elapsed = Date.now() - new Date(startTime).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Only show progress stage if we're not showing results
  const showProgressStage = !hasResult || activeTab === "progress";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      {/* Tab Navigation */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-4">
          <button
            className={`px-4 py-2 rounded-md ${
              activeTab === "progress"
                ? "bg-indigo-100 text-indigo-800"
                : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => setActiveTab("progress")}
          >
            Research Progress
          </button>
          {hasResult && (
            <button
              className={`px-4 py-2 rounded-md ${
                activeTab === "results"
                  ? "bg-indigo-100 text-indigo-800"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              onClick={() => setActiveTab("results")}
            >
              Results
            </button>
          )}
        </div>
        {startTime && (
          <div className="text-sm text-gray-500">
            Elapsed: {getElapsedTime()}
          </div>
        )}
      </div>

      {/* Progress View */}
      {activeTab === "progress" && (
        <div className="space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h3 className="text-sm font-medium text-blue-800">
                Current Stage
              </h3>
              <div className="mt-2 flex items-center">
                {!hasResult && (
                  <div className="animate-pulse h-2 w-2 rounded-full bg-blue-500 mr-2" />
                )}
                <p className="text-lg font-semibold text-blue-900">
                  {hasResult ? "Completed" : stage || "Initializing"}
                </p>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <h3 className="text-sm font-medium text-green-800">
                Sources Analyzed
              </h3>
              <p className="mt-2 text-2xl font-semibold text-green-900">
                {sourcesAnalyzed}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
              <h3 className="text-sm font-medium text-purple-800">
                Confidence Score
              </h3>
              <p className="mt-2 text-2xl font-semibold text-purple-900">
                {confidenceScore}%
              </p>
            </div>
          </div>

          {/* Current Focus */}
          {currentFocus && showProgressStage && (
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
              <h3 className="text-sm font-medium text-indigo-800 mb-2">
                Current Focus
              </h3>
              <p className="text-lg font-semibold text-indigo-900">
                {currentFocus.area}
              </p>
              <div className="mt-2 flex items-center">
                <span className="text-sm text-indigo-600">Priority Level:</span>
                <span className="ml-2 px-2 py-1 bg-indigo-100 rounded text-indigo-800">
                  {currentFocus.priority}
                </span>
              </div>
            </div>
          )}

          {/* Research Trail */}
          {researchDetails?.analysis_steps && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-800 mb-4">
                Research Trail
              </h3>
              <div
                ref={researchTrailRef}
                className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar"
              >
                {researchDetails.analysis_steps.map((step, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-medium text-gray-900">
                        {step.stage}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {step.description}
                    </p>
                    {step.outcome && (
                      <p className="mt-1 text-sm text-blue-600">
                        {step.outcome}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source Analysis */}
          {researchDetails && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-800 mb-4">
                Source Analysis
              </h3>
              <div className="space-y-4">
                {Array.from(researchDetails.successful_urls).map(
                  (url, index) => {
                    const metrics = researchDetails.source_metrics?.[url];
                    return (
                      <div
                        key={index}
                        className="border-l-4 border-green-500 pl-4"
                      >
                        <div className="flex justify-between items-start">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {new URL(url).hostname}
                          </a>
                          <span className="text-xs text-gray-500">
                            {metrics?.reliability
                              ? `${metrics.reliability}% reliable`
                              : "Analyzing..."}
                          </span>
                        </div>
                        {metrics?.content_length && (
                          <p className="mt-1 text-xs text-gray-500">
                            Content length: {metrics.content_length} characters
                          </p>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results View */}
      {activeTab === "results" && result && (
        <div className="space-y-6">
          {/* Results Navigation */}
          <div className="flex space-x-4 border-b border-gray-200">
            {(
              [
                "summary",
                "analysis",
                "sources",
                "details",
                "thinking",
                "graph",
              ] as const
            ).map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 border-b-2 font-medium text-sm ${
                  resultTab === tab
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setResultTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Summary Tab */}
          {resultTab === "summary" && (
            <div className="space-y-6">
              <div className="prose max-w-none">
                <h3>Research Summary</h3>
                <p>{result.summary}</p>
              </div>
              <div>
                <h4 className="text-lg font-medium mb-4">Key Findings</h4>
                <ul className="space-y-2">
                  {(result.keyFindings.length > 0
                    ? result.keyFindings
                    : extractKeyFindings(result.summary)
                  ).map((finding, index) => (
                    <li key={index} className="flex items-start">
                      <span className="h-5 w-5 text-green-500 mr-2">✓</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Analysis Tab */}
          {resultTab === "analysis" && (
            <div className="space-y-6">
              {researchDetails?.analysis_steps?.map((step, index) => (
                <div key={index} className="border-l-4 border-indigo-500 pl-4">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-indigo-900">
                      {step.stage}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-600">{step.description}</p>
                  {step.outcome && (
                    <p className="mt-2 text-sm text-indigo-600">
                      {step.outcome}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sources Tab */}
          {resultTab === "sources" && (
            <div className="space-y-6">
              {result.sources.map((source, index) => {
                const metrics = researchDetails?.source_metrics?.[source.url];
                return (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {source.title}
                      </a>
                      <span className="text-sm text-gray-500">
                        Reliability: {metrics?.reliability || "N/A"}%
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      {source.content}
                    </p>
                    {metrics && (
                      <div className="mt-2 text-xs text-gray-500">
                        <span>
                          Content length: {metrics.content_length} characters
                        </span>
                        <span className="mx-2">•</span>
                        <span>
                          Retrieved:{" "}
                          {new Date(metrics.scrape_time).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Thinking Process Tab */}
          {resultTab === "thinking" && (
            <div className="space-y-6">
              <div className="prose max-w-none">
                <h3>LLM Thinking Process</h3>
                {researchDetails?.llm_interactions?.map(
                  (interaction: LLMInteraction, index: number) => (
                    <div
                      key={index}
                      className="mb-8 bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          {interaction.stage}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {new Date(interaction.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h5 className="text-sm font-medium text-indigo-600 mb-2">
                            Prompt:
                          </h5>
                          <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-white rounded p-3 border border-gray-200">
                            {interaction.prompt}
                          </pre>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-green-600 mb-2">
                            Response:
                          </h5>
                          <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-white rounded p-3 border border-gray-200">
                            {interaction.response}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Knowledge Graph Tab */}
          {resultTab === "graph" && researchDetails?.knowledge_graph && (
            <div className="space-y-6">
              <KnowledgeGraph
                data={researchDetails.knowledge_graph as KnowledgeGraphType}
              />
            </div>
          )}

          {/* Details Tab */}
          {resultTab === "details" && (
            <div className="space-y-6">
              {/* Research Document */}
              <div className="prose max-w-none">
                <h3>Research Document</h3>
                <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 border border-gray-200">
                  {documentContent || result.summary}
                </pre>
              </div>

              {/* Scraped Content */}
              {researchDetails?.scraped_content && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Scraped Content</h3>
                  <div className="space-y-4">
                    {Object.entries(
                      researchDetails.scraped_content as Record<
                        string,
                        ScrapedContent
                      >
                    ).map(
                      (
                        [url, data]: [string, ScrapedContent],
                        index: number
                      ) => (
                        <div
                          key={index}
                          className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {new URL(url).hostname}
                            </a>
                            <span className="text-xs text-gray-500">
                              {new Date(data.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <pre className="text-sm text-gray-600 whitespace-pre-wrap mt-2">
                            {data.content}
                          </pre>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Research Timeline */}
              {researchDetails?.analysis_steps && (
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Research Timeline
                  </h3>
                  <div className="space-y-4">
                    {researchDetails.analysis_steps.map((step, index) => (
                      <div key={index} className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-24 text-xs text-gray-500">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="flex-grow">
                          <h4 className="text-sm font-medium text-gray-900">
                            {step.stage}
                          </h4>
                          <p className="mt-1 text-sm text-gray-600">
                            {step.description}
                          </p>
                          {step.outcome && (
                            <p className="mt-1 text-sm text-blue-600">
                              {step.outcome}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Analysis */}
              <div>
                <h3 className="text-lg font-medium mb-4">Source Analysis</h3>
                <div className="space-y-4">
                  {result.sources.map((source, index) => {
                    const metrics =
                      researchDetails?.source_metrics?.[source.url];
                    return (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {source.title}
                          </a>
                          <span className="text-sm text-gray-500">
                            Reliability: {metrics?.reliability || "N/A"}%
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                          {source.content}
                        </p>
                        {metrics && (
                          <div className="mt-2 text-xs text-gray-500">
                            <span>
                              Content length: {metrics.content_length}{" "}
                              characters
                            </span>
                            <span className="mx-2">•</span>
                            <span>
                              Retrieved:{" "}
                              {new Date(
                                metrics.scrape_time
                              ).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add custom scrollbar styles */}
      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #666;
          }
        `}
      </style>
    </div>
  );
};