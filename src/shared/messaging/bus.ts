import { ExtensionMessage, ExtensionResponse, MessageMap, MessageType } from '../types/messages';
import { DEFAULT_MESSAGE_TIMEOUT_MS } from '../constants/defaults';
import { createLogger } from '../logger/logger';

const logger = createLogger('MessageBus');

export class MessageBusError extends Error {
  public code: string;
  constructor(message: string, code = 'MESSAGE_BUS_ERROR') {
    super(message);
    this.name = 'MessageBusError';
    this.code = code;
  }
}

/**
 * Send a strongly-typed message to the background service worker.
 */
export async function sendToBackground<T extends MessageType>(
  type: T,
  payload: MessageMap[T]['request'],
  timeoutMs: number = DEFAULT_MESSAGE_TIMEOUT_MS
): Promise<MessageMap[T]['response']> {
  const message: ExtensionMessage<T> = {
    type,
    payload,
    sender: 'sidepanel',
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return reject(new MessageBusError('chrome.runtime.sendMessage is not available in current environment', 'ENV_NOT_SUPPORTED'));
    }

    let isResolved = false;
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new MessageBusError(`Message ${type} timed out after ${timeoutMs}ms`, 'TIMEOUT'));
      }
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage(message, (rawResponse: ExtensionResponse<T>) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timer);

        if (chrome.runtime.lastError) {
          logger.warn(`chrome.runtime.lastError for ${type}: ${chrome.runtime.lastError.message}`);
          return reject(new MessageBusError(chrome.runtime.lastError.message || 'Unknown runtime error', 'RUNTIME_ERROR'));
        }

        if (!rawResponse) {
          return reject(new MessageBusError(`No response received for message ${type}`, 'NO_RESPONSE'));
        }

        if (!rawResponse.success) {
          return reject(new MessageBusError(rawResponse.error || `Request failed for ${type}`, 'OPERATION_FAILED'));
        }

        resolve(rawResponse.data as MessageMap[T]['response']);
      });
    } catch (err) {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        reject(err instanceof Error ? err : new MessageBusError(String(err)));
      }
    }
  });
}

/**
 * Ensures the content script is actively injected and listening on the target tab.
 * Dynamically injects src/content/index.js if tab was loaded prior to extension installation.
 */
export async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return false;
  }

  // 1. Check if content script is already responding
  const isAlreadyResponding = await new Promise<boolean>((resolve) => {
    try {
      chrome.tabs.sendMessage(
        tabId,
        {
          type: 'CONTENT_SCRIPT_PING',
          sender: 'background',
          messageId: `ping_${Date.now()}`,
          timestamp: Date.now(),
        },
        (res) => {
          if (chrome.runtime.lastError || !res) {
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    } catch {
      resolve(false);
    }
  });

  if (isAlreadyResponding) {
    return true;
  }

  // 2. If not responding, dynamically inject using chrome.scripting
  if (typeof chrome.scripting !== 'undefined' && chrome.scripting.executeScript) {
    try {
      logger.info(`Dynamically injecting content script into tab ${tabId}...`);
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/index.js'],
      });
      // Allow brief delay for DOM listeners and state observer to bind
      await new Promise((r) => setTimeout(r, 200));
      return true;
    } catch (err) {
      logger.warn(`Could not dynamically inject content script into tab ${tabId}:`, err);
      return false;
    }
  }

  return false;
}

/**
 * Send a strongly-typed message to a specific content script tab.
 * Automatically attempts dynamic content script injection if receiving end is missing.
 */
export async function sendToTab<T extends MessageType>(
  tabId: number,
  type: T,
  payload: MessageMap[T]['request'],
  timeoutMs: number = DEFAULT_MESSAGE_TIMEOUT_MS,
  hasRetried = false
): Promise<MessageMap[T]['response']> {
  const message: ExtensionMessage<T> = {
    type,
    payload,
    sender: 'background',
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.sendMessage) {
      return reject(new MessageBusError('chrome.tabs.sendMessage is not available', 'ENV_NOT_SUPPORTED'));
    }

    let isResolved = false;
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new MessageBusError(`Message ${type} to tab ${tabId} timed out after ${timeoutMs}ms`, 'TIMEOUT'));
      }
    }, timeoutMs);

    try {
      chrome.tabs.sendMessage(tabId, message, async (rawResponse: ExtensionResponse<T>) => {
        if (isResolved) return;

        const lastError = chrome.runtime.lastError;
        if (lastError) {
          const errMsg = lastError.message || '';
          // If receiving end does not exist and haven't retried yet, inject content script & retry
          if (
            !hasRetried &&
            (errMsg.includes('Receiving end does not exist') ||
              errMsg.includes('Could not establish connection') ||
              errMsg.includes('message port closed'))
          ) {
            clearTimeout(timer);
            isResolved = true;
            logger.info(`Receiving end missing on tab ${tabId}. Attempting auto-injection and retry for ${type}...`);
            const injected = await ensureContentScriptInjected(tabId);
            if (injected) {
              try {
                const retryRes = await sendToTab(tabId, type, payload, timeoutMs, true);
                return resolve(retryRes);
              } catch (retryErr) {
                return reject(retryErr);
              }
            }
          }

          isResolved = true;
          clearTimeout(timer);
          return reject(new MessageBusError(errMsg || 'Tab runtime error', 'TAB_ERROR'));
        }

        isResolved = true;
        clearTimeout(timer);

        if (!rawResponse) {
          return reject(new MessageBusError(`No response received from tab ${tabId} for ${type}`, 'NO_RESPONSE'));
        }

        if (!rawResponse.success) {
          return reject(new MessageBusError(rawResponse.error || `Tab request failed for ${type}`, 'OPERATION_FAILED'));
        }

        resolve(rawResponse.data as MessageMap[T]['response']);
      });
    } catch (err) {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        reject(err instanceof Error ? err : new MessageBusError(String(err)));
      }
    }
  });
}

