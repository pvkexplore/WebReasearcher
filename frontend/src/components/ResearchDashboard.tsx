import React, { useState, useEffect, useRef } from "react";
import {
  ResearchDashboardProps,
  ResearchDetails,
  LLMInteraction,
  ScrapedContent,
} from "../types";

import ReactMarkdown from "react-markdown";
import KnowledgeGraph from "./KnowledgeGraph"; // Fixed import

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
  onPause,
  onResume,
  onAssess,
  messages,
}) => {
  // Helper function to get stage display name
  const getStageDisplayName = (stage: string): string => {
    const stageMap: { [key: string]: string } = {
      search_start: "Starting Search",
      query_formulation: "Formulating Query",
      web_search: "Searching Web",
      page_selection: "Selecting Pages",
      content_scraping: "Extracting Content",
      content_analysis: "Analyzing Content",
      content_evaluation: "Evaluating Results",
      answer_generation: "Generating Answer",
    };
    return stageMap[stage] || stage;
  };

  // Helper function to get stage description
  const getStageDescription = (stage: string): string => {
    const descriptionMap: { [key: string]: string } = {
      search_start: "Initializing search process",
      query_formulation: "Creating optimized search query",
      web_search: "Searching for relevant information",
      page_selection: "Identifying most relevant sources",
      content_scraping: "Retrieving content from selected sources",
      content_analysis: "Analyzing content quality and relevance",
      content_evaluation: "Evaluating information completeness",
      answer_generation: "Synthesizing final answer",
    };
    return descriptionMap[stage] || stage;
  };

  // ... (rest of the code remains the same until Research Trail section)
  const [activeTab, setActiveTab] = useState<"progress" | "results">(
    hasResult ? "results" : "progress"
  );

  const [resultTab, setResultTab] = useState<
    "summary" | "analysis" | "sources" | "details" | "knowledge"
  >("summary");

  const researchTrailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (researchTrailRef.current) {
      researchTrailRef.current.scrollTop =
        researchTrailRef.current.scrollHeight;
    }
  }, [researchDetails?.analysis_steps]);

  const extractKeyFindings = (content: string): string[] => {
    const findings: string[] = [];
    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);

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

  const showProgressStage = !hasResult || activeTab === "progress";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      {/* Tab Navigation */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-4">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium ${
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
              className={`px-4 py-2 rounded-md text-sm font-medium ${
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
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h3 className="text-sm font-medium text-blue-800">
                Current Stage
              </h3>
              <div className="mt-2 flex items-center">
                {!hasResult && (
                  <div className="animate-pulse h-2 w-2 rounded-full bg-blue-500 mr-2" />
                )}
                <p className="text-base font-semibold text-blue-900">
                  {hasResult
                    ? "Completed"
                    : getStageDisplayName(stage || "Initializing")}
                </p>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <h3 className="text-sm font-medium text-green-800">
                Sources Analyzed
              </h3>
              <p className="mt-2 text-base font-semibold text-green-900">
                {sourcesAnalyzed}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
              <h3 className="text-sm font-medium text-purple-800">
                Confidence
              </h3>
              <p className="mt-2 text-base font-semibold text-purple-900">
                {confidenceScore}%
              </p>
            </div>
          </div>

          {/* Current Focus */}
          {currentFocus && showProgressStage && (
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
              <h3 className="text-sm font-medium text-indigo-800">
                Current Focus
              </h3>
              <p className="text-base font-semibold text-indigo-900 mt-2">
                {currentFocus.area}
              </p>
              <div className="mt-2 flex items-center">
                <span className="text-sm text-indigo-600">Priority:</span>
                <span className="ml-2 px-2 py-1 bg-indigo-100 rounded text-sm text-indigo-800">
                  {currentFocus.priority}
                </span>
              </div>
            </div>
          )}

          {/* Research Trail */}
          {researchDetails?.analysis_steps && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-800 mb-4">
                Research Progress
              </h3>
              <div
                ref={researchTrailRef}
                className="space-y-4 max-h-96 overflow-y-auto pr-4 custom-scrollbar"
              >
                {researchDetails.analysis_steps.map((step, index) => (
                  <div key={index} className="border-l-2 border-blue-500 pl-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {getStageDisplayName(step.stage)}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {getStageDescription(step.stage)}
                        </p>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      {step.description}
                    </p>
                    {step.outcome && (
                      <p className="mt-2 text-sm text-blue-600">
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
                        className="border-l-2 border-green-500 pl-4"
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
                          <span className="text-sm text-gray-500">
                            {metrics?.reliability
                              ? `${metrics.reliability}% reliable`
                              : "Analyzing..."}
                          </span>
                        </div>
                        {metrics?.content_length && (
                          <p className="mt-2 text-sm text-gray-500">
                            Length: {metrics.content_length} chars
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
                "knowledge",
              ] as const
            ).map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 text-sm font-medium ${
                  resultTab === tab
                    ? "border-b-2 border-indigo-500 text-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
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
                <h3 className="text-lg font-medium mb-4">Research Summary</h3>
                <ReactMarkdown>{result.summary}</ReactMarkdown>
              </div>
              <div>
                <h4 className="text-lg font-medium mb-4">Key Findings</h4>
                <ul className="space-y-3">
                  {(result.keyFindings.length > 0
                    ? result.keyFindings
                    : extractKeyFindings(result.summary)
                  ).map((finding, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-base text-green-500 mr-2">✓</span>
                      <ReactMarkdown className="text-base text-gray-600">
                        {finding}
                      </ReactMarkdown>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Knowledge Graph Tab */}
          {resultTab === "knowledge" && researchDetails?.knowledge_graph && (
            <div className="h-[600px] w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <KnowledgeGraph data={researchDetails.knowledge_graph} />
            </div>
          )}

          {/* Analysis Tab */}
          {resultTab === "analysis" && (
            <div className="space-y-6">
              {researchDetails?.analysis_steps?.map((step, index) => (
                <div key={index} className="border-l-2 border-indigo-500 pl-4">
                  <div className="flex justify-between items-start">
                    <h4 className="text-base font-medium text-indigo-900">
                      {step.stage}
                    </h4>
                    <span className="text-sm text-gray-500">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <ReactMarkdown className="mt-2 text-base text-gray-600">
                    {step.description}
                  </ReactMarkdown>
                  {step.outcome && (
                    <ReactMarkdown className="mt-2 text-base text-indigo-600">
                      {step.outcome}
                    </ReactMarkdown>
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
                        className="text-base text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {source.title}
                      </a>
                      <span className="text-sm text-gray-500">
                        Reliability: {metrics?.reliability || "N/A"}%
                      </span>
                    </div>
                    <ReactMarkdown className="mt-3 text-base text-gray-600">
                      {source.content}
                    </ReactMarkdown>
                    {metrics && (
                      <div className="mt-2 text-sm text-gray-500">
                        <span>Length: {metrics.content_length} chars</span>
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

          {/* Details Tab */}
          {resultTab === "details" && (
            <div className="space-y-6">
              {/* LLM Interactions */}
              {researchDetails?.llm_interactions && (
                <div>
                  <h3 className="text-lg font-medium mb-4">LLM Decisions</h3>
                  <div className="space-y-4">
                    {researchDetails.llm_interactions.map(
                      (interaction, index) => (
                        <div
                          key={index}
                          className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-base font-medium text-gray-900">
                              {interaction.stage}
                            </h4>
                            <span className="text-sm text-gray-500">
                              {new Date(
                                interaction.timestamp
                              ).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="bg-blue-50 p-3 rounded-md">
                              <h5 className="text-sm font-medium text-blue-800 mb-1">
                                Prompt:
                              </h5>
                              <ReactMarkdown className="text-sm text-blue-700 whitespace-pre-wrap">
                                {interaction.prompt}
                              </ReactMarkdown>
                            </div>
                            <div className="bg-green-50 p-3 rounded-md">
                              <h5 className="text-sm font-medium text-green-800 mb-1">
                                Response:
                              </h5>
                              <ReactMarkdown className="text-sm text-green-700 whitespace-pre-wrap">
                                {interaction.response}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Analysis Steps with URLs and Scraped Content */}
              {researchDetails?.analysis_steps && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Research Steps</h3>
                  <div className="space-y-4">
                    {researchDetails.analysis_steps.map((step, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-base font-medium text-gray-900">
                            {step.stage}
                          </h4>
                          <span className="text-sm text-gray-500">
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {step.description}
                        </p>
                        {step.outcome && (
                          <p className="text-sm text-blue-600 mb-2">
                            {step.outcome}
                          </p>
                        )}

                        {/* URLs accessed during this step */}
                        {researchDetails.urls_accessed.length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-sm font-medium text-gray-800 mb-2">
                              Sources:
                            </h5>
                            <div className="space-y-2">
                              {researchDetails.urls_accessed.map(
                                (url, urlIndex) => {
                                  const metrics =
                                    researchDetails.source_metrics?.[url];
                                  const isSuccessful =
                                    researchDetails.successful_urls.includes(
                                      url
                                    );
                                  const isFailed =
                                    researchDetails.failed_urls.includes(url);

                                  return (
                                    <div
                                      key={urlIndex}
                                      className={`flex items-center justify-between p-2 rounded ${
                                        isSuccessful
                                          ? "bg-green-50"
                                          : isFailed
                                          ? "bg-red-50"
                                          : "bg-gray-100"
                                      }`}
                                    >
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                      >
                                        {new URL(url).hostname}
                                      </a>
                                      {metrics && (
                                        <span className="text-sm text-gray-500">
                                          {metrics.reliability}% reliable •{" "}
                                          {metrics.content_length} chars
                                        </span>
                                      )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}

                        {/* Scraped content for this step */}
                        {researchDetails.scraped_content &&
                          Object.entries(researchDetails.scraped_content)
                            .length > 0 && (
                            <div className="mt-3">
                              <h5 className="text-sm font-medium text-gray-800 mb-2">
                                Scraped Content:
                              </h5>
                              <div className="space-y-2">
                                {Object.entries(
                                  researchDetails.scraped_content
                                ).map(([url, data], scrapeIndex) => (
                                  <div
                                    key={scrapeIndex}
                                    className="bg-white rounded-md p-3 border border-gray-200"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                      >
                                        {new URL(url).hostname}
                                      </a>
                                      <span className="text-sm text-gray-500">
                                        {new Date(
                                          data.timestamp
                                        ).toLocaleTimeString()}
                                      </span>
                                    </div>
                                    <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded">
                                      {data.content}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Research Document */}
              <div className="prose max-w-none">
                <h3 className="text-lg font-medium mb-4">Research Document</h3>
                <ReactMarkdown className="text-base text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 border border-gray-200">
                  {documentContent || result.summary}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress View remains the same */}
      {/* ... */}

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
