import { Finding } from '../shared/types/qa';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('PopupMonitor');

export interface PopupLifecycleEvent {
  id: string;
  openerTabId: number;
  popupTabId: number;
  popupWindowId?: number;
  initialUrl: string;
  currentUrl: string;
  finalUrl?: string;
  status: 'OPENED' | 'NAVIGATING' | 'CLOSED' | 'BLOCKED';
  title?: string;
  serviceType: 'OAUTH' | 'PAYMENT' | 'EXTERNAL_LINK' | 'UNKNOWN';
  openedAt: number;
  closedAt?: number;
  durationMs?: number;
}

export class PopupMonitor {
  private activeOpenerTabId: number | null = null;
  private trackedPopups: Map<number, PopupLifecycleEvent> = new Map();
  private eventHistory: PopupLifecycleEvent[] = [];
  private isListening: boolean = false;

  private onTabCreatedBound = this.handleTabCreated.bind(this);
  private onTabUpdatedBound = this.handleTabUpdated.bind(this);
  private onTabRemovedBound = this.handleTabRemoved.bind(this);

  public startMonitoring(openerTabId: number): void {
    this.activeOpenerTabId = openerTabId;
    this.trackedPopups.clear();
    this.eventHistory = [];

    if (
      typeof chrome !== 'undefined' &&
      chrome.tabs?.onCreated?.addListener &&
      !this.isListening
    ) {
      chrome.tabs.onCreated.addListener(this.onTabCreatedBound);
      chrome.tabs.onUpdated?.addListener(this.onTabUpdatedBound);
      chrome.tabs.onRemoved?.addListener(this.onTabRemovedBound);
      this.isListening = true;
      logger.info(`PopupMonitor started tracking popups for opener tab: ${openerTabId}`);
    }
  }

  public stopMonitoring(): PopupLifecycleEvent[] {
    if (
      typeof chrome !== 'undefined' &&
      chrome.tabs?.onCreated?.removeListener &&
      this.isListening
    ) {
      chrome.tabs.onCreated.removeListener(this.onTabCreatedBound);
      chrome.tabs.onUpdated?.removeListener(this.onTabUpdatedBound);
      chrome.tabs.onRemoved?.removeListener(this.onTabRemovedBound);
      this.isListening = false;
    }

    // Finalize any still-open popups
    const now = Date.now();
    for (const evt of this.trackedPopups.values()) {
      if (evt.status !== 'CLOSED') {
        evt.closedAt = now;
        evt.durationMs = now - evt.openedAt;
        this.eventHistory.push({ ...evt });
      }
    }
    this.trackedPopups.clear();
    this.activeOpenerTabId = null;

    logger.info(`PopupMonitor stopped. Total popups recorded: ${this.eventHistory.length}`);
    return [...this.eventHistory];
  }

  public getEvents(): PopupLifecycleEvent[] {
    return [...this.eventHistory, ...Array.from(this.trackedPopups.values())];
  }

  public clearEvents(): void {
    this.eventHistory = [];
    this.trackedPopups.clear();
  }

  public handleTabCreated(tab: chrome.tabs.Tab): void {
    if (!this.activeOpenerTabId) return;

    // Check if created tab belongs to our active inspected tab
    if (tab.openerTabId === this.activeOpenerTabId && tab.id) {
      const url = tab.url || tab.pendingUrl || '';
      const serviceType = this.classifyService(url);
      const event: PopupLifecycleEvent = {
        id: `popup_${tab.id}_${Date.now()}`,
        openerTabId: this.activeOpenerTabId,
        popupTabId: tab.id,
        popupWindowId: tab.windowId,
        initialUrl: url,
        currentUrl: url,
        status: 'OPENED',
        title: tab.title,
        serviceType,
        openedAt: Date.now(),
      };

      this.trackedPopups.set(tab.id, event);
      logger.info(`Tracked new popup [${serviceType}]: Tab ID ${tab.id}, url: ${url}`);
    }
  }

