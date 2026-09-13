import { ExtensionMessage, ExtensionResponse } from '../shared/types/messages';
import { PageSnapshot } from '../shared/types/discovery';
import { extractPageMetadata, extractImages } from './dom-scanner';
import {
  extractLinks,
  extractButtons,
  extractForms,
  extractNavigations,
  extractTabsAndNavigationItems,
} from './element-detector';
import { spaObserver } from './spa-observer';
import { highlightElement, clearHighlights } from './dom-highlighter';
import { consoleRecorder } from './console-recorder';
import { networkRecorder } from './network-recorder';
import { mutationTracker } from './mutation-tracker';
import { simulateClick, simulateFill, simulateFormSubmit } from './action-simulator';
import { injectInterceptorIntoPage } from './injected-interceptor';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('ContentScript');

logger.info(`AI Website QA Agent content script active on ${window.location.href}`);

// Inject in-page fetch/XHR interceptor into the host DOM
injectInterceptorIntoPage();

// Start SPA route observer, runtime recorders, and DOM mutation tracker
spaObserver.start();
consoleRecorder.start();
networkRecorder.start();
mutationTracker.start();

/**
 * Builds a comprehensive structural snapshot of the current DOM.
 */
export function buildPageSnapshot(doc: Document = document): PageSnapshot {
  const url = window.location.href;
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const title = doc.title || '';

  const metadata = extractPageMetadata(doc);
  const links = extractLinks(doc, origin);
  const buttons = extractButtons(doc);
  const forms = extractForms(doc);
  const tabs = extractTabsAndNavigationItems(doc);
  const images = extractImages(doc);
  const navigations = extractNavigations(doc);

  const totalInteractiveCount = links.length + buttons.length + forms.length + tabs.length;

  return {
    url,
    origin,
    pathname,
    title,
    metadata,
    links,
    buttons,
    forms,
    tabs,
    images,
    navigations,
    totalInteractiveCount,
    timestamp: Date.now(),
  };
}

// Register message listeners
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void
  ) => {
    if (message.type === 'CONTENT_SCRIPT_PING' || message.type === 'PING') {
      sendResponse({
        success: true,
        data: {
          ready: true,
          url: window.location.href,
          title: document.title,
        },
      });
      return false;
    }

    if (message.type === 'SCAN_PAGE_DISCOVERY') {
      try {
        const snapshot = buildPageSnapshot(document);
        logger.info(`Scanned DOM: ${snapshot.links.length} links, ${snapshot.buttons.length} buttons, ${snapshot.forms.length} forms, ${snapshot.images.length} images`);
        sendResponse({
          success: true,
          data: { snapshot },
        });
      } catch (err) {
        logger.error('Failed to scan page discovery', err);
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return false;
    }

    if (message.type === 'HIGHLIGHT_ELEMENT') {
      try {
        const payload = message.payload as { selector: string; durationMs?: number; label?: string };
        const result = highlightElement(payload.selector, payload.label, payload.durationMs);
        sendResponse({
          success: true,
          data: {
            highlighted: result.highlighted,
            rect: result.rect,
          },
        });
      } catch (err) {
        logger.debug('Failed to highlight element', err);
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return false;
    }

    if (message.type === 'CLEAR_HIGHLIGHTS') {
      try {
        clearHighlights();
        sendResponse({
          success: true,
          data: { cleared: true },
        });
      } catch (err) {
        sendResponse({ success: false, error: String(err) });
      }
      return false;
    }

    if (message.type === 'GET_RUNTIME_OBSERVER_DATA') {
      try {
        sendResponse({
          success: true,
          data: {
            consoleErrors: consoleRecorder.getCapturedErrors(),
            networkFailures: networkRecorder.getCapturedFailures(),
          },
        });
      } catch (err) {
        sendResponse({ success: false, error: String(err) });
      }
      return false;
    }

    if (message.type === 'EXECUTE_ACTION') {
      (async () => {
        const startTime = Date.now();
        const payload = message.payload as {
          action: 'CLICK' | 'FILL' | 'SUBMIT';
          selector: string;
          value?: string;
          values?: Record<string, string>;
          options?: { timeoutMs?: number; waitForNavigation?: boolean };
        };

        try {
          if (payload.action === 'CLICK') {
            await simulateClick(payload.selector, {
              allowDisabled: true,
              ...payload.options,
            });
          } else if (payload.action === 'FILL') {
            await simulateFill(payload.selector, payload.value || '', payload.options);
          } else if (payload.action === 'SUBMIT') {
            await simulateFormSubmit(payload.selector, payload.options);
          } else {
            throw new Error(`Unknown action: ${payload.action}`);
          }

          sendResponse({
            success: true,
            data: {
              executed: true,
              actionType: payload.action,
              selector: payload.selector,
              durationMs: Date.now() - startTime,
            },
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.toLowerCase().includes('disabled')) {
            logger.info(`Action element is disabled by application design (${payload.action} on ${payload.selector})`);
            sendResponse({
              success: true,
              data: {
                executed: true,
                wasDisabled: true,
                actionType: payload.action,
                selector: payload.selector,
                durationMs: Date.now() - startTime,
              },
            });
            return;
          }

          logger.info(`Action execution did not complete: ${payload.action} on ${payload.selector} (${errMsg})`);
          sendResponse({
            success: false,
            error: errMsg,
            data: {
              executed: false,
              actionType: payload.action,
              selector: payload.selector,
              durationMs: Date.now() - startTime,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      })();
      return true;
    }

    if (message.type === 'OBSERVE_STATE') {
      try {
        const payload = message.payload as { resetBaseline?: boolean };
        if (payload?.resetBaseline) {
          mutationTracker.resetBaseline();
        }

        const snapshot = mutationTracker.getObservationSnapshot(document);
        sendResponse({
          success: true,
          data: {
            currentUrl: window.location.href,
            title: document.title,
            domMutationsCount: snapshot.domMutationsCount,
            modalDetected: snapshot.modalDetected,
            toastAlertDetected: snapshot.toastAlertDetected,
            alertType: snapshot.alertType,
            alertMessage: snapshot.alertMessage,
            consoleErrors: consoleRecorder.getCapturedErrors(),
            networkFailures: networkRecorder.getCapturedFailures(),
          },
        });
      } catch (err) {
        sendResponse({ success: false, error: String(err) });
      }
      return false;
    }

    if (message.type === 'GET_LIVE_NETWORK_TRANSACTIONS') {
      try {
        const payload = message.payload as { sinceTimestamp?: number };
        const since = payload?.sinceTimestamp || 0;
        const txs = since > 0 ? networkRecorder.getRecentTransactions(since) : networkRecorder.getCapturedTransactions();
        sendResponse({
          success: true,
          data: {
            transactions: txs,
            hasMutations: networkRecorder.hasSuccessfulMutation(since),
          },
        });
      } catch (err) {
        sendResponse({ success: false, error: String(err) });
      }
      return false;
    }

    return false;
  }
);
