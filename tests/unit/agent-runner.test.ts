import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunner } from '../../src/agent/runner';
import { AgentPlanner } from '../../src/agent/planner';
import { AgentExecutor } from '../../src/agent/executor';
import { AgentObserver } from '../../src/agent/observer';
import { AgentReasoner } from '../../src/agent/reasoner';
import { AgentVerifier } from '../../src/agent/verifier';
import { QASession } from '../../src/shared/types/session';
import { PageSnapshot } from '../../src/shared/types/discovery';
import { dbClient } from '../../src/storage/indexed-db';

describe('AgentRunner', () => {
  let session: QASession;
  let snapshot: PageSnapshot;

  beforeEach(async () => {
    await dbClient.clear('findings');

    session = {
      id: 'session_test_run',
      tabId: 101,
      url: 'https://example.com',
      origin: 'https://example.com',
      title: 'Example',
      state: 'PLANNING',
      startTime: Date.now(),
      progress: 40,
      currentAction: 'Starting test loop',
      stats: {
        pagesDiscovered: 1,
        pagesCrawled: 1,
        elementsDiscovered: 2,
        testsExecuted: 0,
        passedCount: 0,
        failedCount: 0,
        warningsCount: 0,
        criticalBugsCount: 0,
      },
      config: {
        maxPages: 5,
        crawlDepth: 2,
        privacyMode: true,
        requireApprovalForHighRisk: true,
        enabledCategories: ['FUNCTIONAL', 'CONSOLE', 'NETWORK'],
      },
    };

    snapshot = {
      url: 'https://example.com',
      origin: 'https://example.com',
      pathname: '/',
      title: 'Example',
      metadata: {
        title: 'Example',
        description: 'Test',
        h1Count: 1,
        h1Texts: ['Example'],
        headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      },
      links: [],
      buttons: [
        {
          text: 'Submit Form',
          type: 'button',
          selector: 'button#submit',
          isVisible: true,
          isDisabled: false,
          riskLevel: 'LOW',
        },
      ],
      forms: [],
      images: [],
      navigations: [],
      totalInteractiveCount: 1,
      timestamp: Date.now(),
    };
  });

  it('coordinates the full PLANNING -> EXECUTING -> OBSERVING -> REASONING -> REPORTING loop', async () => {
    const mockPlanner = {
      planTasks: vi.fn().mockReturnValue({
        id: 'plan_1',
        sessionId: 'session_test_run',
        pageUrl: 'https://example.com',
        tasks: [
          {
            id: 'task_1',
            type: 'BUTTON_CLICK',
            title: 'Click Submit',
            description: 'Test submit button',
            targetSelector: 'button#submit',
            riskLevel: 'LOW',
            expectedOutcome: 'Works',
            status: 'PENDING',
          },
        ],
        createdAt: Date.now(),
        status: 'PENDING',
      }),
    } as unknown as AgentPlanner;

    const mockExecutor = {
      executeTask: vi.fn().mockResolvedValue({ success: true, durationMs: 25 }),
    } as unknown as AgentExecutor;

    const mockObserver = {
      capturePreState: vi.fn().mockResolvedValue({ url: 'https://example.com', timestamp: Date.now() }),
      capturePostState: vi.fn().mockResolvedValue({
        taskId: 'task_1',
        preUrl: 'https://example.com',
        postUrl: 'https://example.com',
        urlChanged: false,
        domMutationsCount: 1,
        modalAppeared: false,
        errorAlertAppeared: false,
        successAlertAppeared: false,
        consoleErrors: [],
        networkFailures: [],
        timestamp: Date.now(),
      }),
    } as unknown as AgentObserver;

    const mockReasoner = {
      evaluate: vi.fn().mockReturnValue({
        taskId: 'task_1',
        passed: true,
        confidence: 0.95,
        rationale: 'Pass',
        requiresVerification: false,
      }),
    } as unknown as AgentReasoner;

    const mockVerifier = {
      verifyBug: vi.fn(),
    } as unknown as AgentVerifier;

    const runner = new AgentRunner(mockPlanner, mockExecutor, mockObserver, mockReasoner, mockVerifier);
    const progressUpdates: string[] = [];

    const result = await runner.runLoop(session, snapshot, async (update) => {
      progressUpdates.push(update.state);
    });

    expect(result.plan).toBeDefined();
    expect(result.plan.tasks[0].status).toBe('PASSED');
    expect(progressUpdates).toContain('PLANNING');
    expect(progressUpdates).toContain('EXECUTING');
    expect(progressUpdates).toContain('OBSERVING');
    expect(progressUpdates).toContain('REASONING');
    expect(progressUpdates).toContain('REPORTING');
  });

  it('triggers verification and creates structured finding on confirmed defect', async () => {
    const mockPlanner = {
      planTasks: vi.fn().mockReturnValue({
        id: 'plan_1',
        sessionId: 'session_test_run',
        pageUrl: 'https://example.com',
        tasks: [
          {
            id: 'task_dead_btn',
            type: 'BUTTON_CLICK',
            title: 'Dead Button',
            description: 'No-op button',
            targetSelector: 'button#dead',
            riskLevel: 'LOW',
            expectedOutcome: 'Works',
            status: 'PENDING',
          },
        ],
        createdAt: Date.now(),
        status: 'PENDING',
      }),
    } as unknown as AgentPlanner;

    const mockExecutor = {
      executeTask: vi.fn().mockResolvedValue({ success: true, durationMs: 20 }),
    } as unknown as AgentExecutor;

    const mockObserver = {
      capturePreState: vi.fn().mockResolvedValue({ url: 'https://example.com', timestamp: Date.now() }),
      capturePostState: vi.fn().mockResolvedValue({
        taskId: 'task_dead_btn',
        preUrl: 'https://example.com',
        postUrl: 'https://example.com',
        urlChanged: false,
        domMutationsCount: 0,
        modalAppeared: false,
        errorAlertAppeared: false,
        successAlertAppeared: false,
        consoleErrors: [],
        networkFailures: [],
        timestamp: Date.now(),
      }),
    } as unknown as AgentObserver;

    const mockReasoner = {
      evaluate: vi.fn().mockReturnValue({
        taskId: 'task_dead_btn',
        passed: false,
        confidence: 0.85,
        rationale: 'Potential Dead Button',
        findingType: 'DEAD_LINK',
        severity: 'MEDIUM',
        requiresVerification: true,
      }),
    } as unknown as AgentReasoner;

    const mockVerifier = {
      verifyBug: vi.fn().mockResolvedValue({
        taskId: 'task_dead_btn',
        isReproducible: true,
        confirmedFinding: true,
        reproductionAttempts: 1,
        notes: 'Confirmed',
      }),
    } as unknown as AgentVerifier;

    const runner = new AgentRunner(mockPlanner, mockExecutor, mockObserver, mockReasoner, mockVerifier);

    const result = await runner.runLoop(session, snapshot, async () => {});

    expect(result.findings.length).toBe(1);
    expect(result.findings[0].category).toBe('FUNCTIONAL');
    expect(result.findings[0].severity).toBe('MEDIUM');
    expect(result.findings[0].status).toBe('FAIL');
    expect(result.plan.tasks[0].status).toBe('FAILED');
  });
});
