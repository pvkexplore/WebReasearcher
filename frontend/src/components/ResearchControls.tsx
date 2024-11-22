import React from "react";
import { LoadingSpinner } from "./LoadingSpinner";

interface ResearchControlsProps {
  status: string;
  onPause: () => void;
  onResume: () => void;
  onAssess: () => void;
  isAssessing?: boolean;
  assessmentResult?: {
    assessment: "sufficient" | "insufficient";
    reason: string;
  };
}

export const ResearchControls: React.FC<ResearchControlsProps> = ({
  status,
  onPause,
  onResume,
  onAssess,
  isAssessing = false,
  assessmentResult,
}) => {
  const isPaused = status === "paused";
  const isRunning = status === "running" || status === "starting";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Research Controls</h3>
        <div className="flex items-center space-x-4">
          {isRunning && (
            <button
              onClick={onPause}
              className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200"
            >
              Pause Research
            </button>
          )}
          {isPaused && (
            <button
              onClick={onResume}
              className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200"
            >
              Resume Research
            </button>
          )}
          <button
            onClick={onAssess}
            disabled={isAssessing}
            className={`px-3 py-1 text-sm ${
              isAssessing
                ? "bg-gray-100 text-gray-500"
                : "bg-blue-100 text-blue-800 hover:bg-blue-200"
            } rounded-md`}
          >
            {isAssessing ? (
              <div className="flex items-center">
                <LoadingSpinner />
                <span className="ml-2">Assessing...</span>
              </div>
            ) : (
              "Assess Progress"
            )}
          </button>
        </div>
      </div>

      {assessmentResult && (
        <div
          className={`mt-4 p-4 rounded-md ${
            assessmentResult.assessment === "sufficient"
              ? "bg-green-50 text-green-800"
              : "bg-yellow-50 text-yellow-800"
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {assessmentResult.assessment === "sufficient" ? (
                <svg
                  className="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium">
                Research is {assessmentResult.assessment}
              </h3>
              <div className="mt-2 text-sm">
                <p>{assessmentResult.reason}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                isRunning
                  ? "bg-green-400"
                  : isPaused
                  ? "bg-yellow-400"
                  : "bg-gray-400"
              }`}
            ></span>
          </div>
          <p className="ml-2 text-sm text-gray-500">
            Status: {status.charAt(0).toUpperCase() + status.slice(1)}
          </p>
        </div>
      </div>
    </div>
  );
};