  public handleTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    _tab?: chrome.tabs.Tab
  ): void {
    const tracked = this.trackedPopups.get(tabId);
    if (!tracked) return;

    if (changeInfo.url) {
      tracked.currentUrl = changeInfo.url;
      tracked.finalUrl = changeInfo.url;
      tracked.status = 'NAVIGATING';
      if (tracked.serviceType === 'UNKNOWN' || tracked.serviceType === 'EXTERNAL_LINK') {
        tracked.serviceType = this.classifyService(changeInfo.url);
      }
    }

    if (changeInfo.title) {
      tracked.title = changeInfo.title;
    }
  }

  public handleTabRemoved(tabId: number): void {
    const tracked = this.trackedPopups.get(tabId);
    if (!tracked) return;

    const now = Date.now();
    tracked.status = 'CLOSED';
    tracked.closedAt = now;
    tracked.durationMs = now - tracked.openedAt;

    this.eventHistory.push({ ...tracked });
    this.trackedPopups.delete(tabId);

    logger.info(
      `Popup tab ${tabId} closed after ${tracked.durationMs}ms. Service: ${tracked.serviceType}`
    );
  }

  public classifyService(url: string): 'OAUTH' | 'PAYMENT' | 'EXTERNAL_LINK' | 'UNKNOWN' {
    if (!url) return 'UNKNOWN';
    const lower = url.toLowerCase();

    // OAuth & Federated Login Providers
    if (
      lower.includes('accounts.google.com') ||
      lower.includes('github.com/login/oauth') ||
      lower.includes('facebook.com/v') ||
      lower.includes('appleid.apple.com') ||
      lower.includes('auth0.com') ||
      lower.includes('clerk.') ||
      lower.includes('cognito') ||
      lower.includes('supabase.co/auth') ||
      lower.includes('firebaseapp.com/__/auth')
    ) {
      return 'OAUTH';
    }

    // Payment Providers
    if (
      lower.includes('stripe.com') ||
      lower.includes('paypal.com') ||
      lower.includes('checkout.') ||
      lower.includes('square.') ||
      lower.includes('braintree') ||
      lower.includes('pay.google.com')
    ) {
      return 'PAYMENT';
    }

    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      return 'EXTERNAL_LINK';
    }

    return 'UNKNOWN';
  }

  /**
   * Generates QA findings if external authentication or payment popups were aborted immediately or blocked.
   */
  public generateFindings(sessionId: string, pageUrl: string): Finding[] {
    const findings: Finding[] = [];
    const allEvents = this.getEvents();

    for (const evt of allEvents) {
      // Aborted OAuth or Payment popup: closed in under 800ms
      if ((evt.serviceType === 'OAUTH' || evt.serviceType === 'PAYMENT') && evt.durationMs !== undefined && evt.durationMs < 800) {
        findings.push({
          id: `finding_popup_abort_${sessionId}_${evt.popupTabId}`,
          sessionId,
          category: 'FUNCTIONAL',
          severity: 'HIGH',
          status: 'WARNING',
          confidence: 0.85,
          title: `[Popup / OAuth Flow] Immediate Popup Close Detected for ${evt.serviceType}`,
          description: `An external ${evt.serviceType} window (${evt.finalUrl || evt.initialUrl}) was closed within ${evt.durationMs}ms. This frequently indicates an origin rejection, misconfigured OAuth redirect URI, or browser popup blocker policy.`,
          page: pageUrl,
          steps: [
            `Navigate to ${pageUrl}`,
            `Trigger ${evt.serviceType} integration action`,
            `Observe external window lifecycle for tab ${evt.popupTabId}`,
          ],
          expected: `${evt.serviceType} modal should stay open to allow user authentication or payment completion.`,
          actual: `Window closed almost immediately (${evt.durationMs}ms) without user interaction.`,
          recommendation: 'Verify OAuth authorized redirect URIs, CORS headers, and popup blocker guidelines.',
          evidence: [
            {
              type: 'metric',
              description: 'Popup lifecycle event record',
              data: evt as unknown as Record<string, unknown>,
              timestamp: Date.now(),
            },
          ],
          retestCount: 0,
          timestamp: Date.now(),
        });
      }
    }

    return findings;
  }
}

export const popupMonitor = new PopupMonitor();
