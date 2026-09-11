import { Finding, OverallScoreSummary } from '../shared/types/qa';
import { WebsiteDiscoveryMap } from '../shared/types/discovery';

export type ReportFormat = 'HTML' | 'JSON' | 'MARKDOWN' | 'PDF';

export type QualityRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_IMPROVEMENT' | 'CRITICAL';

export interface ReportMetadata {
  reportId: string;
  sessionId: string;
  url: string;
  title: string;
  timestamp: number;
  formattedDate: string;
  durationMs: number;
  engineVersion: string;
}

export interface ExecutiveSummary {
  overallScore: number;
  rating: QualityRating;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  testsExecuted: number;
  pagesScanned: number;
  elementsScanned: number;
}

export interface FlowFrictionPoint {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  area: 'HERO_CTA' | 'NAVIGATION' | 'FORMS' | 'CONVERSION' | 'CONTENT_HIERARCHY';
  title: string;
  description: string;
  elementSelector?: string;
}

export interface FlowRecommendation {
  id: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  currentFlowIssue: string;
  suggestedImprovement: string;
  expectedImpact: string;
}

export interface WebsiteFlowAnalysis {
  pageIntent: string;
  flowScore: number; // 0 to 100
  flowRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'NEEDS_OPTIMIZATION' | 'CRITICAL_FRICTION';
  summary: string;
  strengths: string[];
  frictionPoints: FlowFrictionPoint[];
  recommendations: FlowRecommendation[];
  evaluatedBy: string;
}

export interface QAReportData {
  metadata: ReportMetadata;
  summary: ExecutiveSummary;
  scores: OverallScoreSummary;
  findings: Finding[];
  discoveryMap?: WebsiteDiscoveryMap | null;
  flowAnalysis?: WebsiteFlowAnalysis | null;
}

