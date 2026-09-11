import { describe, it, expect } from 'vitest';
import { testResponsive, VIEWPORT_PROFILES } from '../../src/qa/responsive-tester';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('ResponsiveTester', () => {
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
    totalInteractiveCount: 0,
    timestamp: Date.now(),
  };

  it('exports comprehensive viewport test profiles across mobile, tablet, and desktop', () => {
    expect(VIEWPORT_PROFILES.length).toBeGreaterThanOrEqual(6);
    expect(VIEWPORT_PROFILES.some((p) => p.name.includes('Mobile'))).toBe(true);
    expect(VIEWPORT_PROFILES.some((p) => p.name.includes('Desktop'))).toBe(true);
  });

  it('detects missing mobile viewport meta tag with CRITICAL severity', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      metadata: {
        ...baseSnapshot.metadata,
        viewport: undefined,
      },
    };

    const findings = testResponsive(snapshot, 'session_1');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Missing mobile viewport meta tag');
    expect(findings[0].severity).toBe('CRITICAL');
    expect(findings[0].status).toBe('FAIL');
  });

  it('warns when viewport tag lacks width=device-width', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      metadata: {
        ...baseSnapshot.metadata,
        viewport: 'initial-scale=1.0, maximum-scale=1.0',
      },
    };

    const findings = testResponsive(snapshot, 'session_1');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Suboptimal viewport configuration');
    expect(findings[0].severity).toBe('MEDIUM');
    expect(findings[0].status).toBe('WARNING');
  });

  it('passes properly configured standard responsive viewport', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      metadata: {
        ...baseSnapshot.metadata,
        viewport: 'width=device-width, initial-scale=1.0',
      },
    };

    const findings = testResponsive(snapshot, 'session_1');
    expect(findings).toHaveLength(0);
  });
});
