import { ObservationResult } from '../shared/types/agent';
import { sendToTab } from '../shared/messaging/bus';
import { ConsoleErrorItem } from '../qa/console-tester';
import { NetworkFailureItem } from '../qa/network-tester';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('AgentObserver');

interface TabStateResponse {
  currentUrl: string;
  title: string;
  domMutationsCount: number;
  modalDetected: boolean;
  toastAlertDetected: boolean;
  alertType?: 'error' | 'success' | 'warning' | 'info';
  alertMessage?: string;
  consoleErrors: ConsoleErrorItem[];
  networkFailures: NetworkFailureItem[];
}

export class AgentObserver {
  /**
   * Captures initial pre-action baseline and resets mutation counter.
   */
  public async capturePreState(tabId: number): Promise<{ url: string; timestamp: number }> {
    try {
      const res = await sendToTab(tabId, 'OBSERVE_STATE', { resetBaseline: true });
      const currentUrl = (res as TabStateResponse)?.currentUrl || '';
      return {
        url: currentUrl,
        timestamp: Date.now(),
      };
    } catch (err) {
      logger.debug('Failed to capture pre-state', err);
      return {
        url: '',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Captures post-action state after a brief DOM settling delay.
   */
  public async capturePostState(
    tabId: number,
    taskId: string,
    preUrl: string,
    settleDelayMs: number = 350
  ): Promise<ObservationResult> {
    if (settleDelayMs > 0) {
      await new Promise((r) => setTimeout(r, settleDelayMs));
    }

    try {
      const res = await sendToTab(tabId, 'OBSERVE_STATE', { resetBaseline: false });
      const state = res as TabStateResponse | undefined;

      const postUrl = state?.currentUrl || preUrl;
      const urlChanged = Boolean(preUrl && postUrl && preUrl !== postUrl);

      const modalAppeared = Boolean(state?.modalDetected);
      const alertAppeared = Boolean(state?.toastAlertDetected);
      const errorAlertAppeared = alertAppeared && state?.alertType === 'error';
      const successAlertAppeared = alertAppeared && state?.alertType === 'success';

      return {
        taskId,
        preUrl,
        postUrl,
        urlChanged,
        domMutationsCount: state?.domMutationsCount ?? 0,
        modalAppeared,
        errorAlertAppeared,
        successAlertAppeared,
        alertMessage: state?.alertMessage,
        consoleErrors: state?.consoleErrors || [],
        networkFailures: state?.networkFailures || [],
        timestamp: Date.now(),
      };
    } catch (err) {
      logger.info(`Tab state observation intercepted or page navigated for task ${taskId}:`, err);

      let actualUrl = preUrl;
      let urlChanged = false;
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.get) {
          const tab = await chrome.tabs.get(tabId);
          if (tab && tab.url) {
            actualUrl = tab.url;
            urlChanged = Boolean(preUrl && actualUrl && preUrl !== actualUrl);
          }
        }
      } catch {}

      return {
        taskId,
        preUrl,
        postUrl: actualUrl,
        urlChanged,
        domMutationsCount: urlChanged ? 1 : 0,
        modalAppeared: false,
        errorAlertAppeared: false,
        successAlertAppeared: false,
        consoleErrors: [],
        networkFailures: [],
        timestamp: Date.now(),
      };
    }
  }
}

export const agentObserver = new AgentObserver();
