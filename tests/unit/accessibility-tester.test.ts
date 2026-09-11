import { describe, it, expect } from 'vitest';
import { testAccessibility } from '../../src/qa/accessibility-tester';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('AccessibilityTester', () => {
  const baseSnapshot: PageSnapshot = {
    url: 'https://example.com/',
    origin: 'https://example.com',
    pathname: '/',
    title: 'Example',
    metadata: {
      title: 'Example',
      lang: 'en',
      h1Count: 1,
      h1Texts: ['Accessible Title'],
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

  it('detects missing document lang attribute', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      metadata: {
        ...baseSnapshot.metadata,
        lang: undefined,
      },
    };

    const findings = testAccessibility(snapshot, 'session_1');
    expect(findings.some((f) => f.title === 'Missing lang attribute on <html> element')).toBe(true);
  });

  it('detects images without alt text', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      images: [
        {
          src: 'https://example.com/hero.jpg',
          alt: '',
          hasAltText: false,
          naturalWidth: 800,
          naturalHeight: 600,
          isBroken: false,
          selector: 'img#hero',
        },
      ],
    };

    const findings = testAccessibility(snapshot, 'session_1');
    expect(findings.some((f) => f.title === 'Image missing descriptive alt attribute')).toBe(true);
  });

  it('detects ambiguous link text such as "click here" or "learn more"', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      links: [
        {
          href: '/pricing',
          normalizedUrl: 'https://example.com/pricing',
          text: 'click here',
          isInternal: true,
          isAnchor: false,
          isMailtoOrTel: false,
          selector: 'a#pricing-link',
        },
        {
          href: '/docs',
          normalizedUrl: 'https://example.com/docs',
          text: 'Read More',
          isInternal: true,
          isAnchor: false,
          isMailtoOrTel: false,
          selector: 'a#docs-link',
        },
      ],
    };

    const findings = testAccessibility(snapshot, 'session_1');
    expect(findings).toHaveLength(2);
    expect(findings[0].title).toContain('Ambiguous link text');
    expect(findings[1].title).toContain('Ambiguous link text');
  });

  it('passes fully accessible page structures', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      images: [
        {
          src: 'https://example.com/logo.png',
          alt: 'Company Logo',
          hasAltText: true,
          naturalWidth: 200,
          naturalHeight: 50,
          isBroken: false,
          selector: 'img#logo',
        },
      ],
      links: [
        {
          href: '/features',
          normalizedUrl: 'https://example.com/features',
          text: 'Explore Platform Features',
          isInternal: true,
          isAnchor: false,
          isMailtoOrTel: false,
          selector: 'a#features',
        },
      ],
    };

    const findings = testAccessibility(snapshot, 'session_1');
    expect(findings).toHaveLength(0);
  });
});
