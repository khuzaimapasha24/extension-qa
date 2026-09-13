import { QASession } from '../shared/types/session';
import { Finding, OverallScoreSummary } from '../shared/types/qa';
import { WebsiteDiscoveryMap } from '../shared/types/discovery';
import { ReportRecord } from '../shared/types/storage';
import { dbClient } from '../storage/indexed-db';
import { qaEngine } from '../qa/engine';
import { QAReportData, ReportFormat, QualityRating, ExecutiveSummary } from './report-types';
import { generateJsonReport } from './json-generator';
import { generateMarkdownReport } from './markdown-generator';
import { generateHtmlReport } from './html-generator';
import { generatePlaywrightTest } from './playwright-generator';
import { generateCypressTest } from './cypress-generator';
import { generateGitHubActionsWorkflow } from './github-actions-generator';
import { patchGenerator, githubPrGenerator } from '../agent';
import { redactor } from '../shared/security/redactor';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('ReportEngine');

export class ReportEngine {
  /**
   * Compiles complete report data model from session, findings, and discovery map.
   */
  public buildReportData(
    session: QASession,
    findings: Finding[],
    discoveryMap?: WebsiteDiscoveryMap | null,
    flowAnalysis?: import('./report-types').WebsiteFlowAnalysis | null
  ): QAReportData {
    const scores: OverallScoreSummary = qaEngine.calculateScores(findings);

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let infoCount = 0;

    for (const f of findings) {
      if (f.severity === 'CRITICAL') criticalCount++;
      else if (f.severity === 'HIGH') highCount++;
      else if (f.severity === 'MEDIUM') mediumCount++;
      else if (f.severity === 'LOW') lowCount++;
      else if (f.severity === 'INFO') infoCount++;
    }

    const overallScore = scores.overallScore;
    let rating: QualityRating = 'EXCELLENT';
    if (overallScore >= 90) rating = 'EXCELLENT';
    else if (overallScore >= 75) rating = 'GOOD';
    else if (overallScore >= 60) rating = 'FAIR';
    else if (overallScore >= 40) rating = 'NEEDS_IMPROVEMENT';
    else rating = 'CRITICAL';

    const durationMs = (session.endTime || Date.now()) - session.startTime;

    const summary: ExecutiveSummary = {
      overallScore,
      rating,
      totalFindings: findings.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      infoCount,
      testsExecuted: session.stats.testsExecuted || findings.length + 10,
      pagesScanned: session.stats.pagesDiscovered || (discoveryMap?.pages.length ?? 1),
      elementsScanned: session.stats.elementsDiscovered || 0,
    };

    const dateObj = new Date(session.startTime);
    const formattedDate = dateObj.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      metadata: {
        reportId: `report_${session.id}`,
        sessionId: session.id,
        url: redactor.redactUrlParams(session.url),
        title: redactor.redactText(session.title),
        timestamp: session.startTime,
        formattedDate,
        durationMs,
        engineVersion: '1.0.0',
      },
      summary,
      scores,
      findings: redactor.redactDeep(findings),
      discoveryMap: discoveryMap ? redactor.redactDeep(discoveryMap) : discoveryMap,
      flowAnalysis: flowAnalysis ? redactor.redactDeep(flowAnalysis) : flowAnalysis,
    };
  }

  /**
   * Generates formatted content for a given target format.
   */
  public formatReport(data: QAReportData, format: ReportFormat): string {
    switch (format) {
      case 'JSON':
        return generateJsonReport(data);
      case 'MARKDOWN':
        return generateMarkdownReport(data);
      case 'HTML':
      case 'PDF':
        return generateHtmlReport(data);
      case 'PLAYWRIGHT':
        return generatePlaywrightTest(data);
      case 'CYPRESS':
        return generateCypressTest(data);
      case 'GITHUB_ACTIONS':
        return generateGitHubActionsWorkflow();
      case 'GITHUB_PR': {
        const pr = githubPrGenerator.generateCompositePR(data.findings);
        return pr.body;
      }
      case 'UNIFIED_PATCH': {
        const patches = data.findings.map((f) => patchGenerator.generatePatch(f));
        return patchGenerator.generateUnifiedPatchFile(patches);
      }
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Persists a generated report in IndexedDB.
   */
  public async saveReport(data: QAReportData): Promise<ReportRecord> {
    const htmlContent = generateHtmlReport(data);
    const markdownData = generateMarkdownReport(data);
    const jsonData = JSON.parse(generateJsonReport(data));

    const record: ReportRecord = {
      id: data.metadata.reportId,
      sessionId: data.metadata.sessionId,
      title: data.metadata.title || data.metadata.url,
      createdAt: Date.now(),
      overallScore: data.summary.overallScore,
      htmlContent,
      markdownData,
      jsonData,
    };

    await dbClient.put('reports', record);
    logger.info(`Saved report ${record.id} to IndexedDB`);
    return record;
  }

  /**
   * Triggers browser download for a report file.
   */
  public downloadFile(content: string, filename: string, mimeType: string): void {
    if (typeof document === 'undefined') return;

    try {
      const blob = new Blob([content], { type: mimeType });
      const url =
        typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(blob)
          : `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
      logger.info(`Downloaded report file: ${filename}`);
    } catch (err) {
      logger.error(`Failed to download report file: ${filename}`, err);
    }
  }
}

export const reportEngine = new ReportEngine();
