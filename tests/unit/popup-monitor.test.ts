import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PopupMonitor } from '../../src/background/popup-monitor';

describe('PopupMonitor', () => {
  let monitor: PopupMonitor;

  beforeEach(() => {
    (global as any).chrome = (global as any).chrome || {};
    (global as any).chrome.tabs = (global as any).chrome.tabs || {};
    (global as any).chrome.tabs.onCreated = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    (global as any).chrome.tabs.onUpdated = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    (global as any).chrome.tabs.onRemoved = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    monitor = new PopupMonitor();
  });

  describe('classifyService', () => {
    it('identifies OAuth providers', () => {
      expect(monitor.classifyService('https://accounts.google.com/o/oauth2/v2/auth')).toBe('OAUTH');
      expect(monitor.classifyService('https://github.com/login/oauth/authorize')).toBe('OAUTH');
      expect(monitor.classifyService('https://clerk.myapp.com/sign-in')).toBe('OAUTH');
      expect(monitor.classifyService('https://myproject.auth0.com/authorize')).toBe('OAUTH');
    });

    it('identifies payment gateways', () => {
      expect(monitor.classifyService('https://checkout.stripe.com/c/pay/cs_test_123')).toBe('PAYMENT');
      expect(monitor.classifyService('https://www.paypal.com/checkoutnow?token=EC-123')).toBe('PAYMENT');
      expect(monitor.classifyService('https://pay.google.com/gp/p/ui/pay')).toBe('PAYMENT');
    });

    it('identifies general external links', () => {
      expect(monitor.classifyService('https://example.com/terms')).toBe('EXTERNAL_LINK');
      expect(monitor.classifyService('')).toBe('UNKNOWN');
    });
  });

  describe('lifecycle events', () => {
    it('tracks tab creation, navigation, and closure', () => {
      // Start monitoring opener tab 10
      monitor.startMonitoring(10);

      // Tab created by tab 10
      monitor.handleTabCreated({
        id: 101,
        openerTabId: 10,
        url: 'https://accounts.google.com/o/oauth2/auth',
        windowId: 2,
        title: 'Google Sign In',
      } as chrome.tabs.Tab);

      let events = monitor.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].status).toBe('OPENED');
      expect(events[0].serviceType).toBe('OAUTH');

      // Tab updated / navigates
      monitor.handleTabUpdated(
        101,
        { url: 'https://accounts.google.com/signin/v2/challenge' },
        {} as chrome.tabs.Tab
      );

      events = monitor.getEvents();
      expect(events[0].status).toBe('NAVIGATING');
      expect(events[0].finalUrl).toBe('https://accounts.google.com/signin/v2/challenge');

      // Tab closed
      monitor.handleTabRemoved(101);

      events = monitor.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].status).toBe('CLOSED');
      expect(events[0].closedAt).toBeDefined();
      expect(typeof events[0].durationMs).toBe('number');
    });

    it('ignores tabs opened by different opener tab', () => {
      monitor.startMonitoring(10);

      monitor.handleTabCreated({
        id: 999,
        openerTabId: 55, // different tab
        url: 'https://stripe.com',
      } as chrome.tabs.Tab);

      expect(monitor.getEvents().length).toBe(0);
    });

    it('generates high severity warning finding if OAuth popup is closed too quickly (< 800ms)', () => {
      monitor.startMonitoring(10);

      const openTime = Date.now() - 200; // 200ms ago
      monitor.handleTabCreated({
        id: 202,
        openerTabId: 10,
        url: 'https://accounts.google.com/o/oauth2/auth',
      } as chrome.tabs.Tab);

      // Force openedAt to 200ms ago
      const events = monitor.getEvents();
      events[0].openedAt = openTime;

      monitor.handleTabRemoved(202);

      const findings = monitor.generateFindings('sess-1', 'https://myapp.com/login');
      expect(findings.length).toBe(1);
      expect(findings[0].title).toContain('Immediate Popup Close Detected for OAUTH');
      expect(findings[0].severity).toBe('HIGH');
    });
  });
});
