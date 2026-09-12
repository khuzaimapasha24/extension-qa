import { QASession } from '../shared/types/session';
import { PageSnapshot } from '../shared/types/discovery';
import { TestPlan, TestTask, AgentState } from '../shared/types/agent';
import { Finding } from '../shared/types/qa';
import { AgentPlanner, agentPlanner } from './planner';
import { AgentExecutor, agentExecutor } from './executor';
import { AgentObserver, agentObserver } from './observer';
import { AgentReasoner, agentReasoner } from './reasoner';
import { AgentVerifier, agentVerifier } from './verifier';
import { AIReasoner, aiReasoner as defaultAiReasoner } from '../ai/ai-reasoner';
import { sessionStore } from '../storage/session-store';
import { sendToTab } from '../shared/messaging/bus';
import { workflowLearner } from './workflow-learner';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('AgentRunner');

export interface RunnerProgressCallback {
  (update: {
    state: AgentState;
    progress: number;
    currentAction: string;
    currentTask?: TestTask;
    statsUpdate?: Partial<QASession['stats']>;
  }): Promise<void>;
}

export class AgentRunner {
  private isPaused: boolean = false;
  private isStopped: boolean = false;
  private activePlan: TestPlan | null = null;

  constructor(
    private planner: AgentPlanner = agentPlanner,
    private executor: AgentExecutor = agentExecutor,
    private observer: AgentObserver = agentObserver,
    private reasoner: AgentReasoner = agentReasoner,
    private verifier: AgentVerifier = agentVerifier,
    private aiReasoner: AIReasoner = defaultAiReasoner
  ) {}

  public pause(): void {
    this.isPaused = true;
    logger.info('AgentRunner paused');
  }

  public resume(): void {
    this.isPaused = false;
    logger.info('AgentRunner resumed');
  }

  public stop(): void {
    this.isStopped = true;
    this.isPaused = false;
    logger.info('AgentRunner stopped');
  }

  public getActivePlan(): TestPlan | null {
    return this.activePlan;
  }

