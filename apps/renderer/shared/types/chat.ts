import { PROVIDER_IDS } from '../../../shared/provider-ids';

export enum Role {
  User = 'user',
  Model = 'model',
}

export type Citation = {
  sourceKind: 'local' | 'remote' | 'web';
  snippet: string;
  score?: number;
  sourcePath?: string;
  remoteProvider?: 'openai-vector-store';
  documentId?: string;
  documentName?: string;
  chunkId?: string;
  chunkIndex?: number;
  url?: string;
  title?: string;
};

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  timeLabel?: string;
  isError?: boolean;
  reasoning?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    argumentsText: string;
    source?: 'custom' | 'native';
    provider?: ProviderId;
  }>;
  toolResults?: Array<{
    id: string;
    name: string;
    outputText: string;
    isError?: boolean;
    source?: 'custom' | 'native';
    provider?: ProviderId;
  }>;
  citations?: Citation[];
}

export interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
}

export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  provider: ProviderId;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export type TavilySearchDepth = 'basic' | 'advanced' | 'fast' | 'ultra-fast';
export type TavilyTopic = 'general' | 'news' | 'finance';
export type SearchEngine = 'tavily' | 'exa' | 'searxng';
export type ExaSearchType = 'auto' | 'fast' | 'neural' | 'deep';
export type SearXNGTimeRange = 'day' | 'month' | 'year';
export type SearXNGSafeSearch = 0 | 1 | 2;
export type GeminiEmbeddingTaskType =
  | 'SEMANTIC_SIMILARITY'
  | 'CLASSIFICATION'
  | 'CLUSTERING'
  | 'RETRIEVAL_DOCUMENT'
  | 'RETRIEVAL_QUERY'
  | 'QUESTION_ANSWERING'
  | 'FACT_VERIFICATION';

export interface TavilyConfig {
  engine?: SearchEngine;
  apiKey?: string;
  projectId?: string;
  searchDepth?: TavilySearchDepth;
  maxResults?: number;
  topic?: TavilyTopic;
  includeAnswer?: boolean;
  exaSearchType?: ExaSearchType;
  searxngBaseUrl?: string;
  searxngCategories?: string;
  searxngLanguage?: string;
  searxngTimeRange?: SearXNGTimeRange;
  searxngSafeSearch?: SearXNGSafeSearch;
}

export interface GeminiEmbeddingConfig {
  model?: string;
  outputDimensionality?: number;
  taskType?: GeminiEmbeddingTaskType;
  title?: string;
}

export interface ProviderError {
  provider: ProviderId;
  message: string;
  cause?: unknown;
}
