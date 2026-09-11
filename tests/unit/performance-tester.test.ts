import { describe, it, expect } from 'vitest';
import { testPerformance } from '../../src/qa/performance-tester';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('PerformanceTester', () => {
  const baseSnapshot: PageSnapshot = {
    url: 'https://example.com/',
    origin: 'https://example.com',
    pathname: '/',
    title: 'Example',
    metadata: {
      title: 'Example',
      h1Count: 1,
      h1Texts: ['Title'],
      headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    },
    links: [],
    buttons: [],
    forms: [],
    images: [],
    navigations: [],
    totalInteractiveCount: 50,
    timestamp: Date.now(),
  };

  it('warns when total interactive elements exceed high density threshold (> 250)', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      totalInteractiveCount: 320,
    };

    const findings = testPerformance(snapshot, 'session_1');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('High interactive element density');
    expect(findings[0].severity).toBe('MEDIUM');
    expect(findings[0].status).toBe('WARNING');
  });

  it('detects oversized unoptimized images without lazy loading', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      images: [
        {
          src: 'https://example.com/huge-banner.png',
          alt: 'Banner',
          hasAltText: true,
          naturalWidth: 2400,
          naturalHeight: 1600,
          isBroken: false,
          loading: 'eager',
          selector: 'img#banner',
        },
      ],
    };

    const findings = testPerformance(snapshot, 'session_1');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Large image rendered without lazy loading');
    expect(findings[0].severity).toBe('MEDIUM');
  });

  it('allows high-resolution images when configured with loading="lazy"', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      images: [
        {
          src: 'https://example.com/huge-banner.png',
          alt: 'Banner',
          hasAltText: true,
          naturalWidth: 2400,
          naturalHeight: 1600,
          isBroken: false,
          loading: 'lazy',
          selector: 'img#banner',
        },
      ],
    };

    const findings = testPerformance(snapshot, 'session_1');
    expect(findings).toHaveLength(0);
  });
});
