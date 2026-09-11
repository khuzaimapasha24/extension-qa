import { describe, it, expect, vi } from 'vitest';
import { AgentVerifier } from '../../src/agent/verifier';
import { AgentExecutor } from '../../src/agent/executor';
import { AgentObserver } from '../../src/agent/observer';
import { AgentReasoner } from '../../src/agent/reasoner';
import { TestTask, ReasoningVerdict } from '../../src/shared/types/agent';

describe('AgentVerifier', () => {
  const task: TestTask = {
    id: 'task_bug_1',
    type: 'BUTTON_CLICK',
    title: 'Broken Button',
    description: 'Test',
    targetSelector: 'button#err',
    riskLevel: 'LOW',
    expectedOutcome: 'Works',
    status: 'RUNNING',
  };

  const originalVerdict: ReasoningVerdict = {
    taskId: 'task_bug_1',
    passed: false,
    confidence: 0.9,
    rationale: 'Uncaught error in listener',
    requiresVerification: true,
  };

  it('confirms reproducible defects when re-test fails consistently', async () => {
    const mockExecutor = {
      executeTask: vi.fn().mockResolvedValue({ success: true, durationMs: 20 }),
    } as unknown as AgentExecutor;

    const mockObserver = {
      capturePreState: vi.fn().mockResolvedValue({ url: 'https://example.com', timestamp: Date.now() }),
      capturePostState: vi.fn().mockResolvedValue({
        taskId: 'task_bug_1',
        preUrl: 'https://example.com',
        postUrl: 'https://example.com',
        urlChanged: false,
        domMutationsCount: 0,
        modalAppeared: false,
        errorAlertAppeared: false,
        successAlertAppeared: false,
        consoleErrors: [{ message: 'TypeError: undefined', timestamp: Date.now() }],
        networkFailures: [],
        timestamp: Date.now(),
      }),
    } as unknown as AgentObserver;

    const mockReasoner = {
      evaluate: vi.fn().mockReturnValue({
        taskId: 'task_bug_1',
        passed: false,
        confidence: 0.95,
        rationale: 'TypeError: undefined',
        requiresVerification: true,
      }),
    } as unknown as AgentReasoner;

    const verifier = new AgentVerifier(mockExecutor, mockObserver, mockReasoner);
    const result = await verifier.verifyBug(1, task, originalVerdict, 1);

    expect(result.isReproducible).toBe(true);
    expect(result.confirmedFinding).toBe(true);
    expect(result.notes).toContain('consistently failed');
  });

  it('identifies flaky or transient anomalies when re-test passes', async () => {
    const mockExecutor = {
      executeTask: vi.fn().mockResolvedValue({ success: true, durationMs: 20 }),
    } as unknown as AgentExecutor;

    const mockObserver = {
      capturePreState: vi.fn().mockResolvedValue({ url: 'https://example.com', timestamp: Date.now() }),
      capturePostState: vi.fn().mockResolvedValue({
        taskId: 'task_bug_1',
        preUrl: 'https://example.com',
        postUrl: 'https://example.com',
        urlChanged: false,
        domMutationsCount: 2,
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
        taskId: 'task_bug_1',
        passed: true,
        confidence: 0.9,
        rationale: 'Pass',
        requiresVerification: false,
      }),
    } as unknown as AgentReasoner;

    const verifier = new AgentVerifier(mockExecutor, mockObserver, mockReasoner);
    const result = await verifier.verifyBug(1, task, originalVerdict, 1);

    expect(result.isReproducible).toBe(false);
    expect(result.confirmedFinding).toBe(false);
    expect(result.notes).toContain('Transient anomaly');
  });
});
