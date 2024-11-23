import React from "react";

interface SearchSettings {
  maxAttempts: number;
  maxResults: number;
  timeRange: "none" | "d" | "w" | "m" | "y";
  searchMode: "research" | "search";
  shuffleResults: boolean;
  adaptiveSearch: boolean;
  improveResults: boolean;
  allowRetry: boolean;
}

interface SettingsPanelProps {
  settings: SearchSettings;
  onSettingsChange: (settings: SearchSettings) => void;
  onReset: () => void;
}

const timeRangeOptions = [
  {
    value: "none",
    label: "Any Time",
    description: "No time limit on search results",
  },
  {
    value: "d",
    label: "Past 24 Hours",
    description: "Only results from the last day",
  },
  {
    value: "w",
    label: "Past Week",
    description: "Results from the last 7 days",
  },
  {
    value: "m",
    label: "Past Month",
    description: "Results from the last 30 days",
  },
  { value: "y", label: "Past Year", description: "Results from the last year" },
];

const searchModes = [
  {
    value: "research",
    label: "Research Mode",
    description: "Comprehensive research with multiple sources",
    features: [
      "Multiple search iterations",
      "Source verification",
      "Content analysis",
      "Strategic focus areas",
    ],
  },
  {
    value: "search",
    label: "Basic Search",
    description: "Quick, direct search for immediate answers",
    features: [
      "Single search pass",
      "Direct results",
      "Faster response",
      "Simple summaries",
    ],
  },
];

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
  features?: string[];
}

const Toggle: React.FC<ToggleProps> = ({
  enabled,
  onChange,
  label,
  description,
  features,
}) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-100 group relative">
    <div className="flex-1">
      <h3 className="text-sm font-medium text-gray-900">{label}</h3>
      <p className="text-sm text-gray-500">{description}</p>
      {features && (
        <div className="hidden group-hover:block absolute z-50 left-0 mt-2 w-64 p-4 bg-white rounded-lg shadow-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Features:</h4>
          <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">
            {features.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
    <button
      type="button"
      className={`${
        enabled ? "bg-indigo-600" : "bg-gray-200"
      } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
      onClick={() => onChange(!enabled)}
    >
      <span
        className={`${
          enabled ? "translate-x-5" : "translate-x-0"
        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
      />
    </button>
  </div>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
  onReset,
}) => {
  const updateSetting = <K extends keyof SearchSettings>(
    key: K,
    value: SearchSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-lg border-l border-gray-200 overflow-y-auto z-50">
      <div className="px-4 py-5">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium text-gray-900">
            Research Settings
          </h2>
          <button
            onClick={onReset}
            className="text-sm text-indigo-600 hover:text-indigo-900"
          >
            Reset to Defaults
          </button>
        </div>

        <div className="space-y-6">
          {/* Search Mode */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              Search Mode
            </h3>
            <div className="space-y-4">
              {searchModes.map((mode) => (
                <div
                  key={mode.value}
                  className={`p-3 rounded-lg border-2 cursor-pointer ${
                    settings.searchMode === mode.value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() =>
                    updateSetting(
                      "searchMode",
                      mode.value as "research" | "search"
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">
                      {mode.label}
                    </h4>
                    {settings.searchMode === mode.value && (
                      <span className="text-indigo-600">✓</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {mode.description}
                  </p>
                  <ul className="mt-2 text-xs text-gray-600 list-disc pl-4 space-y-1">
                    {mode.features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Search Parameters */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              Search Parameters
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Time Range
                </label>
                <select
                  value={settings.timeRange}
                  onChange={(e) =>
                    updateSetting(
                      "timeRange",
                      e.target.value as "none" | "d" | "w" | "m" | "y"
                    )
                  }
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {timeRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {
                    timeRangeOptions.find((o) => o.value === settings.timeRange)
                      ?.description
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Max Attempts
                  <span className="ml-1 text-xs text-gray-500">(1-10)</span>
                </label>
                <input
                  type="number"
                  value={settings.maxAttempts}
                  onChange={(e) =>
                    updateSetting(
                      "maxAttempts",
                      Math.min(10, Math.max(1, parseInt(e.target.value) || 1))
                    )
                  }
                  min="1"
                  max="10"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum number of search iterations
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Max Results
                  <span className="ml-1 text-xs text-gray-500">(1-50)</span>
                </label>
                <input
                  type="number"
                  value={settings.maxResults}
                  onChange={(e) =>
                    updateSetting(
                      "maxResults",
                      Math.min(50, Math.max(1, parseInt(e.target.value) || 1))
                    )
                  }
                  min="1"
                  max="50"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Maximum number of results per search
                </p>
              </div>
            </div>
          </div>

          {/* Advanced Options */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              Advanced Options
            </h3>
            <Toggle
              enabled={settings.shuffleResults}
              onChange={(value) => updateSetting("shuffleResults", value)}
              label="Shuffle Results"
              description="Randomize result selection"
              features={[
                "Diverse source selection",
                "Reduced source bias",
                "Better coverage",
              ]}
            />
            <Toggle
              enabled={settings.adaptiveSearch}
              onChange={(value) => updateSetting("adaptiveSearch", value)}
              label="Adaptive Search"
              description="Dynamic search optimization"
              features={[
                "Auto-adjust parameters",
                "Learn from results",
                "Improve accuracy",
              ]}
            />
            <Toggle
              enabled={settings.improveResults}
              onChange={(value) => updateSetting("improveResults", value)}
              label="Improve Results"
              description="AI-enhanced results"
              features={[
                "Better summaries",
                "Relevant filtering",
                "Quality scoring",
              ]}
            />
            <Toggle
              enabled={settings.allowRetry}
              onChange={(value) => updateSetting("allowRetry", value)}
              label="Auto-Retry"
              description="Retry failed searches"
              features={[
                "Automatic retries",
                "Error recovery",
                "Improved reliability",
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
