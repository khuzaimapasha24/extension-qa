import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MutationTracker } from '../../src/content/mutation-tracker';

describe('MutationTracker', () => {
  let tracker: MutationTracker;
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    tracker = new MutationTracker();
    tracker.start(container);
  });

  afterEach(() => {
    tracker.stop();
  });

  it('tracks DOM childList mutations and resets baseline', async () => {
    const el = document.createElement('p');
    el.textContent = 'Dynamic paragraph';
    container.appendChild(el);

    // Wait for MutationObserver microtask
    await new Promise((r) => setTimeout(r, 50));

    const snap = tracker.getObservationSnapshot(document);
    expect(snap.domMutationsCount).toBeGreaterThan(0);

    tracker.resetBaseline();
    const afterReset = tracker.getObservationSnapshot(document);
    expect(afterReset.domMutationsCount).toBe(0);
  });

  it('detects modal dialog elements in DOM', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    container.appendChild(dialog);

    const snap = tracker.getObservationSnapshot(document);
    expect(snap.modalDetected).toBe(true);
  });

  it('detects and classifies error toast alerts', () => {
    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.className = 'alert alert-danger';
    alert.textContent = 'Invalid credentials or request failed';
    container.appendChild(alert);

    const snap = tracker.getObservationSnapshot(document);
    expect(snap.toastAlertDetected).toBe(true);
    expect(snap.alertType).toBe('error');
    expect(snap.alertMessage).toContain('Invalid credentials');
  });

  it('detects and classifies success alerts', () => {
    const alert = document.createElement('div');
    alert.setAttribute('role', 'status');
    alert.className = 'toast success-notice';
    alert.textContent = 'Changes saved successfully!';
    container.appendChild(alert);

    const snap = tracker.getObservationSnapshot(document);
    expect(snap.toastAlertDetected).toBe(true);
    expect(snap.alertType).toBe('success');
    expect(snap.alertMessage).toContain('Changes saved');
  });
});
