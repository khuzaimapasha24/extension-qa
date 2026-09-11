import { describe, it, expect, beforeEach } from 'vitest';
import { qaEngine } from '../../src/qa/engine';
import { dbClient } from '../../src/storage/indexed-db';
import { PageSnapshot } from '../../src/shared/types/discovery';
import { DEFAULT_SESSION_CONFIG } from '../../src/shared/constants/defaults';

describe('QAEngine', () => {
  beforeEach(async () => {
    await dbClient.clear('findings');
  });

  const baseSnapshot: PageSnapshot = {
    url: 'https://example.com/test',
    origin: 'https://example.com',
    pathname: '/test',
    title: 'Acme Testing Page - Full Automation Architecture',
    metadata: {
      title: 'Acme Testing Page - Full Automation Architecture',
      description: 'Comprehensive testing and verification suite for production applications.',
      lang: 'en',
      viewport: 'width=device-width, initial-scale=1.0',
      canonical: 'https://example.com/test',
      ogTitle: 'Acme Testing Page',
      ogImage: 'https://example.com/og.png',
      h1Count: 1,
      h1Texts: ['Full Automation Architecture'],
      headingCounts: { h1: 1, h2: 2, h3: 1, h4: 0, h5: 0, h6: 0 },
    },
    links: [
      {
        href: 'https://example.com/docs',
        normalizedUrl: 'https://example.com/docs',
        text: 'Documentation Overview',
        isInternal: true,
        isAnchor: false,
        isMailtoOrTel: false,
        selector: 'a#docs',
      },
    ],
    buttons: [
      {
        text: 'Deploy Now',
        selector: 'button#deploy',
        type: 'button',
        riskLevel: 'LOW',
        isDisabled: false,
        isVisible: true,
      },
    ],
    forms: [
      {
        action: '/feedback',
        method: 'POST',
        selector: 'form#feedback',
        submitButtonSelector: 'button#submit-feedback',
        riskLevel: 'LOW',
        fields: [
          {
            name: 'comment',
            type: 'textarea',
            selector: 'textarea#comment',
            label: 'Your Feedback',
            required: false,
          },
        ],
      },
    ],
    images: [
      {
        src: 'https://example.com/thumb.png',
        alt: 'Thumbnail image',
        hasAltText: true,
        naturalWidth: 400,
        naturalHeight: 300,
        isBroken: false,
        selector: 'img#thumb',
      },
    ],
    navigations: [],
    totalInteractiveCount: 3,
    timestamp: Date.now(),
  };

  it('scores a clean, fully compliant page 100/100', async () => {
    const result = await qaEngine.runAllTests(baseSnapshot, 'sess_perfect', DEFAULT_SESSION_CONFIG);

    expect(result.findings).toHaveLength(0);
    expect(result.scores.overallScore).toBe(100);
    expect(result.scores.criticalCount).toBe(0);
    expect(result.scores.highCount).toBe(0);
  });

  it('aggregates findings and applies deterministic penalties accurately', async () => {
    // Snapshot with:
    // 1. Missing viewport (RESPONSIVE: CRITICAL -> -35 pts)
    // 2. Missing title (SEO: CRITICAL -> -35 pts)
    // 3. Image missing alt (ACCESSIBILITY: HIGH -> -20 pts)
    const brokenSnapshot: PageSnapshot = {
      ...baseSnapshot,
      metadata: {
        ...baseSnapshot.metadata,
        viewport: undefined,
        title: '',
      },
      images: [
        {
          src: 'https://example.com/unlabeled.png',
          alt: '',
          hasAltText: false,
          naturalWidth: 500,
          naturalHeight: 400,
          isBroken: false,
          selector: 'img#unlabeled',
        },
      ],
    };

    const result = await qaEngine.runAllTests(brokenSnapshot, 'sess_broken', DEFAULT_SESSION_CONFIG);

    expect(result.findings.length).toBeGreaterThanOrEqual(3);
    expect(result.scores.criticalCount).toBeGreaterThanOrEqual(2);
    expect(result.scores.highCount).toBeGreaterThanOrEqual(1);

    // Responsive category score should be penalized by at least 35
    expect(result.scores.categoryScores['RESPONSIVE'].score).toBeLessThanOrEqual(65);
    // Overall score should be noticeably lower than 100
    expect(result.scores.overallScore).toBeLessThan(90);

    // Verify findings are stored in IndexedDB
    const saved = await dbClient.getAll('findings');
    expect(saved.length).toBe(result.findings.length);
  });

  it('processes optional console errors and network failures when provided', async () => {
    const result = await qaEngine.runAllTests(baseSnapshot, 'sess_errors', DEFAULT_SESSION_CONFIG, {
      consoleErrors: [
        {
          message: 'ReferenceError: analyticsTracker is not defined',
          timestamp: Date.now(),
        },
      ],
      networkFailures: [
        {
          url: 'https://example.com/api/telemetry?token=secret123',
          method: 'POST',
          status: 500,
          type: 'xhr',
          timestamp: Date.now(),
        },
      ],
    });

    const consoleFinding = result.findings.find((f) => f.category === 'CONSOLE');
    expect(consoleFinding).toBeDefined();
    expect(consoleFinding?.severity).toBe('CRITICAL');

    const networkFinding = result.findings.find((f) => f.category === 'NETWORK');
    expect(networkFinding).toBeDefined();
    expect(networkFinding?.severity).toBe('CRITICAL');
    // Ensure URL was redacted
    expect(networkFinding?.title).not.toContain('secret123');
  });

  it('respects enabledCategories configuration', async () => {
    const brokenSnapshot: PageSnapshot = {
      ...baseSnapshot,
      metadata: {
        ...baseSnapshot.metadata,
        title: '', // Broken SEO
      },
    };

    // Only run FUNCTIONAL tests, omitting SEO
    const configWithOnlyFunctional = {
      ...DEFAULT_SESSION_CONFIG,
      enabledCategories: ['FUNCTIONAL' as const],
    };

    const result = await qaEngine.runAllTests(brokenSnapshot, 'sess_filter', configWithOnlyFunctional);

    // Should have 0 findings because SEO was disabled
    expect(result.findings).toHaveLength(0);
  });
});
