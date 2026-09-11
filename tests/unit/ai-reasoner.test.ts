import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIReasoner } from '../../src/ai/ai-reasoner';
import { ModelManager } from '../../src/ai/model-manager';
import { TestTask, ObservationResult, ReasoningVerdict } from '../../src/shared/types/agent';
import { ExecutionResult } from '../../src/agent/executor';

describe('AIReasoner', () => {
  let aiReasoner: AIReasoner;
  let mockManager: Partial<ModelManager>;

  const baseTask: TestTask = {
    id: 'task_ui_1',
    type: 'BUTTON_CLICK',
    title: 'Decorative Badge Click',
    description: 'Test button',
    targetSelector: 'div.badge[role="button"]',
    riskLevel: 'LOW',
    expectedOutcome: 'Works',
    status: 'RUNNING',
  };

  const baseExec: ExecutionResult = {
    success: true,
    durationMs: 30,
  };

  const baseObs: ObservationResult = {
    taskId: 'task_ui_1',
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
  };

  const deterministicVerdict: ReasoningVerdict = {
    taskId: 'task_ui_1',
    passed: false,
    confidence: 0.85,
    rationale: 'Potential Dead Button: Click produced 0 DOM mutations',
    category: 'FUNCTIONAL',
    severity: 'MEDIUM',
    requiresVerification: true,
  };

  beforeEach(() => {
    mockManager = {
      isReady: vi.fn().mockReturnValue(false),
      generateChatCompletion: vi.fn(),
    };
    aiReasoner = new AIReasoner(mockManager as ModelManager);
  });

  it('skips AI inference and returns directly when deterministic confidence is >= 0.9 with no verification required', async () => {
    const confidentVerdict: ReasoningVerdict = {
      taskId: 'task_ui_1',
      passed: true,
      confidence: 0.95,
      rationale: 'Clean DOM state change',
      requiresVerification: false,
    };

    const result = await aiReasoner.arbitrateVerdict(baseTask, baseExec, baseObs, confidentVerdict);
    expect(result).toBe(confidentVerdict);
    expect(mockManager.generateChatCompletion).not.toHaveBeenCalled();
  });

  it('falls back to deterministic verdict when model is not ready', async () => {
    mockManager.isReady = vi.fn().mockReturnValue(false);

    const result = await aiReasoner.arbitrateVerdict(baseTask, baseExec, baseObs, deterministicVerdict);
    expect(result).toBe(deterministicVerdict);
  });

  it('suppresses false positive when local AI reasons that element is expected inert', async () => {
    mockManager.isReady = vi.fn().mockReturnValue(true);
    mockManager.generateChatCompletion = vi.fn().mockResolvedValue(
      JSON.stringify({
        isDefect: false,
        confidence: 0.92,
        defectType: 'EXPECTED_INERT',
        rationale: 'The element is a static status badge with decorative role="button" styling.',
      })
    );

    const result = await aiReasoner.arbitrateVerdict(baseTask, baseExec, baseObs, deterministicVerdict);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.rationale).toContain('[Local AI Evaluated]');
    expect(result.rationale).toContain('static status badge');
    expect(result.requiresVerification).toBe(false);
  });

  it('confirms genuine defect when local AI corroborates deterministic finding', async () => {
    mockManager.isReady = vi.fn().mockReturnValue(true);
    mockManager.generateChatCompletion = vi.fn().mockResolvedValue(
      JSON.stringify({
        isDefect: true,
        confidence: 0.96,
        defectType: 'DEAD_BUTTON',
        rationale: 'Interactive form submit button was clicked but completely failed to respond.',
        suggestedFix: 'Attach click handler or form submit listener to button.',
      })
    );

    const result = await aiReasoner.arbitrateVerdict(baseTask, baseExec, baseObs, deterministicVerdict);
    expect(result.passed).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.rationale).toContain('[Local AI Confirmed]');
    expect(result.suggestedRemediation).toContain('Attach click handler');
  });

  it('generates tailored accessibility fix when model is ready', async () => {
    mockManager.isReady = vi.fn().mockReturnValue(true);
    mockManager.generateChatCompletion = vi.fn().mockResolvedValue(
      JSON.stringify({
        proposedCode: '<button aria-label="Close dialog">&times;</button>',
        explanation: 'Adds accessible name to icon-only button',
        wcagGuideline: 'WCAG 2.1 AA 4.1.2',
      })
    );

    const fix = await aiReasoner.generateAccessibilityFix(
      'button.close',
      '<button>&times;</button>',
      'MISSING_ACCESSIBLE_NAME',
      'Button has no accessible name',
      'Home'
    );

    expect(fix).not.toBeNull();
    expect(fix?.proposedCode).toContain('aria-label');
    expect(fix?.wcagGuideline).toBe('WCAG 2.1 AA 4.1.2');
  });
});
