import { describe, it, expect } from 'vitest';
import { enrichFinding, enrichFindingsBatch } from '../../src/evidence/bundler';
import { captureTabScreenshot, cropScreenshotToElement } from '../../src/evidence/screenshot';
import { Finding } from '../../src/shared/types/qa';

describe('EvidenceBundler & ScreenshotEngine', () => {
  const baseFinding: Finding = {
    id: 'find_1',
    sessionId: 'sess_1',
    category: 'FUNCTIONAL',
    title: 'Button missing accessible text label',
    description: 'An interactive button has no label',
    status: 'FAIL',
    severity: 'HIGH',
    confidence: 0.99,
    page: '/checkout',
    element: 'button',
    selector: 'button#pay-now',
    evidence: [],
    steps: ['Inspect button'],
    expected: 'Button has accessible label',
    actual: 'Button is blank',
    recommendation: 'Add aria-label',
    retestCount: 0,
    timestamp: Date.now(),
  };

  it('captures tab screenshots using chrome.tabs.captureVisibleTab mock', async () => {
    const screenshot = await captureTabScreenshot(101);
    expect(screenshot).not.toBeNull();
    expect(screenshot).toContain('data:image/jpeg;base64');
  });

  it('crops screenshots to element bounding boxes gracefully', async () => {
    const mockFull = 'data:image/jpeg;base64,samplefulltabimage';
    const rect = { x: 100, y: 150, width: 300, height: 80 };

    const cropped = await cropScreenshotToElement(mockFull, rect, 800);
    expect(cropped).toBeDefined();
    expect(cropped.dataUrl).toBeDefined();
    expect(cropped.width).toBeGreaterThanOrEqual(10);
    expect(cropped.height).toBeGreaterThanOrEqual(10);
  });

  it('enriches a single finding with DOM snippet and screenshot evidence', async () => {
    const enriched = await enrichFinding(baseFinding, 101, { captureScreenshot: true });

    const domSnippet = enriched.evidence.find((e) => e.type === 'dom_snippet');
    expect(domSnippet).toBeDefined();
    expect((domSnippet?.data as { selector?: string })?.selector).toBe('button#pay-now');

    const screenshot = enriched.evidence.find((e) => e.type === 'screenshot');
    expect(screenshot).toBeDefined();
    expect((screenshot?.data as { dataUrl?: string })?.dataUrl).toBeDefined();
  });

  it('enriches a batch of findings and enforces screenshot rate limits', async () => {
    const findings: Finding[] = [
      {
        ...baseFinding,
        id: 'crit_1',
        severity: 'CRITICAL',
        selector: '#crit-button',
      },
      {
        ...baseFinding,
        id: 'high_1',
        severity: 'HIGH',
        selector: '#high-input',
      },
      {
        ...baseFinding,
        id: 'low_1',
        severity: 'LOW',
        selector: '#low-link',
      },
    ];

    const enriched = await enrichFindingsBatch(findings, 101, {
      captureScreenshots: true,
      maxScreenshotsPerRun: 1, // Only 1 screenshot allowed
    });

    expect(enriched).toHaveLength(3);

    // Count how many got screenshot evidence
    const withScreenshot = enriched.filter((f) => f.evidence.some((e) => e.type === 'screenshot'));
    expect(withScreenshot).toHaveLength(1);
    expect(withScreenshot[0].id).toBe('crit_1');

    // All findings with selector must still have DOM snippet evidence
    for (const f of enriched) {
      expect(f.evidence.some((e) => e.type === 'dom_snippet')).toBe(true);
    }
  });
});
