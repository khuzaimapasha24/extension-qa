import { initMessageRouter } from './message-router';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('ServiceWorker');

// Initialize the message router
initMessageRouter();

// On extension install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info(`Extension installed/updated. Reason: ${details.reason}`);

  // Configure Side Panel to automatically open when the user clicks the extension action icon
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      logger.info('Side panel configured to open on action click.');
    } catch (err) {
      logger.warn('Failed to set side panel behavior', err);
    }
  }
});

logger.info('Background Service Worker loaded and active.');
