import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sessionManager } from '../../src/background/session-manager';
import { dbClient } from '../../src/storage/indexed-db';

describe('SessionManager', () => {
  beforeEach(async () => {
    sessionManager.resetForTesting();
    await dbClient.clear('sessions');
  });

  it('starts a new session with initial state and config', async () => {
    const session = await sessionManager.startSession(101, { maxPages: 5 });

    expect(session).toBeDefined();
    expect(session.id).toContain('qa_');
    expect(session.state).toBe('INITIALIZING');
    expect(session.config.maxPages).toBe(5);
    expect(sessionManager.getCurrentSession()?.id).toBe(session.id);
  });

  it('updates state and notifies registered listeners', async () => {
    const listener = vi.fn();
    sessionManager.addListener(listener);

    await sessionManager.startSession(101);
    await sessionManager.updateState('DISCOVERING', 20, 'Scanning internal links...');

    const current = sessionManager.getCurrentSession();
    expect(current?.state).toBe('DISCOVERING');
    expect(current?.progress).toBe(20);
    expect(current?.currentAction).toBe('Scanning internal links...');

    expect(listener).toHaveBeenCalled();
    sessionManager.removeListener(listener);
  });

  it('handles pause, resume, and stop lifecycle', async () => {
    const session = await sessionManager.startSession(101);

    const paused = await sessionManager.pauseSession(session.id);
    expect(paused).toBe(true);
    expect(sessionManager.getCurrentSession()?.currentAction).toContain('paused');

    const resumed = await sessionManager.resumeSession(session.id);
    expect(resumed).toBe(true);

    const stopped = await sessionManager.stopSession(session.id);
    expect(stopped).toBe(true);
    expect(sessionManager.getCurrentSession()?.state).toBe('COMPLETED');
    expect(sessionManager.getCurrentSession()?.endTime).toBeDefined();
  });

  it('runs autonomous discovery, stores snapshots, and executes deterministic QA', async () => {
    await sessionManager.startSession(101, {
      ai: { provider: 'local_webgpu' },
    });
    const discoveryMap = await sessionManager.runDiscovery();

    expect(discoveryMap).not.toBeNull();
    expect(sessionManager.getCurrentSession()?.state).toBe('OBSERVING');
    expect(sessionManager.getDiscoveryMap()).toBe(discoveryMap);
    expect(sessionManager.getCurrentSession()?.stats.testsExecuted).toBeGreaterThan(0);
  });
});
