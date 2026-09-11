import { describe, it, expect } from 'vitest';
import { AgentReasoner } from '../../src/agent/reasoner';
import { TestTask, ObservationResult } from '../../src/shared/types/agent';
import { ExecutionResult } from '../../src/agent/executor';

describe('AgentReasoner', () => {
  const reasoner = new AgentReasoner();

  const baseTask: TestTask = {
    id: 'task_1',
    type: 'BUTTON_CLICK',
    title: 'Click Submit',
    description: 'Test button',
    targetSelector: 'button#btn',
    riskLevel: 'LOW',
    expectedOutcome: 'Button triggers state change',
    status: 'RUNNING',
  };

  const baseExecSuccess: ExecutionResult = {
    success: true,
    durationMs: 45,
  };

  const baseObsSuccess: ObservationResult = {
    taskId: 'task_1',
    preUrl: 'https://example.com',
    postUrl: 'https://example.com',
    urlChanged: false,
    domMutationsCount: 3,
    modalAppeared: false,
    errorAlertAppeared: false,
    successAlertAppeared: false,
    consoleErrors: [],
    networkFailures: [],
    timestamp: Date.now(),
  };

  it('evaluates success when DOM mutations occur with zero errors', () => {
    const verdict = reasoner.evaluate(baseTask, baseExecSuccess, baseObsSuccess);
    expect(verdict.passed).toBe(true);
    expect(verdict.requiresVerification).toBe(false);
  });

  it('detects dead button when 0 mutations and no state updates happen', () => {
    const deadObs: ObservationResult = {
      ...baseObsSuccess,
      domMutationsCount: 0,
      urlChanged: false,
      modalAppeared: false,
    };

    const verdict = reasoner.evaluate(baseTask, baseExecSuccess, deadObs);
    expect(verdict.passed).toBe(false);
    expect(verdict.category).toBe('FUNCTIONAL');
    expect(verdict.severity).toBe('MEDIUM');
    expect(verdict.rationale).toContain('Potential Dead Button');
    expect(verdict.requiresVerification).toBe(true);
  });

  it('detects unhandled runtime exceptions as CRITICAL bugs', () => {
    const errorObs: ObservationResult = {
      ...baseObsSuccess,
      consoleErrors: [
        {
          message: 'Uncaught TypeError: Cannot read properties of undefined',
          timestamp: Date.now(),
        },
      ],
    };

    const verdict = reasoner.evaluate(baseTask, baseExecSuccess, errorObs);
    expect(verdict.passed).toBe(false);
    expect(verdict.category).toBe('CONSOLE');
    expect(verdict.severity).toBe('CRITICAL');
    expect(verdict.rationale).toContain('Uncaught JavaScript exception');
  });

  it('detects HTTP network failures triggered by interaction', () => {
    const netFailObs: ObservationResult = {
      ...baseObsSuccess,
      networkFailures: [
        {
          url: 'https://example.com/api/submit',
          method: 'POST',
          status: 500,
          duration: 120,
          type: 'xhr',
          timestamp: Date.now(),
        },
      ],
    };

    const verdict = reasoner.evaluate(baseTask, baseExecSuccess, netFailObs);
    expect(verdict.passed).toBe(false);
    expect(verdict.category).toBe('NETWORK');
    expect(verdict.severity).toBe('CRITICAL');
  });

  it('detects form submission error alerts', () => {
    const formTask: TestTask = {
      ...baseTask,
      type: 'FORM_SUBMIT',
      title: 'Submit Contact Form',
    };

    const formAlertObs: ObservationResult = {
      ...baseObsSuccess,
      errorAlertAppeared: true,
      alertMessage: 'Database connection failed',
    };

    const verdict = reasoner.evaluate(formTask, baseExecSuccess, formAlertObs);
    expect(verdict.passed).toBe(false);
    expect(verdict.category).toBe('FUNCTIONAL');
    expect(verdict.severity).toBe('HIGH');
    expect(verdict.rationale).toContain('Database connection failed');
  });

  it('flags execution errors when target element is missing or disabled', () => {
    const failedExec: ExecutionResult = {
      success: false,
      durationMs: 10,
      error: 'Element not found for selector: "button#btn"',
    };

    const verdict = reasoner.evaluate(baseTask, failedExec, baseObsSuccess);
    expect(verdict.passed).toBe(false);
    expect(verdict.rationale).toContain('Element not found');
  });
});
