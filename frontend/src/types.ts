export interface SearchSettings {
  maxAttempts: number;
  maxResults: number;
  timeRange: "none" | "d" | "w" | "m" | "y";
  searchMode: "research" | "search";
  shuffleResults: boolean;
  adaptiveSearch: boolean;
  improveResults: boolean;
  allowRetry: boolean;
}

export interface Message {
  type: string;
  message: string;
  timestamp: string;
  data?: any;
}

export interface ResearchSession {
  sessionId: string;
  status: string;
  query: string;
  messages: Message[];
  settings: SearchSettings;
}
