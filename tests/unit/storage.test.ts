import { describe, it, expect, beforeEach } from 'vitest';
import { dbClient } from '../../src/storage/indexed-db';
import { sessionStore } from '../../src/storage/session-store';
import { settingsStore } from '../../src/storage/settings-store';
import { QASession } from '../../src/shared/types/session';
import { Finding } from '../../src/shared/types/qa';

describe('IndexedDB Storage Engine', () => {
  beforeEach(async () => {
    await dbClient.clear('sessions');
    await dbClient.clear('findings');
    await dbClient.clear('settings');
  });

  it('stores and retrieves a session correctly', async () => {
    const mockSession: QASession = {
      id: 'session_test_1',
      tabId: 1,
      url: 'https://example.com',
      origin: 'https://example.com',
      title: 'Example Page',
      state: 'INITIALIZING',
      startTime: 1000,
      progress: 10,
      currentAction: 'Starting test',
      stats: {
        pagesDiscovered: 1,
        pagesCrawled: 0,
        elementsDiscovered: 5,
        testsExecuted: 0,
        passedCount: 0,
        failedCount: 0,
        warningsCount: 0,
        criticalBugsCount: 0,
      },
      config: {
        crawlDepth: 2,
        maxPages: 10,
        privacyMode: true,
        requireApprovalForHighRisk: true,
        enabledCategories: ['FUNCTIONAL', 'SEO'],
      },
    };

    await sessionStore.saveSession(mockSession);
    const retrieved = await sessionStore.getSession('session_test_1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('session_test_1');
    expect(retrieved?.url).toBe('https://example.com');
    expect(retrieved?.stats.elementsDiscovered).toBe(5);
  });

  it('stores and queries findings by sessionId', async () => {
    const mockFinding: Finding = {
      id: 'finding_1',
      sessionId: 'session_test_1',
      category: 'FUNCTIONAL',
      title: 'Broken submit button',
      description: 'Click on submit did not trigger handler',
      status: 'FAIL',
      severity: 'HIGH',
      confidence: 0.95,
      page: '/contact',
      element: 'button#submit',
      evidence: [],
      steps: ['Loaded page', 'Clicked submit'],
      expected: 'Form submission confirmation',
      actual: 'No reaction',
      recommendation: 'Fix event listener on submit button',
      retestCount: 1,
      timestamp: Date.now(),
    };

    await sessionStore.saveFinding(mockFinding);
    const findings = await sessionStore.getFindingsBySession('session_test_1');

    expect(findings.length).toBe(1);
    expect(findings[0].id).toBe('finding_1');
    expect(findings[0].title).toBe('Broken submit button');
    expect(findings[0].severity).toBe('HIGH');
  });

  it('updates and persists settings in settings store', async () => {
    const initial = await settingsStore.getSettings();
    expect(initial.privacyMode).toBe(false);

    const updated = await settingsStore.updateSettings({ maxPages: 25, privacyMode: true });
    expect(updated.maxPages).toBe(25);
    expect(updated.privacyMode).toBe(true);

    const reloaded = await settingsStore.getSettings();
    expect(reloaded.maxPages).toBe(25);
    expect(reloaded.privacyMode).toBe(true);
  });
});
