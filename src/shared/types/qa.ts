export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type FindingStatus =
  | 'PASS'
  | 'FAIL'
  | 'WARNING'
  | 'SKIPPED'
  | 'BLOCKED'
  | 'NEEDS_REVIEW';

export type QACategory =
  | 'FUNCTIONAL'
  | 'CONSOLE'
  | 'NETWORK'
  | 'RESPONSIVE'
  | 'ACCESSIBILITY'
  | 'SEO'
  | 'PERFORMANCE'
  | 'UX';

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotEvidence {
  dataUrl: string;
  width: number;
  height: number;
  cropRegion?: CropRegion;
  isElementCrop: boolean;
}

export interface ConsoleErrorEvidence {
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
}

export interface NetworkErrorEvidence {
  url: string;
  method: string;
  status: number;
  statusText?: string;
  type: string;
  duration?: number;
}

export interface DOMSnippetEvidence {
  selector: string;
  outerHTML: string;
  tagName: string;
  attributes: Record<string, string>;
}

export interface EvidenceItem {
  type: 'screenshot' | 'console_error' | 'network_error' | 'dom_snippet' | 'metric';
  description: string;
  data: string | number | Record<string, unknown> | ScreenshotEvidence | ConsoleErrorEvidence | NetworkErrorEvidence | DOMSnippetEvidence;
  timestamp: number;
}

export interface Finding {
  id: string;
  sessionId: string;
  category: QACategory;
  title: string;
  description: string;
  status: FindingStatus;
  severity: FindingSeverity;
  confidence: number; // 0.0 to 1.0
  page: string;
  element?: string;
  selector?: string;
  evidence: EvidenceItem[];
  steps: string[];
  expected: string;
  actual: string;
  recommendation: string;
  retestCount: number;
  retestPassed?: boolean;
  timestamp: number;
}

export interface CategoryScore {
  category: QACategory;
  score: number; // 0 to 100
  weight: number; // percentage
  testsCount: number;
  passedCount: number;
  failedCount: number;
  warningsCount: number;
}

export interface OverallScoreSummary {
  overallScore: number;
  categoryScores: Record<QACategory, CategoryScore>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
}
