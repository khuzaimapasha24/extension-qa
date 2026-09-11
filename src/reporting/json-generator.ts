import { QAReportData } from './report-types';

/**
 * Generates a clean, schema-valid JSON report suitable for CI/CD pipelines,
 * automated testing dashboards, and machine processing.
 */
export function generateJsonReport(data: QAReportData): string {
  const exportPayload = {
    $schema: 'https://ai-website-qa-agent.internal/schemas/v1/qa-report.json',
    generator: {
      name: 'AI Website QA Agent',
      version: data.metadata.engineVersion,
      generatedAt: new Date(data.metadata.timestamp).toISOString(),
    },
    target: {
      url: data.metadata.url,
      title: data.metadata.title,
    },
    executiveSummary: {
      overallScore: data.summary.overallScore,
      rating: data.summary.rating,
      testsExecuted: data.summary.testsExecuted,
      pagesScanned: data.summary.pagesScanned,
      elementsScanned: data.summary.elementsScanned,
      findingsBreakdown: {
        total: data.summary.totalFindings,
        critical: data.summary.criticalCount,
        high: data.summary.highCount,
        medium: data.summary.mediumCount,
        low: data.summary.lowCount,
        info: data.summary.infoCount,
      },
      categoryScores: Object.entries(data.scores.categoryScores).reduce(
        (acc, [cat, val]) => ({
          ...acc,
          [cat]: {
            score: val.score,
            weight: val.weight,
            passed: val.passedCount,
            failed: val.failedCount,
            warnings: val.warningsCount,
          },
        }),
        {}
      ),
    },
    findings: data.findings.map((f) => ({
      id: f.id,
      category: f.category,
      severity: f.severity,
      status: f.status,
      title: f.title,
      description: f.description,
      page: f.page,
      selector: f.selector,
      stepsToReproduce: f.steps,
      expectedOutcome: f.expected,
      actualOutcome: f.actual,
      recommendation: f.recommendation,
      retestCount: f.retestCount,
      retestPassed: f.retestPassed,
      evidenceSummary: {
        hasScreenshot: f.evidence.some((e) => e.type === 'screenshot'),
        hasDomSnippet: f.evidence.some((e) => e.type === 'dom_snippet'),
        hasConsoleError: f.evidence.some((e) => e.type === 'console_error'),
        hasNetworkError: f.evidence.some((e) => e.type === 'network_error'),
        totalEvidenceItems: f.evidence.length,
      },
      timestamp: new Date(
        (f as any).timestamp || f.evidence[0]?.timestamp || data.metadata.timestamp || Date.now()
      ).toISOString(),
    })),
    discovery: data.discoveryMap
      ? {
          totalDiscoveredPages: data.discoveryMap.totalDiscoveredPages,
          pages: data.discoveryMap.pages.map((p) => ({
            url: p.url,
            pathname: p.pathname,
            title: p.title,
            interactiveElements: p.totalInteractiveCount,
          })),
        }
      : undefined,
    flowAnalysis: data.flowAnalysis || undefined,
  };

  return JSON.stringify(exportPayload, null, 2);
}
