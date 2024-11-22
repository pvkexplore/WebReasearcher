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
  { value: "none", label: "Any Time" },
  { value: "d", label: "Past 24 Hours" },
  { value: "w", label: "Past Week" },
  { value: "m", label: "Past Month" },
  { value: "y", label: "Past Year" },
];

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}

const Toggle: React.FC<ToggleProps> = ({
  enabled,
  onChange,
  label,
  description,
}) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-100">
    <div className="flex-1">
      <h3 className="text-sm font-medium text-gray-900">{label}</h3>
      <p className="text-sm text-gray-500">{description}</p>
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="px-4 py-5 sm:p-6">
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
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Search Mode
              </label>
              <select
                value={settings.searchMode}
                onChange={(e) =>
                  updateSetting(
                    "searchMode",
                    e.target.value as "research" | "search"
                  )
                }
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="research">Research</option>
                <option value="search">Basic Search</option>
              </select>
            </div>

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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Max Attempts
              </label>
              <input
                type="number"
                value={settings.maxAttempts}
                onChange={(e) =>
                  updateSetting("maxAttempts", parseInt(e.target.value) || 1)
                }
                min="1"
                max="10"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Max Results
              </label>
              <input
                type="number"
                value={settings.maxResults}
                onChange={(e) =>
                  updateSetting("maxResults", parseInt(e.target.value) || 1)
                }
                min="1"
                max="50"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <Toggle
              enabled={settings.shuffleResults}
              onChange={(value) => updateSetting("shuffleResults", value)}
              label="Shuffle results"
              description="Randomly select results from the search pool"
            />
            <Toggle
              enabled={settings.adaptiveSearch}
              onChange={(value) => updateSetting("adaptiveSearch", value)}
              label="Adaptive search"
              description="Automatically adjust search parameters based on results"
            />
            <Toggle
              enabled={settings.improveResults}
              onChange={(value) => updateSetting("improveResults", value)}
              label="Improve results"
              description="Use AI to enhance search results quality"
            />
            <Toggle
              enabled={settings.allowRetry}
              onChange={(value) => updateSetting("allowRetry", value)}
              label="Allow retry"
              description="Automatically retry failed searches"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
