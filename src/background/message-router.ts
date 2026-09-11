import { ExtensionMessage, ExtensionResponse, MessageMap, MessageType } from '../shared/types/messages';
import { sessionManager } from './session-manager';
import { settingsStore } from '../storage/settings-store';
import { sessionStore } from '../storage/session-store';
import { sendToTab } from '../shared/messaging/bus';
import { captureTabScreenshot, cropScreenshotToElement } from '../evidence/screenshot';
import { CropRegion } from '../shared/types/qa';
import { createLogger } from '../shared/logger/logger';
import { getActiveInspectableTab } from './permissions-manager';
import { cloudLlmClient } from '../ai/cloud-llm-client';

const logger = createLogger('MessageRouter');

export function initMessageRouter() {
  // Listen for session state changes and broadcast them to runtime listeners
  sessionManager.addListener((session) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'SESSION_STATE_UPDATED',
          payload: { session },
          sender: 'background',
          timestamp: Date.now(),
        }).catch(() => {
          // No active listener (e.g. side panel not open), ignore
        });
      }
    } catch {
      // Ignore background messaging exceptions when sidepanel is closed
    }
  });

  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) {
    logger.warn('chrome.runtime.onMessage not available. Message router not attached.');
    return;
  }

  chrome.runtime.onMessage.addListener(
    (
      rawMessage: ExtensionMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: ExtensionResponse) => void
    ) => {
      // Must return true to indicate asynchronous response
      handleMessage(rawMessage, sender)
        .then((data) => {
          sendResponse({ success: true, data });
        })
        .catch((err) => {
          logger.error(`Handler failed for message ${rawMessage?.type}: ${err instanceof Error ? err.message : String(err)}`);
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        });

      return true;
    }
  );

  logger.info('Message router initialized successfully');
}

async function handleMessage<T extends MessageType>(
  message: ExtensionMessage<T>,
  _sender: chrome.runtime.MessageSender
): Promise<MessageMap[T]['response']> {
  if (!message || !message.type) {
    throw new Error('Malformed message received: missing type');
  }

  logger.debug(`Received message: ${message.type}`);

  switch (message.type) {
    case 'PING': {
      return {
        pong: true,
        timestamp: Date.now(),
      } as MessageMap[T]['response'];
    }

    case 'GET_ACTIVE_TAB_INFO': {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const activeTab = await getActiveInspectableTab();
        if (activeTab) {
          return {
            tabId: activeTab.id,
            url: activeTab.url,
            title: activeTab.title,
          } as MessageMap[T]['response'];
        }
      }
      return { tabId: undefined, url: '', title: '' } as MessageMap[T]['response'];
    }

    case 'TEST_LLM_KEY': {
      const payload = message.payload as MessageMap['TEST_LLM_KEY']['request'];
      const result = await cloudLlmClient.testApiKey(payload.provider, payload.apiKey, payload.model);
      return result as MessageMap[T]['response'];
    }

    case 'START_SESSION': {
      const payload = message.payload as MessageMap['START_SESSION']['request'];
      const session = await sessionManager.startSession(payload.tabId, payload.config);
      // Trigger full autonomous QA pipeline (Discovery + Deterministic QA + Autonomous Interactive Loop)
      sessionManager.runFullQA().catch((err) => {
        logger.error('Error during automatic QA execution trigger', err);
      });
      return { session } as MessageMap[T]['response'];
    }

    case 'STOP_SESSION': {
      const payload = message.payload as MessageMap['STOP_SESSION']['request'];
      const success = await sessionManager.stopSession(payload.sessionId);
      return { success } as MessageMap[T]['response'];
    }

    case 'PAUSE_SESSION': {
      const payload = message.payload as MessageMap['PAUSE_SESSION']['request'];
      const success = await sessionManager.pauseSession(payload.sessionId);
      return { success } as MessageMap[T]['response'];
    }

    case 'RESUME_SESSION': {
      const payload = message.payload as MessageMap['RESUME_SESSION']['request'];
      const success = await sessionManager.resumeSession(payload.sessionId);
      return { success } as MessageMap[T]['response'];
    }

    case 'GET_CURRENT_SESSION': {
      const session = sessionManager.getCurrentSession();
      return { session } as MessageMap[T]['response'];
    }

    case 'GET_SETTINGS': {
      const settings = await settingsStore.getSettings();
      return { settings } as MessageMap[T]['response'];
    }

    case 'GET_DISCOVERY_MAP': {
      const map = sessionManager.getDiscoveryMap();
      return { map } as MessageMap[T]['response'];
    }

    case 'GET_FLOW_ANALYSIS': {
      const flowAnalysis = sessionManager.getFlowAnalysis();
      return { flowAnalysis } as MessageMap[T]['response'];
    }

    case 'UPDATE_SETTINGS': {
      const payload = message.payload as MessageMap['UPDATE_SETTINGS']['request'];
      await settingsStore.updateSettings(payload.settings);
      return { success: true } as MessageMap[T]['response'];
    }

    case 'FINDING_DETECTED': {
      const payload = message.payload as MessageMap['FINDING_DETECTED']['request'];
      await sessionStore.saveFinding(payload.finding);
      return { id: payload.finding.id } as MessageMap[T]['response'];
    }

    case 'CAPTURE_SCREENSHOT': {
      const payload = message.payload as MessageMap['CAPTURE_SCREENSHOT']['request'];
      const targetTabId = payload.tabId || sessionManager.getCurrentSession()?.tabId;
      const fullDataUrl = await captureTabScreenshot(targetTabId, payload.quality);
      if (!fullDataUrl) {
        throw new Error('Failed to capture tab screenshot');
      }

      if (payload.cropSelector && targetTabId) {
        try {
          const hl = await sendToTab(targetTabId, 'HIGHLIGHT_ELEMENT', {
            selector: payload.cropSelector,
            durationMs: 2000,
          });
          const rect = (hl as { rect?: CropRegion })?.rect;
          if (rect) {
            const cropped = await cropScreenshotToElement(fullDataUrl, rect);
            return {
              dataUrl: cropped.dataUrl,
              width: cropped.width,
              height: cropped.height,
              cropRegion: cropped.cropRegion,
            } as MessageMap[T]['response'];
          }
        } catch {
          // Fallback to full screenshot
        }
      }

      return {
        dataUrl: fullDataUrl,
        width: 1280,
        height: 800,
      } as MessageMap[T]['response'];
    }

    case 'HIGHLIGHT_ELEMENT': {
      const payload = message.payload as MessageMap['HIGHLIGHT_ELEMENT']['request'];
      const currentSession = sessionManager.getCurrentSession();
      const tabId = currentSession?.tabId || 1;
      const response = await sendToTab(tabId, 'HIGHLIGHT_ELEMENT', payload);
      return response as MessageMap[T]['response'];
    }

    case 'CLEAR_HIGHLIGHTS': {
      const currentSession = sessionManager.getCurrentSession();
      const tabId = currentSession?.tabId || 1;
      const response = await sendToTab(tabId, 'CLEAR_HIGHLIGHTS', {});
      return response as MessageMap[T]['response'];
    }

    default:
      throw new Error(`Unhandled message type: ${message.type}`);
  }
}
