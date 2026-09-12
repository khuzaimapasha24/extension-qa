import { TestTask } from '../shared/types/agent';
import { sendToTab } from '../shared/messaging/bus';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('AgentExecutor');

export interface ExecutionResult {
  success: boolean;
  durationMs: number;
  error?: string;
  actionDetails?: string;
}

export class AgentExecutor {
  /**
   * Executes a single TestTask on the target tab via content script messaging.
   */
  public async executeTask(
    tabId: number,
    task: TestTask,
    options: { highlightFirst?: boolean; maxRetries?: number } = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const highlightFirst = options.highlightFirst !== false;
    const maxRetries = options.maxRetries ?? 1;

    // Safety check: HIGH risk actions cannot execute without prior authorization
    if (task.riskLevel === 'HIGH' && !task.approvedByUser) {
      logger.warn(`HIGH risk task ${task.id} skipped for automated safety`);
      return {
        success: false,
        durationMs: 0,
        error: 'Task classified as HIGH risk and blocked from automated execution for user safety.',
      };
    }

    // Optional visual highlight before interaction
    if (highlightFirst && task.targetSelector) {
      try {
        await sendToTab(tabId, 'HIGHLIGHT_ELEMENT', {
          selector: task.targetSelector,
          durationMs: 600,
          label: task.title,
        });
      } catch (e) {
        logger.debug('Highlight element before action ignored', e);
      }
    }

    let attempt = 0;
    let lastError: string | undefined;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        if (task.type === 'FORM_FILL' && task.inputData) {
          // Fill each field sequentially
          const entries = Object.entries(task.inputData);
          let filledCount = 0;
          const errors: string[] = [];

          for (const [fieldSelector, val] of entries) {
            // Extract field-specific hint from selector if possible
            let fieldHint = '';
            const match = fieldSelector.match(/(?:#|name=|[_-])([a-zA-Z]{3,})/);
            if (match && match[1]) {
              fieldHint = match[1];
            }

            const fillRes = await sendToTab(tabId, 'EXECUTE_ACTION', {
              action: 'FILL',
              selector: fieldSelector,
              value: val,
              options: {
                textHint: fieldHint || task.targetElementInfo?.name || task.targetElementInfo?.text,
                tagHint: 'input, textarea, select',
              },
            });

            if (!fillRes || (fillRes as { executed?: boolean }).executed === false) {
              const err = (fillRes as { error?: string })?.error || `Failed to fill ${fieldSelector}`;
              errors.push(err);
            } else {
              filledCount++;
            }
          }

          if (filledCount === 0 && entries.length > 0) {
            throw new Error(errors[0] || `Failed to fill form inputs`);
          }

          return {
            success: true,
            durationMs: Date.now() - startTime,
            actionDetails: `Filled ${filledCount}/${entries.length} form inputs${errors.length > 0 ? ` (${errors.length} skipped)` : ''}`,
          };
        } else if (task.type === 'FORM_SUBMIT') {
          const submitRes = await sendToTab(tabId, 'EXECUTE_ACTION', {
            action: 'SUBMIT',
            selector: task.targetSelector,
            options: {
              textHint: task.targetElementInfo?.text,
              tagHint: 'form, button',
            },
          });

          if (!submitRes || (submitRes as { executed?: boolean }).executed === false) {
            const err = (submitRes as { error?: string })?.error || 'Submit action failed';
            if (err.toLowerCase().includes('disabled')) {
              logger.info(`Submit trigger was disabled by application validation guard: ${task.targetSelector}`);
              return {
                success: true,
                durationMs: Date.now() - startTime,
                actionDetails: `Form submit trigger disabled (application validation guard): ${task.targetSelector}`,
              };
            }
            throw new Error(err);
          }

          return {
            success: true,
            durationMs: Date.now() - startTime,
            actionDetails: `Submitted form: ${task.targetSelector}`,
          };
        } else if (task.type === 'TAB_CLICK') {
          const clickRes = await sendToTab(tabId, 'EXECUTE_ACTION', {
            action: 'CLICK',
            selector: task.targetSelector,
            options: {
              textHint: task.targetElementInfo?.text,
              tagHint: 'button, [role="tab"], [role="menuitem"], a, li',
            },
          });

          if (!clickRes || (clickRes as { executed?: boolean }).executed === false) {
            const err = (clickRes as { error?: string })?.error || 'Tab click action failed';
            throw new Error(err);
          }

          // Allow view transition to settle
          await new Promise((r) => setTimeout(r, 250));

          return {
            success: true,
            durationMs: Date.now() - startTime,
            actionDetails: `Switched tab: ${task.title}`,
          };
        } else if (task.type === 'INPUT_ENTRY') {
          const val = task.inputData ? Object.values(task.inputData)[0] : 'QA Test Input';
          const fillRes = await sendToTab(tabId, 'EXECUTE_ACTION', {
            action: 'FILL',
            selector: task.targetSelector,
            value: val,
            options: {
              textHint: task.targetElementInfo?.text || task.targetElementInfo?.name,
              tagHint: 'input, textarea, select',
            },
          });

          if (!fillRes || (fillRes as { executed?: boolean }).executed === false) {
            const err = (fillRes as { error?: string })?.error || 'Input fill failed';
            throw new Error(err);
          }

          return {
            success: true,
            durationMs: Date.now() - startTime,
            actionDetails: `Entered value in ${task.targetSelector}`,
          };
        } else if (task.type === 'BUTTON_CLICK' || task.type === 'LINK_CLICK' || task.type === 'NAVIGATION') {
          const clickRes = await sendToTab(tabId, 'EXECUTE_ACTION', {
            action: 'CLICK',
            selector: task.targetSelector,
            options: {
              textHint: task.targetElementInfo?.text,
              tagHint: task.targetElementInfo?.tag,
            },
          });

          if (!clickRes || (clickRes as { executed?: boolean }).executed === false) {
            const err = (clickRes as { error?: string })?.error || 'Click action failed';
            if (err.toLowerCase().includes('disabled')) {
              logger.info(`Target element was disabled by application validation guard: ${task.targetSelector}`);
              return {
                success: true,
                durationMs: Date.now() - startTime,
                actionDetails: `Element disabled (application validation guard): ${task.targetSelector}`,
              };
            }
            throw new Error(err);
          }

          return {
            success: true,
            durationMs: Date.now() - startTime,
            actionDetails: `Clicked element: ${task.targetSelector}`,
          };
        } else {
          throw new Error(`Unsupported task type: ${task.type}`);
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn(`Attempt ${attempt} for task ${task.id} failed: ${lastError}`);
        if (attempt <= maxRetries) {
          // Brief pause before retry
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    }

    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: lastError || 'Execution failed after retries',
    };
  }
}

export const agentExecutor = new AgentExecutor();