  /**
   * Executes the full autonomous QA agent loop:
   * PLAN -> (EXECUTE -> OBSERVE -> REASON -> VERIFY) -> REPORT
   */
  public async runLoop(
    session: QASession,
    snapshot: PageSnapshot,
    onProgress: RunnerProgressCallback
  ): Promise<{ plan: TestPlan; findings: Finding[] }> {
    this.isPaused = false;
    this.isStopped = false;

    // 1. PLANNING Phase
    await onProgress({
      state: 'PLANNING',
      progress: 45,
      currentAction: `Synthesizing dynamic test plan for ${snapshot.url}...`,
    });

    const learned = await workflowLearner.getLearnedWorkflow(snapshot.url);
    let plan: TestPlan;
    if (learned && learned.actionSteps.length > 0) {
      logger.info(`Found learned workflow for ${snapshot.url} with ${learned.actionSteps.length} steps (Self-Reliance: ${Math.round(learned.selfRelianceRatio * 100)}%). Executing from autonomous memory.`);
      plan = workflowLearner.generateAutonomousPlan(learned, session.id);
      const freshPlan = this.planner.planTasks(snapshot, session.id, session.config);
      for (const t of freshPlan.tasks) {
        if (!plan.tasks.some((pt) => pt.targetSelector === t.targetSelector)) {
          plan.tasks.push(t);
        }
      }
    } else {
      plan = this.planner.planTasks(snapshot, session.id, session.config);
    }

    this.activePlan = plan;
    plan.status = 'IN_PROGRESS';

    const findings: Finding[] = [];
    const totalTasks = plan.tasks.length;
    let passedCount = 0;
    let failedCount = 0;
    let consecutiveNotFound = 0;

    // 2. Loop through planned tasks
    for (let i = 0; i < plan.tasks.length; i++) {
      if (this.isStopped) {
        plan.status = 'CANCELLED';
        break;
      }

      // Handle pause loop
      while (this.isPaused && !this.isStopped) {
        await new Promise((r) => setTimeout(r, 300));
      }

      const task = plan.tasks[i];
      const taskIndex = i + 1;
      const progressPercent = Math.round(50 + (taskIndex / totalTasks) * 35);

      // Step: EXECUTING
      task.status = 'RUNNING';
      await onProgress({
        state: 'EXECUTING',
        progress: progressPercent,
        currentAction: `[Task ${taskIndex}/${totalTasks}] ${task.title}`,
        currentTask: task,
      });

      const preState = await this.observer.capturePreState(session.tabId);
      const execResult = await this.executor.executeTask(session.tabId, task, {
        highlightFirst: true,
      });

      task.executionTimeMs = execResult.durationMs;

      if (execResult.error && execResult.error.toLowerCase().includes('not found')) {
        consecutiveNotFound++;
      } else {
        consecutiveNotFound = 0;
      }

      // Step: OBSERVING
      await onProgress({
        state: 'OBSERVING',
        progress: progressPercent,
        currentAction: `Observing DOM changes and runtime signals for ${task.title}...`,
        currentTask: task,
      });

      const obsResult = await this.observer.capturePostState(
        session.tabId,
        task.id,
        preState.url,
        350
      );

      // Step: REASONING
      await onProgress({
        state: 'REASONING',
        progress: progressPercent,
        currentAction: `Evaluating outcome against expectations for ${task.title}...`,
        currentTask: task,
      });

      let verdict = this.reasoner.evaluate(task, execResult, obsResult);

      // Phase 6: Local WebGPU AI Arbitration for ambiguous findings
      verdict = await this.aiReasoner.arbitrateVerdict(task, execResult, obsResult, verdict);
      task.verdict = verdict;

      // Step: VERIFYING (Autonomous Re-test on Failure)
      if (!verdict.passed && verdict.requiresVerification) {
        await onProgress({
          state: 'VERIFYING',
          progress: progressPercent,
          currentAction: `Verifying reproducibility of detected anomaly on ${task.title}...`,
          currentTask: task,
        });

        const verifyResult = await this.verifier.verifyBug(session.tabId, task, verdict, 1);

        if (verifyResult.confirmedFinding) {
          task.status = 'FAILED';
          failedCount++;

          const evidenceItems: import('../shared/types/qa').EvidenceItem[] = [
            {
              type: 'dom_snippet',
              description: `Target element for ${task.targetSelector}`,
              data: `<${task.targetElementInfo?.tag || 'element'} selector="${task.targetSelector}">`,
              timestamp: Date.now(),
            },
          ];

          for (const err of obsResult.consoleErrors) {
            evidenceItems.push({
              type: 'console_error',
              description: err.message,
              data: err,
              timestamp: err.timestamp || Date.now(),
            });
          }

          for (const net of obsResult.networkFailures) {
            evidenceItems.push({
              type: 'network_error',
              description: `${net.url} (${net.status})`,
              data: net,
              timestamp: Date.now(),
            });
          }

          // Create structured Finding
          const finding: Finding = {
            id: `finding_${session.id}_${task.id}`,
            sessionId: session.id,
            category: verdict.category || 'FUNCTIONAL',
            title: `${task.title} failed verification`,
            description: `${verdict.rationale} (${verifyResult.notes})`,
            status: 'FAIL',
            severity: verdict.severity || 'MEDIUM',
            confidence: verdict.confidence,
            page: session.url,
            selector: task.targetSelector,
            evidence: evidenceItems,
            steps: [`Locate element "${task.targetSelector}"`, `Execute ${task.type}`, 'Observe outcome and verification re-test'],
            expected: task.expectedOutcome,
            actual: verdict.rationale,
            recommendation: verdict.suggestedRemediation || 'Inspect and resolve interaction failure.',
            retestCount: verifyResult.reproductionAttempts,
            retestPassed: false,
            timestamp: Date.now(),
          };

          findings.push(finding);
          await sessionStore.saveFinding(finding);
        } else {
          // Re-test passed: mark as non-critical passed
          task.status = 'PASSED';
          passedCount++;
        }
      } else if (verdict.passed) {
        task.status = 'PASSED';
        passedCount++;
      } else {
        task.status = 'FAILED';
        failedCount++;
      }

      await onProgress({
        state: 'EXECUTING',
        progress: progressPercent,
        currentAction: `Completed task ${taskIndex}/${totalTasks} (${task.status})`,
        currentTask: task,
        statsUpdate: {
          testsExecuted: passedCount + failedCount,
          passedCount,
          failedCount,
        },
      });

      // If a TAB_CLICK successfully completed, dynamically inspect and fill any newly revealed forms/inputs in this tab view!
      if (task.type === 'TAB_CLICK' && execResult.success) {
        try {
          const tabScanRes = await sendToTab(session.tabId, 'SCAN_PAGE_DISCOVERY', {});
          const tabSnapshot = (tabScanRes as { snapshot?: PageSnapshot })?.snapshot;
          if (tabSnapshot && tabSnapshot.forms.length > 0) {
            for (const newForm of tabSnapshot.forms) {
              if (newForm.fields.length === 0) continue;
              const alreadyTested = plan.tasks.some(
                (t) => t.type === 'FORM_FILL' && t.targetSelector === newForm.selector
              );
              if (!alreadyTested) {
                const syntheticVals = this.planner.generateSyntheticValuesForForm(newForm);
                const subTaskId = `task_${session.id}_tabform_${Date.now()}`;
                const formFillTask: TestTask = {
                  id: subTaskId,
                  type: 'FORM_FILL',
                  title: newForm.isStandalone
                    ? `[${task.title}] Fill: ${newForm.name} (${newForm.fields.length} inputs)`
                    : `[${task.title}] Fill Form (${newForm.fields.length} fields)`,
                  description: `Fill inputs in newly loaded tab view using multi-lingual synthetic data`,
                  targetSelector: newForm.selector,
                  targetElementInfo: { tag: newForm.containerTag || 'form', name: newForm.name },
                  riskLevel: 'LOW',
                  expectedOutcome: 'Form inputs in tab receive synthetic values safely without client errors.',
                  inputData: syntheticVals,
                  status: 'RUNNING',
                };
                plan.tasks.push(formFillTask);

                await onProgress({
                  state: 'EXECUTING',
                  progress: progressPercent,
                  currentAction: `Populating inputs in tab view: ${newForm.name}...`,
                  currentTask: formFillTask,
                });

                const fillResult = await this.executor.executeTask(session.tabId, formFillTask, {
                  highlightFirst: true,
                });
                formFillTask.status = fillResult.success ? 'PASSED' : 'FAILED';
                if (fillResult.success) passedCount++; else failedCount++;

                // If submit/save button exists, test submission
                if (newForm.submitButtonSelector || !newForm.isStandalone) {
                  const submitSubTask: TestTask = {
                    id: `task_${session.id}_tabsubmit_${Date.now()}`,
                    type: 'FORM_SUBMIT',
                    title: `[${task.title}] Submit: ${newForm.name}`,
                    description: `Trigger save/submit on tab view`,
                    targetSelector: newForm.submitButtonSelector || newForm.selector,
                    riskLevel: 'LOW',
                    expectedOutcome: 'Tab form action dispatches without runtime errors.',
                    status: 'RUNNING',
                  };
                  plan.tasks.push(submitSubTask);
                  const submitRes = await this.executor.executeTask(session.tabId, submitSubTask);
                  submitSubTask.status = submitRes.success ? 'PASSED' : 'FAILED';
                  if (submitRes.success) passedCount++; else failedCount++;
                }
              }
            }
          }
        } catch (tabErr) {
          logger.debug('Tab content dynamic inspection ignored', tabErr);
        }
      }

      // If action navigated to another page, complete the current page's task plan cleanly
      const hasNavigated = obsResult.urlChanged || (obsResult.postUrl && preState.url && obsResult.postUrl !== preState.url);
      if (hasNavigated && i < plan.tasks.length - 1) {
        logger.info(`Navigation detected: ${preState.url} -> ${obsResult.postUrl}. Completing previous page plan.`);
        for (let j = i + 1; j < plan.tasks.length; j++) {
          if (plan.tasks[j].status === 'PENDING') {
            plan.tasks[j].status = 'SKIPPED';
          }
        }
        break;
      }

      // If multiple elements were missing consecutively, the view transitioned or changed
      if (consecutiveNotFound >= 3 && i < plan.tasks.length - 1) {
        logger.info(`Multiple consecutive elements not found (${consecutiveNotFound}). View transitioned; skipping remaining obsolete tasks.`);
        for (let j = i + 1; j < plan.tasks.length; j++) {
          if (plan.tasks[j].status === 'PENDING') {
            plan.tasks[j].status = 'SKIPPED';
          }
        }
        break;
      }
    }

    plan.status = this.isStopped ? 'CANCELLED' : 'COMPLETED';

    // 3. REPORTING Phase
    await onProgress({
      state: 'REPORTING',
      progress: 95,
      currentAction: `Assembling comprehensive QA report: ${passedCount} passed, ${failedCount} defects confirmed.`,
    });

    // 4. AUTONOMOUS LEARNING Phase: Persist verified working recipes into local knowledge base
    try {
      await workflowLearner.learnFromSession(session, plan, snapshot);
    } catch (learnErr) {
      logger.debug('Workflow learning step bypassed', learnErr);
    }

    return { plan, findings };
  }
}

export const agentRunner = new AgentRunner();
