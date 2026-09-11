import { describe, it, expect } from 'vitest';
import { testLinks } from '../../src/qa/link-tester';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('LinkTester', () => {
  const baseSnapshot: PageSnapshot = {
    url: 'https://example.com/',
    origin: 'https://example.com',
    pathname: '/',
    title: 'Example',
    metadata: {
      title: 'Example',
      h1Count: 1,
      h1Texts: ['Heading'],
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

  it('detects empty or whitespace href attributes', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      links: [
        {
          href: '',
          normalizedUrl: '',
          text: 'Empty Link',
          isInternal: true,
          isAnchor: false,
          isMailtoOrTel: false,
          selector: 'a#empty-link',
        },
        {
          href: '   ',
          normalizedUrl: '',
          text: 'Whitespace Link',
          isInternal: true,
          isAnchor: false,
          isMailtoOrTel: false,
          selector: 'a#whitespace-link',
        },
      ],
    };

    const findings = testLinks(snapshot, 'session_1');
    expect(findings).toHaveLength(2);
    expect(findings[0].title).toBe('Empty link href attribute');
    expect(findings[0].severity).toBe('MEDIUM');
    expect(findings[0].status).toBe('FAIL');
    expect(findings[1].title).toBe('Empty link href attribute');
  });

  it('detects javascript: pseudo-protocol links', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      links: [
        {
          href: 'javascript:void(0)',
          normalizedUrl: 'javascript:void(0)',
          text: 'JS Link',
          isInternal: false,
          isAnchor: false,
          isMailtoOrTel: false,
          selector: 'a#js-link',
        },
      ],
    };

    const findings = testLinks(snapshot, 'session_1');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('javascript: pseudo-protocol');
    expect(findings[0].severity).toBe('LOW');
    expect(findings[0].status).toBe('WARNING');
  });

  it('detects empty hash links with no accessible text', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      links: [
        {
          href: '#',
          normalizedUrl: '#',
          text: '',
          isInternal: true,
          isAnchor: true,
          isMailtoOrTel: false,
          selector: 'a#empty-hash',
        },
      ],
    };

    const findings = testLinks(snapshot, 'session_1');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('Empty hash anchor without accessible text');
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].status).toBe('FAIL');
  });

  it('passes valid destination links without findings', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      links: [
        {
          href: 'https://example.com/about',
          normalizedUrl: 'https://example.com/about',
          text: 'About Us',
          isInternal: true,
          isAnchor: false,
          isMailtoOrTel: false,
          selector: 'a#about',
        },
        {
          href: '#section-top',
          normalizedUrl: '#section-top',
          text: 'Back to Top',
          isInternal: true,
          isAnchor: true,
          isMailtoOrTel: false,
          selector: 'a#top',
        },
      ],
    };

    const findings = testLinks(snapshot, 'session_1');
    expect(findings).toHaveLength(0);
  });
});
