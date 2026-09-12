import { createLogger } from '../shared/logger/logger';
import { sendToTab } from '../shared/messaging/bus';
import { ActionOptions } from '../content/action-simulator';

const logger = createLogger('BrowserController');

export interface BrowserActionStatus {
  success: boolean;
  action: string;
  target?: string;
  details?: string;
  error?: string;
  durationMs: number;
}

export interface FileAttachmentOptions {
  fileName?: string;
  fileContent?: string;
  mimeType?: string;
}

/**
 * Universal Browser Controller:
 * Gives the QA Agent comprehensive programmatic control over Google Chrome:
 * - Human-grade Mouse & Pointer Actions (Clicks, Hovers, Multi-tier Selectors)
 * - Safe File Upload Handling (Bypassing native file dialogs with synthetic DataTransfer FileLists)
 * - Human-like Keyboard Inputs (React 16-19 Prototype Setter Bypasses, Custom Comboboxes)
 * - Navigation & Tab Lifecycle Controls
 * - Modal & Overlay Dismissals
 * - Resilient Multi-tier Element Polling & Retries
 */
export class BrowserController {
  /**
   * Clicks an element identified by CSS selector or semantic text hint.
   */
  public async click(
    tabId: number,
    selector: string,
    options: ActionOptions = {}
  ): Promise<BrowserActionStatus> {
    const t0 = Date.now();
    try {
      const res = await sendToTab(tabId, 'EXECUTE_ACTION', {
        action: 'CLICK',
        selector,
        options,
      });

      const execData = res as { executed?: boolean; error?: string } | undefined;
      if (execData?.executed === false) {
        throw new Error(execData.error || 'Click action failed');
      }

      return {
        success: true,
        action: 'CLICK',
        target: selector,
        details: `Clicked ${selector}`,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`BrowserController click failed on ${selector}: ${errorMsg}`);
      return {
        success: false,
        action: 'CLICK',
        target: selector,
        error: errorMsg,
        durationMs: Date.now() - t0,
      };
    }
  }

  /**
   * Fills an input, textarea, or custom combobox with text.
   */
  public async fill(
    tabId: number,
    selector: string,
    value: string,
    options: ActionOptions = {}
  ): Promise<BrowserActionStatus> {
    const t0 = Date.now();
    try {
      const res = await sendToTab(tabId, 'EXECUTE_ACTION', {
        action: 'FILL',
        selector,
        value,
        options,
      });

      const execData = res as { executed?: boolean; error?: string } | undefined;
      if (execData?.executed === false) {
        throw new Error(execData.error || 'Fill action failed');
      }

      return {
        success: true,
        action: 'FILL',
        target: selector,
        details: `Filled "${value.substring(0, 15)}..." into ${selector}`,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`BrowserController fill failed on ${selector}: ${errorMsg}`);
      return {
        success: false,
        action: 'FILL',
        target: selector,
        error: errorMsg,
        durationMs: Date.now() - t0,
      };
    }
  }

  /**
   * Attaches a document or image to an <input type="file"> securely using DataTransfer.
   * Eliminates the browser restriction: "This input element accepts a filename, which may only be programmatically set to the empty string."
   */
  public async attachFile(
    tabId: number,
    selector: string,
    fileOpts: FileAttachmentOptions = {}
  ): Promise<BrowserActionStatus> {
    const t0 = Date.now();
    const fileName = fileOpts.fileName || 'test-document.pdf';

    try {
      const res = await sendToTab(tabId, 'EXECUTE_ACTION', {
        action: 'FILL',
        selector,
        value: fileName,
        options: {
          tagHint: 'input[type="file"], input',
        },
      });

      const execData = res as { executed?: boolean; error?: string } | undefined;
      if (execData?.executed === false) {
        throw new Error(execData.error || 'File attachment failed');
      }

      return {
        success: true,
        action: 'ATTACH_FILE',
        target: selector,
        details: `Attached mock file "${fileName}" to ${selector}`,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`BrowserController attachFile failed on ${selector}: ${errorMsg}`);
      return {
        success: false,
        action: 'ATTACH_FILE',
        target: selector,
        error: errorMsg,
        durationMs: Date.now() - t0,
      };
    }
  }

  /**
   * Submits a form via its submit button or direct form dispatch.
   */
  public async submitForm(
    tabId: number,
    selector: string,
    options: ActionOptions = {}
  ): Promise<BrowserActionStatus> {
    const t0 = Date.now();
    try {
      const res = await sendToTab(tabId, 'EXECUTE_ACTION', {
        action: 'SUBMIT',
        selector,
        options,
      });

      const execData = res as { executed?: boolean; error?: string } | undefined;
      if (execData?.executed === false) {
        throw new Error(execData.error || 'Submit action failed');
      }

      return {
        success: true,
        action: 'SUBMIT',
        target: selector,
        details: `Submitted form ${selector}`,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        action: 'SUBMIT',
        target: selector,
        error: errorMsg,
        durationMs: Date.now() - t0,
      };
    }
  }

  /**
   * Navigates the target tab to a specific URL and monitors loading state.
   */
  public async navigate(tabId: number, url: string): Promise<boolean> {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.update) {
      return false;
    }

    try {
      await chrome.tabs.update(tabId, { url });
      // Allow brief delay for page unload / reload cycle
      await new Promise((r) => setTimeout(r, 600));
      return true;
    } catch (err) {
      logger.warn(`BrowserController navigate failed for tab ${tabId} to ${url}:`, err);
      return false;
    }
  }

  /**
   * Reloads the active tab.
   */
  public async reload(tabId: number): Promise<boolean> {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.reload) {
      return false;
    }

    try {
      await chrome.tabs.reload(tabId);
      await new Promise((r) => setTimeout(r, 500));
      return true;
    } catch (err) {
      logger.warn(`BrowserController reload failed for tab ${tabId}:`, err);
      return false;
    }
  }

  /**
   * Highlights an element on the screen with a glowing focus ring.
   */
  public async highlight(
    tabId: number,
    selector: string,
    label?: string,
    durationMs: number = 2000
  ): Promise<boolean> {
    try {
      const res = await sendToTab(tabId, 'HIGHLIGHT_ELEMENT', {
        selector,
        label,
        durationMs,
      });
      return Boolean((res as any)?.highlighted);
    } catch {
      return false;
    }
  }

  /**
   * Clears any active highlight focus rings from the target page.
   */
  public async clearHighlights(tabId: number): Promise<void> {
    try {
      await sendToTab(tabId, 'CLEAR_HIGHLIGHTS', {});
    } catch {}
  }
}

export const browserController = new BrowserController();
