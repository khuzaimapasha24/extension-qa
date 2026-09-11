import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichFinding } from '../../src/evidence/bundler';
import { reportEngine } from '../../src/reporting/report-engine';
import { AgentExecutor } from '../../src/agent/executor';
import { Finding } from '../../src/shared/types/qa';
import { QASession } from '../../src/shared/types/session';
import { TestTask } from '../../src/shared/types/agent';
import { DEFAULT_SESSION_CONFIG } from '../../src/shared/constants/defaults';
import * as msgBus from '../../src/shared/messaging/bus';

describe('Security Audit & Privacy Gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sanitizes credentials and tokens embedded in finding evidence items', async () => {
    const rawFinding: Finding = {
      id: 'f_leak_1',
      sessionId: 'sess_sec_test',
      category: 'CONSOLE',
      severity: 'CRITICAL',
      title: 'Console error with secret key: sk-proj-1234567890abcdef123456',
      description: 'API failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token',
      page: 'https://example.com/checkout?token=secret123',
      selector: 'input[name="password"]',
      steps: ['Enter credit card 4111 2222 3333 4444 into payment field'],
      expected: 'Masked input',
      actual: 'Exposed plain text',
      confidence: 1.0,
      timestamp: 1720000000000,
      retestCount: 0,
      status: 'FAIL',
      evidence: [
        {
          type: 'console_error',
          description: 'Failed request with token sk-12345678901234567890abcdef',
          data: {
            message: 'Uncaught Error in auth handler',
            apiKey: 'AKIAIOSFODNN7EXAMPLE',
            creditCard: '4111 2222 3333 9876',
          },
          timestamp: 1720000001000,
        },
      ],
      recommendation: 'Remove API key sk-proj-1234567890abcdef123456 from client log',
    };

    const sanitizedFinding = await enrichFinding(rawFinding);

    // Title & description sanitization
    expect(sanitizedFinding.title).toContain('[REDACTED_OPENAI_KEY]');
    expect(sanitizedFinding.title).not.toContain('sk-proj-');
    expect(sanitizedFinding.description).toContain('Bearer [REDACTED_TOKEN]');

    // Steps credit card sanitization
    expect(sanitizedFinding.steps[0]).toContain('[REDACTED_CARD: ****-4444]');
    expect(sanitizedFinding.steps[0]).not.toContain('4111 2222');

    // Recommendation sanitization
    expect(sanitizedFinding.recommendation).toContain('[REDACTED_OPENAI_KEY]');

    // Evidence data sanitization
    const evidenceData = sanitizedFinding.evidence[0].data as Record<string, unknown>;
    expect(evidenceData.apiKey).toBe('[REDACTED_CONFIDENTIAL]');
    expect(evidenceData.creditCard).toContain('[REDACTED_CARD: ****-9876]');
  });

  it('guarantees report generation sanitizes target URL query params and findings', () => {
    const session: QASession = {
      id: 'sess_rep_sec',
      tabId: 201,
      url: 'https://mysite.com/dashboard?token=xyz987&password=myPass&user=admin',
      origin: 'https://mysite.com',
      title: 'Admin Console - sk-proj-secretKey1234567890',
      startTime: 1720000000000,
      state: 'COMPLETED',
      progress: 100,
      currentAction: 'Complete',
      config: DEFAULT_SESSION_CONFIG,
      stats: {
        pagesDiscovered: 1,
        pagesCrawled: 1,
        elementsDiscovered: 10,
        testsExecuted: 5,
        passedCount: 4,
        failedCount: 1,
        warningsCount: 0,
        criticalBugsCount: 0,
      },
    };

    const findings: Finding[] = [
      {
        id: 'f_url_param',
        sessionId: 'sess_rep_sec',
        category: 'NETWORK',
        severity: 'HIGH',
        title: 'Leaked token in query parameter',
        description: 'Endpoint called with apiKey=supersecret123',
        page: 'https://mysite.com/dashboard?token=xyz987',
        steps: ['Inspect network request'],
        expected: 'Header authentication',
        actual: 'Query param authentication',
        confidence: 0.95,
        timestamp: 1720000000000,
        retestCount: 0,
        status: 'FAIL',
        evidence: [],
        recommendation: 'Move credentials to request headers',
      },
    ];

    const reportData = reportEngine.buildReportData(session, findings);

    // Metadata URL query params redacted
    expect(reportData.metadata.url).toContain('token=[REDACTED_SECRET]');
    expect(reportData.metadata.url).toContain('password=[REDACTED_SECRET]');
    expect(reportData.metadata.url).toContain('user=admin');
    expect(reportData.metadata.url).not.toContain('xyz987');
    expect(reportData.metadata.url).not.toContain('myPass');

    // Title sanitized
    expect(reportData.metadata.title).toContain('[REDACTED_OPENAI_KEY]');

    // Finding description sanitized
    expect(reportData.findings[0].description).toContain('apiKey=[REDACTED_SECRET]');
    expect(reportData.findings[0].description).not.toContain('supersecret123');
  });

  it('blocks unapproved HIGH risk actions and permits approved actions in AgentExecutor', async () => {
    const executor = new AgentExecutor();

    const highRiskTask: TestTask = {
      id: 'task_delete_account',
      type: 'BUTTON_CLICK',
      title: 'Click Delete Account CTA',
      description: 'Destructive deletion button',
      targetSelector: 'button#delete-account',
      riskLevel: 'HIGH',
      expectedOutcome: 'Confirmation modal appears',
      status: 'PENDING',
    };

    // 1. Unapproved task is blocked
    const blockedResult = await executor.executeTask(1, highRiskTask);
    expect(blockedResult.success).toBe(false);
    expect(blockedResult.error).toContain('blocked from automated execution');

    // 2. Approved task is allowed to dispatch to tab
    vi.spyOn(msgBus, 'sendToTab').mockImplementation(async (_tabId, type) => {
      if (type === 'HIGHLIGHT_ELEMENT') return { success: true } as any;
      if (type === 'EXECUTE_ACTION') return { executed: true, actionType: 'CLICK', selector: 'button#delete-account', durationMs: 10 } as any;
      return {} as any;
    });

    const approvedTask: TestTask = {
      ...highRiskTask,
      approvedByUser: true,
    };

    const allowedResult = await executor.executeTask(1, approvedTask);
    expect(allowedResult.success).toBe(true);
  });
});
