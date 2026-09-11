import { TestTask, ObservationResult, ReasoningVerdict } from '../shared/types/agent';
import { ExecutionResult } from './executor';
import { QACategory, FindingSeverity } from '../shared/types/qa';

export class AgentReasoner {
  /**
   * Compares expected outcome against actual execution and observation telemetry.
   */
  public evaluate(
    task: TestTask,
    execResult: ExecutionResult,
    obsResult: ObservationResult
  ): ReasoningVerdict {
    // 1. Check if execution failed completely (e.g. element missing, disabled, thrown exception)
    if (!execResult.success) {
      const errorMsg = execResult.error || 'Execution failed';
      const category: QACategory = 'FUNCTIONAL';
      const severity: FindingSeverity = task.type === 'BUTTON_CLICK' ? 'MEDIUM' : 'HIGH';

      return {
        taskId: task.id,
        passed: false,
        confidence: 0.9,
        rationale: `Action execution error: ${errorMsg}`,
        category,
        severity,
        suggestedRemediation: 'Verify element selector, accessibility status, and ensure element is interactive and present in the DOM.',
        requiresVerification: true,
      };
    }

    // 2. Check for newly triggered runtime console errors
    if (obsResult.consoleErrors.length > 0) {
      const firstErr = obsResult.consoleErrors[0];
      const summary = firstErr.message || 'Unknown runtime error';

      return {
        taskId: task.id,
        passed: false,
        confidence: 0.95,
        rationale: `Uncaught JavaScript exception triggered during action: "${summary}"`,
        category: 'CONSOLE',
        severity: 'CRITICAL',
        suggestedRemediation: 'Inspect stack trace and handle potential null-pointer or unhandled promise rejection in click/input handler.',
        requiresVerification: true,
      };
    }

    // 3. Check for newly triggered network failures (4xx/5xx or timeout)
    if (obsResult.networkFailures.length > 0) {
      const firstFail = obsResult.networkFailures[0];
      const status = firstFail.status ? `status ${firstFail.status}` : 'network timeout';

      return {
        taskId: task.id,
        passed: false,
        confidence: 0.9,
        rationale: `HTTP request failed (${status}) during interaction: ${firstFail.url}`,
        category: 'NETWORK',
        severity: firstFail.status && firstFail.status >= 500 ? 'CRITICAL' : 'HIGH',
        suggestedRemediation: 'Ensure backend endpoint is active and handles request parameters properly.',
        requiresVerification: true,
      };
    }

    // 4. Evaluate Form Specific Logic
    if (task.type === 'FORM_SUBMIT') {
      if (obsResult.errorAlertAppeared) {
        return {
          taskId: task.id,
          passed: false,
          confidence: 0.85,
          rationale: `Form submission resulted in an explicit error alert: "${obsResult.alertMessage || 'Submission failed'}"`,
          category: 'FUNCTIONAL',
          severity: 'HIGH',
          suggestedRemediation: 'Verify form validation logic and ensure valid synthetic test payloads pass submission criteria.',
          requiresVerification: true,
        };
      }
    }

    // 5. Evaluate Button Click Logic (Dead button detection)
    if (task.type === 'BUTTON_CLICK') {
      const hasStateChange =
        obsResult.domMutationsCount > 0 ||
        obsResult.urlChanged ||
        obsResult.modalAppeared ||
        obsResult.successAlertAppeared ||
        obsResult.errorAlertAppeared;

      if (!hasStateChange) {
        return {
          taskId: task.id,
          passed: false,
          confidence: 0.85,
          rationale: `Potential Dead Button: Click produced 0 DOM mutations, no URL change, no modal dialog, and no network activity.`,
          category: 'FUNCTIONAL',
          severity: 'MEDIUM',
          suggestedRemediation: 'Ensure button has an attached click event listener or remove interactive button styling if element is decorative.',
          requiresVerification: true,
        };
      }
    }

    // 6. Evaluate Link Navigation Logic (Dead link / no-op link)
    if (task.type === 'LINK_CLICK') {
      if (!obsResult.urlChanged && obsResult.domMutationsCount === 0) {
        return {
          taskId: task.id,
          passed: false,
          confidence: 0.8,
          rationale: `Potential Inactive Link: Clicking link did not trigger route change or DOM state modification.`,
          category: 'FUNCTIONAL',
          severity: 'LOW',
          suggestedRemediation: 'Check href attribute and route binding on link element.',
          requiresVerification: true,
        };
      }
    }

    // 7. Successful evaluation
    return {
      taskId: task.id,
      passed: true,
      confidence: 0.95,
      rationale: `Action satisfied expected outcome: DOM updated smoothly with 0 console or network errors.`,
      requiresVerification: false,
    };
  }
}

export const agentReasoner = new AgentReasoner();
