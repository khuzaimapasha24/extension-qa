import { AgentState } from './agent';
import { QACategory } from './qa';

export interface SupabaseConfig {
  enabled: boolean;
  url: string;
  anonKey: string;
  storageBucket?: string;
  shareableUrlPrefix?: string;
}

export type LLMProvider = 'auto' | 'gemini' | 'openai' | 'anthropic' | 'local_webgpu';

export interface AIConfig {
  provider: LLMProvider;
  geminiApiKey?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
}

export interface AdvancedQAConfig {
  businessLogicVerification: boolean;
  virtualMailboxEnabled: boolean;
  chaosTestingEnabled: boolean;
  backendVerificationEnabled: boolean;
}

export interface SessionConfig {
  crawlDepth: number;
  maxPages: number;
  privacyMode: boolean;
  requireApprovalForHighRisk: boolean;
  enabledCategories: QACategory[];
  viewportWidth?: number;
  viewportHeight?: number;
  supabase?: SupabaseConfig;
  ai?: AIConfig;
  advanced?: AdvancedQAConfig;
}

export interface SessionStats {
  pagesDiscovered: number;
  pagesCrawled: number;
  elementsDiscovered: number;
  testsExecuted: number;
  passedCount: number;
  failedCount: number;
  warningsCount: number;
  criticalBugsCount: number;
}

export interface QASession {
  id: string;
  tabId: number;
  url: string;
  origin: string;
  title: string;
  state: AgentState;
  startTime: number;
  endTime?: number;
  progress: number; // 0 to 100
  currentAction: string;
  stats: SessionStats;
  config: SessionConfig;
  error?: string;
  jarvisVision?: import('./agent').JarvisVisionState;
  liveTransactions?: import('../../content/injected-interceptor').HttpTransaction[];
}
