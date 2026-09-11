import { TestTask, ReasoningVerdict, VerificationResult } from '../shared/types/agent';
import { AgentExecutor, agentExecutor } from './executor';
import { AgentObserver, agentObserver } from './observer';
import { AgentReasoner, agentReasoner } from './reasoner';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('AgentVerifier');

export class AgentVerifier {
  constructor(
    private executor: AgentExecutor = agentExecutor,
    private observer: AgentObserver = agentObserver,
    private reasoner: AgentReasoner = agentReasoner
  ) {}

  /**
   * Re-tests a failing task to verify bug reproducibility and eliminate flakiness.
   */
  public async verifyBug(
    tabId: number,
    task: TestTask,
    originalVerdict: ReasoningVerdict,
    maxCycles: number = 1
  ): Promise<VerificationResult> {
    logger.info(`Verifying potential bug for task ${task.id}: "${originalVerdict.rationale}"`);

    let failureCount = 0;
    let attempts = 0;

    for (let cycle = 1; cycle <= maxCycles; cycle++) {
      attempts++;
      // Brief pause between re-tests
      await new Promise((r) => setTimeout(r, 400));

      const preState = await this.observer.capturePreState(tabId);
      const execResult = await this.executor.executeTask(tabId, task, { highlightFirst: true, maxRetries: 0 });
      const obsResult = await this.observer.capturePostState(tabId, task.id, preState.url, 300);
      const verdict = this.reasoner.evaluate(task, execResult, obsResult);

      if (!verdict.passed) {
        failureCount++;
      }
    }

    const isReproducible = failureCount === attempts;
    const confirmedFinding = isReproducible;
    const notes = confirmedFinding
      ? `Defect confirmed: consistently failed across ${attempts} verification re-tests.`
      : `Transient anomaly: passed on re-test (${failureCount}/${attempts} failures). Suppressed from critical findings.`;

    logger.info(`Bug verification completed for task ${task.id}: reproducible=${isReproducible}`);

    return {
      taskId: task.id,
      originalVerdict,
      isReproducible,
      confirmedFinding,
      reproductionAttempts: attempts,
      notes,
    };
  }
}

export const agentVerifier = new AgentVerifier();
