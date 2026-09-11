import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveInspectableTab, isInspectableUrl, getTabOrigin } from '../../src/background/permissions-manager';
import { ensureContentScriptInjected } from '../../src/shared/messaging/bus';

describe('Tab Injection & Multi-Window Resolution', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isInspectableUrl', () => {
    it('returns false for chrome:// and restricted browser schemes', () => {
      expect(isInspectableUrl('chrome://extensions')).toBe(false);
      expect(isInspectableUrl('chrome-extension://xyz/popup.html')).toBe(false);
      expect(isInspectableUrl('edge://settings')).toBe(false);
      expect(isInspectableUrl('about:blank')).toBe(false);
      expect(isInspectableUrl('devtools://devtools/bundled/inspector.html')).toBe(false);
      expect(isInspectableUrl('view-source:https://example.com')).toBe(false);
      expect(isInspectableUrl('')).toBe(false);
    });

    it('returns true for normal web URLs and localhost', () => {
      expect(isInspectableUrl('https://example.com')).toBe(true);
      expect(isInspectableUrl('https://my-app.vercel.app/dashboard')).toBe(true);
      expect(isInspectableUrl('http://localhost:3000')).toBe(true);
      expect(isInspectableUrl('http://127.0.0.1:8080/test')).toBe(true);
    });
  });

  describe('getTabOrigin', () => {
    it('extracts protocol, host, and port origin safely', () => {
      expect(getTabOrigin('https://store.example.com/checkout?item=1')).toBe('https://store.example.com');
      expect(getTabOrigin('http://localhost:5173/app')).toBe('http://localhost:5173');
      expect(getTabOrigin('')).toBe('');
    });
  });

  describe('getActiveInspectableTab', () => {
    it('queries active tab prioritizing lastFocusedWindow for Side Panel', async () => {
      const mockQuery = vi.spyOn(chrome.tabs, 'query').mockImplementation(async (queryInfo: any) => {
        if (queryInfo.lastFocusedWindow) {
          return [{ id: 42, url: 'https://myshop.com', title: 'My Shop' }] as any;
        }
        return [];
      });

      const tab = await getActiveInspectableTab();
      expect(tab).toBeDefined();
      expect(tab?.id).toBe(42);
      expect(tab?.url).toBe('https://myshop.com');
      expect(mockQuery).toHaveBeenCalled();
    });

    it('falls back to currentWindow if lastFocusedWindow returns empty', async () => {
      vi.spyOn(chrome.tabs, 'query').mockImplementation(async (queryInfo: any) => {
        if (queryInfo.lastFocusedWindow) {
          return [];
        }
        if (queryInfo.currentWindow) {
          return [{ id: 99, url: 'https://fallback.com', title: 'Fallback Tab' }] as any;
        }
        return [];
      });

      const tab = await getActiveInspectableTab();
      expect(tab?.id).toBe(99);
      expect(tab?.url).toBe('https://fallback.com');
    });
  });

  describe('ensureContentScriptInjected', () => {
    it('returns true immediately if content script already responds to ping', async () => {
      vi.spyOn(chrome.tabs, 'sendMessage').mockImplementation((...args: any[]): any => {
        const cb = typeof args[2] === 'function' ? args[2] : args[1];
        if (typeof cb === 'function') cb({ ready: true });
        return Promise.resolve({ ready: true });
      });

      const injected = await ensureContentScriptInjected(101);
      expect(injected).toBe(true);
    });

    it('dynamically injects content script using chrome.scripting if ping fails', async () => {
      vi.spyOn(chrome.tabs, 'sendMessage').mockImplementation((...args: any[]): any => {
        (chrome.runtime as any).lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
        const cb = typeof args[2] === 'function' ? args[2] : args[1];
        if (typeof cb === 'function') cb(null);
        return Promise.resolve(null);
      });

      const executeSpy = vi.spyOn(chrome.scripting, 'executeScript').mockResolvedValue([{ result: true }] as any);

      const injected = await ensureContentScriptInjected(202);
      expect(injected).toBe(true);
      expect(executeSpy).toHaveBeenCalledWith({
        target: { tabId: 202 },
        files: ['src/content/index.js'],
      });
      (chrome.runtime as any).lastError = null;
    });
  });
});
