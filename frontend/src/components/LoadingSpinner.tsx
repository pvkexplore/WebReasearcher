import React from "react";

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center py-3">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
      <span className="ml-2 text-sm text-gray-500">Processing...</span>
    </div>
  );
};
