import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildPageSnapshot } from '../../src/content/index';
import { WebsiteCrawler } from '../../src/qa/crawler';
import { QAEngine } from '../../src/qa/engine';
import { AgentPlanner } from '../../src/agent/planner';
import { AgentExecutor } from '../../src/agent/executor';
import { simulateClick } from '../../src/content/action-simulator';
import { AIReasoner } from '../../src/ai/ai-reasoner';
import { ReportEngine } from '../../src/reporting/report-engine';
import { generateJsonReport } from '../../src/reporting/json-generator';
import { generateMarkdownReport } from '../../src/reporting/markdown-generator';
import { generateHtmlReport } from '../../src/reporting/html-generator';
import { QASession } from '../../src/shared/types/session';
import { DEFAULT_SESSION_CONFIG } from '../../src/shared/constants/defaults';
import { ReasoningVerdict, TestTask } from '../../src/shared/types/agent';

describe('End-to-End Autonomous QA Agent Lifecycle', () => {
  let fixtureHtml: string;
  const mockOrigin = 'https://example.com';
  const mockUrl = 'https://example.com/store';
  const sessionId = 'e2e-session-123';

  beforeEach(() => {
    const fixturePath = path.resolve(__dirname, '../fixtures/mock-sites/buggy-store.html');
    fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');

    // Load fixture into JSDOM
    document.documentElement.innerHTML = fixtureHtml;
    // Set origin and location context
    delete (window as any).location;
    window.location = new URL(mockUrl) as any;
  });

  it('executes the full DISCOVER -> PLAN -> EXECUTE -> REASON -> VERIFY -> REPORT cycle', async () => {
    // -------------------------------------------------------------
    // 1. DISCOVER PHASE
    // -------------------------------------------------------------
    const snapshot = buildPageSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot.url).toContain('https://example.com');
    expect(snapshot.metadata.title).toBe('Store');
    expect(snapshot.metadata.h1Count).toBe(2);
    expect(snapshot.metadata.h1Texts).toContain('Welcome to Buggy Store');
    expect(snapshot.metadata.h1Texts).toContain('Special Summer Discounts');

    // Verify elements discovered
    expect(snapshot.links.length).toBeGreaterThanOrEqual(6);
    expect(snapshot.buttons.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.forms.length).toBe(2);
    expect(snapshot.images.length).toBe(2);

    // Verify broken link detection in discovery
    const deadAnchor = snapshot.links.find((l) => l.href === '#');
    expect(deadAnchor).toBeDefined();

    const scriptLink = snapshot.links.find((l) => l.href?.startsWith('javascript:'));
    expect(scriptLink).toBeDefined();

    const emptyLink = snapshot.links.find((l) => l.href === '');
    expect(emptyLink).toBeDefined();

    // Verify high-risk button detection in discovery
    const deleteBtn = snapshot.buttons.find((b) => b.text.includes('Delete User Account'));
    expect(deleteBtn).toBeDefined();
    expect(deleteBtn?.riskLevel).toBe('HIGH');

    // -------------------------------------------------------------
    // 2. CRAWL & SITEMAP DISCOVERY MAP
    // -------------------------------------------------------------
    const crawler = new WebsiteCrawler(mockUrl, 5, 2);
    const enqueued = crawler.addPageSnapshot(snapshot, 0);
    const discoveryMap = crawler.buildDiscoveryMap(sessionId);

    expect(discoveryMap.sessionId).toBe(sessionId);
    expect(discoveryMap.origin).toBe(mockOrigin);
    expect(discoveryMap.totalInternalLinks).toBeGreaterThanOrEqual(2);
    expect(discoveryMap.totalButtons).toBeGreaterThanOrEqual(3);
    expect(discoveryMap.totalForms).toBe(2);
    expect(discoveryMap.totalImages).toBe(2);
    expect(enqueued.length).toBeGreaterThan(0);

    // -------------------------------------------------------------
    // 3. DETERMINISTIC QA ENGINE VERIFICATION
    // -------------------------------------------------------------
    const qaEngine = new QAEngine();
    const simulatedConsoleErrors = [
      {
        message: 'Uncaught TypeError: Cannot read properties of undefined (reading "id")',
        source: 'https://example.com/assets/app.js',
        lineno: 42,
        timestamp: Date.now(),
      },
    ];
    const simulatedNetworkFailures = [
      {
        url: 'https://example.com/api/v1/user/checkout?token=sk-secret123',
        status: 500,
        statusText: 'Internal Server Error',
        method: 'POST',
        type: 'fetch' as const,
        timestamp: Date.now(),
      },
    ];

    const qaResult = await qaEngine.runAllTests(snapshot, sessionId, DEFAULT_SESSION_CONFIG, {
      consoleErrors: simulatedConsoleErrors,
      networkFailures: simulatedNetworkFailures,
    });

    expect(qaResult.findings.length).toBeGreaterThanOrEqual(8);
    const findings = qaResult.findings;

    // Verify SEO defects detected
    const seoFindings = findings.filter((f) => f.category === 'SEO');
    expect(seoFindings.some((f) => /multiple <h1>/i.test(f.title))).toBe(true);
    expect(seoFindings.some((f) => /meta description/i.test(f.title))).toBe(true);

    // Verify Accessibility defects detected
    const a11yFindings = findings.filter((f) => f.category === 'ACCESSIBILITY');
    expect(a11yFindings.some((f) => /alt/i.test(f.title))).toBe(true);
    expect(a11yFindings.some((f) => /label/i.test(f.title))).toBe(true);

    // Verify Link defects detected
    const linkFindings = findings.filter((f) => f.category === 'FUNCTIONAL' && /link/i.test(f.title));
    expect(linkFindings.length).toBeGreaterThanOrEqual(2);

    // Verify Button defects detected
    const buttonFindings = findings.filter((f) => f.category === 'FUNCTIONAL' && /button/i.test(f.title));
    expect(buttonFindings.some((f) => /missing accessible text label/i.test(f.title))).toBe(true);
    expect(buttonFindings.some((f) => /high-risk/i.test(f.title))).toBe(true);

    // Verify Form defects detected
    const formFindings = findings.filter((f) => f.category === 'FUNCTIONAL' && /form/i.test(f.title));
    expect(formFindings.some((f) => /submit button/i.test(f.title))).toBe(true);

    // Verify Console and Network failures detected
    expect(findings.some((f) => f.category === 'CONSOLE')).toBe(true);
    expect(findings.some((f) => f.category === 'NETWORK')).toBe(true);

    // Check health scores calculated
    expect(qaResult.scores.overallScore).toBeLessThan(100);
    expect(qaResult.scores.categoryScores.SEO.score).toBeLessThan(100);
    expect(qaResult.scores.categoryScores.ACCESSIBILITY.score).toBeLessThan(100);

    // -------------------------------------------------------------
    // 4. AGENT PLANNING PHASE
    // -------------------------------------------------------------
    const planner = new AgentPlanner();
    const testPlan = planner.planTasks(snapshot, sessionId);

    expect(testPlan.tasks.length).toBeGreaterThan(0);
    expect(testPlan.pageUrl).toBe(mockUrl);

    // High risk tasks identified in plan
    const highRiskButtonTask = testPlan.tasks.find((t) => t.type === 'BUTTON_CLICK' && t.riskLevel === 'HIGH');
    expect(highRiskButtonTask).toBeDefined();
    expect(highRiskButtonTask?.title).toContain('Delete');

    const highRiskFormTask = testPlan.tasks.find((t) => t.type === 'FORM_FILL' && t.riskLevel === 'HIGH');
    expect(highRiskFormTask).toBeDefined();

    // -------------------------------------------------------------
    // 5. AGENT EXECUTION & SAFETY GATING
    // -------------------------------------------------------------
    const executor = new AgentExecutor();

    // 5a. Attempt to execute HIGH risk task without user approval -> BLOCKED
    if (highRiskButtonTask) {
      const blockedRes = await executor.executeTask(101, highRiskButtonTask);
      expect(blockedRes.success).toBe(false);
      expect(blockedRes.error).toContain('blocked from automated execution');
    }

    // 5b. Execute HIGH risk task WITH explicit user approval -> PERMITTED
    if (highRiskButtonTask) {
      const approvedTask: TestTask = {
        ...highRiskButtonTask,
        approvedByUser: true,
      };
      const approvedRes = await executor.executeTask(101, approvedTask);
      expect(approvedRes.success).toBe(true);
    }

    // 5c. Action simulator test on real DOM
    const addCartBtn = document.getElementById('add-cart-btn');
    expect(addCartBtn).not.toBeNull();

    let buttonClicked = false;
    addCartBtn?.addEventListener('click', () => {
      buttonClicked = true;
    });

    await simulateClick('#add-cart-btn');
    expect(buttonClicked).toBe(true);

    // -------------------------------------------------------------
    // 6. AI REASONER & HEURISTIC FALLBACK
    // -------------------------------------------------------------
    const reasoner = new AIReasoner();
    const mockTask = testPlan.tasks[0];
    const initialVerdict: ReasoningVerdict = {
      taskId: mockTask.id,
      passed: false,
      confidence: 0.75,
      severity: 'HIGH',
      rationale: 'Missing label on input causes accessibility issue',
      suggestedRemediation: 'Add <label for="..."> element',
      requiresVerification: false,
    };

    const finalVerdict = await reasoner.arbitrateVerdict(
      mockTask,
      { success: true, durationMs: 25 },
      {
        taskId: mockTask.id,
        preUrl: mockUrl,
        postUrl: mockUrl,
        domMutationsCount: 1,
        urlChanged: false,
        modalAppeared: false,
        errorAlertAppeared: false,
        successAlertAppeared: false,
        consoleErrors: [],
        networkFailures: [],
        timestamp: Date.now(),
      },
      initialVerdict
    );

    expect(finalVerdict).toBeDefined();
    expect(finalVerdict.passed).toBe(false);
    expect(finalVerdict.confidence).toBeGreaterThanOrEqual(0.7);

    // -------------------------------------------------------------
    // 7. MULTI-FORMAT REPORT ENGINE & ZERO-PII SANITIZATION
    // -------------------------------------------------------------
    const mockSession: QASession = {
      id: sessionId,
      tabId: 101,
      url: mockUrl,
      origin: mockOrigin,
      title: 'Store',
      state: 'COMPLETED',
      startTime: Date.now() - 35000,
      endTime: Date.now(),
      progress: 100,
      currentAction: 'Complete',
      config: DEFAULT_SESSION_CONFIG,
      stats: {
        pagesDiscovered: 1,
        pagesCrawled: 1,
        elementsDiscovered: 10,
        testsExecuted: 15,
        passedCount: 5,
        failedCount: findings.length,
        warningsCount: 2,
        criticalBugsCount: findings.filter((f) => f.severity === 'CRITICAL').length,
      },
    };

    const reportEngine = new ReportEngine();
    const reportData = reportEngine.buildReportData(mockSession, findings, discoveryMap);

    expect(reportData.metadata.reportId).toBeDefined();
    expect(reportData.metadata.sessionId).toBe(sessionId);
    expect(reportData.summary.totalFindings).toBe(findings.length);
    expect(reportData.scores.overallScore).toBe(qaResult.scores.overallScore);

    // Generate JSON report
    const jsonOutput = generateJsonReport(reportData);
    const parsedJson = JSON.parse(jsonOutput);
    expect(parsedJson.$schema).toBeDefined();
    expect(parsedJson.generator.name).toBe('AI Website QA Agent');
    expect(parsedJson.executiveSummary.findingsBreakdown.total).toBe(findings.length);

    // Generate Markdown report
    const mdOutput = generateMarkdownReport(reportData);
    expect(mdOutput).toContain('QA Audit Report');
    expect(mdOutput).toContain('Executive Summary');
    expect(mdOutput).toContain('Category Breakdown');
    expect(mdOutput).toContain('| Category | Score | Weight | Passed | Failed | Warnings |');

    // Generate HTML report
    const htmlOutput = generateHtmlReport(reportData);
    expect(htmlOutput).toContain('<!DOCTYPE html>');
    expect(htmlOutput).toContain('AI Website QA Audit');
    expect(htmlOutput).toContain('@media print');
    expect(htmlOutput).toContain('https://example.com/store');

    // SECURITY REDACTION CHECK: Verify zero secrets in final reports
    expect(jsonOutput).not.toContain('sk-secret123');
    expect(jsonOutput).toContain('[REDACTED_SECRET]');

    expect(mdOutput).not.toContain('sk-secret123');
    expect(mdOutput).toContain('[REDACTED_SECRET]');

    expect(htmlOutput).not.toContain('sk-secret123');
    expect(htmlOutput).toContain('[REDACTED_SECRET]');
  });
});
