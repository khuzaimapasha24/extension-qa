import { SessionConfig, SupabaseConfig, AIConfig } from '../types/session';
import { QACategory } from '../types/qa';

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  enabled: false,
  url: '',
  anonKey: '',
  storageBucket: 'qa-reports',
};

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'gemini',
  geminiApiKey: 'AQ.Ab8RN6I-NGmKhXNTc2PcMu2thqA-ZE0SxNgnc2LpE1HAcgLxbQ',
  geminiModel: 'gemini-3.6-flash',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-haiku-20241022',
};

export const DEFAULT_ADVANCED_CONFIG = {
  businessLogicVerification: true,
  virtualMailboxEnabled: true,
  chaosTestingEnabled: true,
  backendVerificationEnabled: false,
};

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  crawlDepth: 2,
  maxPages: 10,
  privacyMode: false,
  requireApprovalForHighRisk: true,
  enabledCategories: [
    'FUNCTIONAL',
    'CONSOLE',
    'NETWORK',
    'RESPONSIVE',
    'ACCESSIBILITY',
    'SEO',
    'PERFORMANCE',
    'UX',
  ],
  supabase: DEFAULT_SUPABASE_CONFIG,
  ai: DEFAULT_AI_CONFIG,
  advanced: DEFAULT_ADVANCED_CONFIG,
};

export const CATEGORY_WEIGHTS: Record<QACategory, number> = {
  FUNCTIONAL: 0.25,
  UX: 0.20,
  PERFORMANCE: 0.15,
  ACCESSIBILITY: 0.15,
  RESPONSIVE: 0.15,
  SEO: 0.10,
  CONSOLE: 0.0, // factored into Functional & Tech reliability
  NETWORK: 0.0, // factored into Functional & Tech reliability
};

export const DB_NAME = 'ai_qa_agent_db';
export const DB_VERSION = 2;
export const DEFAULT_MESSAGE_TIMEOUT_MS = 10000;
