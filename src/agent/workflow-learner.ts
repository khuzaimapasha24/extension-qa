import { dbClient } from '../storage/indexed-db';
import { LearnedWorkflowRecord } from '../shared/types/storage';
import { TestPlan, TestTask } from '../shared/types/agent';
import { PageSnapshot } from '../shared/types/discovery';
import { QASession } from '../shared/types/session';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('WorkflowLearner');

/**
 * Autonomous Workflow Memory & Self-Learning Engine:
 * Continuously records working selectors, form schemas, and action sequences during AI testing.
 * On subsequent visits, it executes from local memory, eliminating the need for external AI APIs!
 */
export class WorkflowLearner {
  /**
   * Generates a stable key for a URL (origin + pathname).
   */
  public generateWorkflowKey(url: string): { id: string; origin: string; path: string } {
    try {
      const parsed = new URL(url);
      const origin = parsed.origin;
      const path = parsed.pathname || '/';
      const id = `${origin}#${path}`.toLowerCase();
      return { id, origin, path };
    } catch {
      return { id: url, origin: url, path: '/' };
    }
  }

  /**
   * Learns from a completed session and its executed plan.
   * Records passed tasks, working selectors, and verified form payloads into IndexedDB.
   */
  public async learnFromSession(
    _session: QASession,
    plan: TestPlan,
    snapshot: PageSnapshot
  ): Promise<LearnedWorkflowRecord | null> {
    try {
      const { id, origin, path } = this.generateWorkflowKey(snapshot.url);
      const existing = (await dbClient.get('learned_workflows', id)) as LearnedWorkflowRecord | null;

      const learnedSelectors = existing?.learnedSelectors || {};
      const formPresets = existing?.formPresets || {};
      const actionSteps: LearnedWorkflowRecord['actionSteps'] = [];

      for (const task of plan.tasks) {
        if (task.status === 'PASSED') {
          // Record working selector
          const selectorKey = task.title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
          if (task.targetSelector) {
            const current = learnedSelectors[selectorKey] || {
              primary: task.targetSelector,
              fallbacks: [],
              role: task.targetElementInfo?.tag || 'element',
              successCount: 0,
            };

            current.successCount += 1;
            if (current.primary !== task.targetSelector && !current.fallbacks.includes(task.targetSelector)) {
              current.fallbacks.push(task.targetSelector);
            }
            learnedSelectors[selectorKey] = current;
          }

          // Record valid form inputs
          if (task.type === 'FORM_FILL' && task.inputData) {
            formPresets[task.targetSelector] = {
              ...(formPresets[task.targetSelector] || {}),
              ...task.inputData,
            };
          }

          // Record action step in sequence
          if (task.targetSelector) {
            actionSteps.push({
              type: task.type as any,
              selector: task.targetSelector,
              value: task.inputData ? Object.values(task.inputData)[0] : undefined,
              label: task.title,
            });
          }
        }
      }

      const totalExecutions = (existing?.executionCount || 0) + 1;
      const totalAutonomous = (existing?.autonomousSuccessCount || 0) + 1;
      const selfRelianceRatio = totalExecutions > 0 ? Number((totalAutonomous / totalExecutions).toFixed(2)) : 1.0;

      const record: LearnedWorkflowRecord = {
        id,
        origin,
        url: snapshot.url,
        path,
        title: snapshot.title || existing?.title || 'Autonomous Route',
        learnedSelectors,
        formPresets,
        actionSteps: actionSteps.length > 0 ? actionSteps : existing?.actionSteps || [],
        executionCount: totalExecutions,
        autonomousSuccessCount: totalAutonomous,
        lastVerified: Date.now(),
        selfRelianceRatio,
      };

      await dbClient.put('learned_workflows', record);
      logger.info(`Learned and cached workflow for ${id} (Self-Reliance: ${Math.round(selfRelianceRatio * 100)}%)`);
      return record;
    } catch (err) {
      logger.warn('Failed to record learned workflow:', err);
      return null;
    }
  }

  /**
   * Retrieves a learned workflow for the specified URL if previously cached.
   */
  public async getLearnedWorkflow(url: string): Promise<LearnedWorkflowRecord | null> {
    try {
      const { id } = this.generateWorkflowKey(url);
      const record = (await dbClient.get('learned_workflows', id)) as LearnedWorkflowRecord | null;
      return record;
    } catch {
      return null;
    }
  }

  /**
   * Generates an autonomous, zero-AI TestPlan from previously learned memory.
   * Completely bypasses external AI API calls!
   */
  public generateAutonomousPlan(
    workflow: LearnedWorkflowRecord,
    sessionId: string
  ): TestPlan {
    const tasks: TestTask[] = [];
    let counter = 0;

    for (const step of workflow.actionSteps) {
      counter++;
      const inputData = step.type === 'FORM_FILL' ? workflow.formPresets[step.selector] : undefined;

      tasks.push({
        id: `learned_task_${sessionId}_${counter}`,
        type: step.type as any,
        title: step.label || `[Learned Memory] ${step.type} on ${step.selector}`,
        description: `Executed autonomously from local workflow memory (Zero AI API Call)`,
        targetSelector: step.selector,
        targetElementInfo: { tag: 'learned', text: step.label },
        riskLevel: 'LOW',
        expectedOutcome: 'Step completes autonomously based on proven learned golden path.',
        inputData,
        status: 'PENDING',
      });
    }

    return {
      id: `plan_learned_${sessionId}_${Date.now()}`,
      sessionId,
      pageUrl: workflow.url,
      tasks,
      status: 'PENDING',
      createdAt: Date.now(),
    };
  }

  /**
   * Increments the autonomous success counter when a workflow runs without AI.
   */
  public async recordAutonomousSuccess(workflowId: string): Promise<void> {
    try {
      const record = (await dbClient.get('learned_workflows', workflowId)) as LearnedWorkflowRecord | null;
      if (record) {
        record.executionCount += 1;
        record.autonomousSuccessCount += 1;
        record.lastVerified = Date.now();
        record.selfRelianceRatio = Number((record.autonomousSuccessCount / record.executionCount).toFixed(2));
        await dbClient.put('learned_workflows', record);
        logger.info(`Autonomous execution succeeded for ${workflowId}. Self-reliance: ${Math.round(record.selfRelianceRatio * 100)}%`);
      }
    } catch (err) {
      logger.debug('Failed to record autonomous success', err);
    }
  }

  /**
   * Retrieves all learned workflows across all sites.
   */
  public async getAllLearnedWorkflows(): Promise<LearnedWorkflowRecord[]> {
    try {
      return (await dbClient.getAll('learned_workflows')) as LearnedWorkflowRecord[];
    } catch {
      return [];
    }
  }
}

export const workflowLearner = new WorkflowLearner();
