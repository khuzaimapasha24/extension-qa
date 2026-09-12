import { QASession } from './session';
import { Finding } from './qa';

export interface ProjectRecord {
  id: string;
  origin: string;
  name: string;
  firstSeen: number;
  lastTested: number;
  totalSessions: number;
  latestScore?: number;
}

export interface LogRecord {
  id: string;
  sessionId: string;
  timestamp: number;
  module: string;
  event: string;
  status: 'info' | 'warn' | 'error' | 'success';
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface ReportRecord {
  id: string;
  sessionId: string;
  title: string;
  createdAt: number;
  overallScore: number;
  htmlContent?: string;
  jsonData?: Record<string, unknown>;
  markdownData?: string;
}

export interface SettingRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
}

export interface LearnedWorkflowRecord {
  id: string; // origin + '#' + path
  origin: string;
  url: string;
  path: string;
  title: string;
  learnedSelectors: Record<string, {
    primary: string;
    fallbacks: string[];
    role: string;
    successCount: number;
  }>;
  formPresets: Record<string, Record<string, string>>;
  actionSteps: Array<{
    type: import('./agent').TestTaskType | 'CLICK' | 'FILL' | 'SUBMIT';
    selector: string;
    value?: string;
    label?: string;
  }>;
  executionCount: number;
  autonomousSuccessCount: number;
  lastVerified: number;
  selfRelianceRatio: number;
}

export interface DatabaseSchema {
  sessions: QASession;
  findings: Finding;
  projects: ProjectRecord;
  logs: LogRecord;
  reports: ReportRecord;
  settings: SettingRecord;
  page_snapshots: import('./discovery').PageSnapshot;
  discovery_maps: import('./discovery').WebsiteDiscoveryMap;
  learned_workflows: LearnedWorkflowRecord;
}
