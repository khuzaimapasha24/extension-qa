import { describe, it, expect } from 'vitest';
import { testSEO } from '../../src/qa/seo-tester';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('SEOTester', () => {
  const baseSnapshot: PageSnapshot = {
    url: 'https://example.com/',
    origin: 'https://example.com',
    pathname: '/',
    title: '',
    metadata: {
      title: '',
      h1Count: 0,
      h1Texts: [],
      headingCounts: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    },
    links: [],
    buttons: [],
    forms: [],
    images: [],
    navigations: [],
    totalInteractiveCount: 0,
    timestamp: Date.now(),
  };

  it('detects missing title, meta description, and H1 heading', () => {
    const findings = testSEO(baseSnapshot, 'session_1');

    const titles = findings.map((f) => f.title);
    expect(titles).toContain('Missing <title> tag');
    expect(titles).toContain('Missing meta description tag');
    expect(titles).toContain('Missing <h1> heading');
    expect(titles).toContain('Missing canonical link tag');
    expect(titles).toContain('Incomplete OpenGraph metadata (missing og:title or og:image)');

    const critical = findings.find((f) => f.title === 'Missing <title> tag');
    expect(critical?.severity).toBe('CRITICAL');
  });

  it('warns about short title and multiple H1 headings', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      metadata: {
        title: 'Short',
        description: 'A comprehensive meta description that accurately explains the target page purpose.',
        h1Count: 3,
        h1Texts: ['First', 'Second', 'Third'],
        canonical: 'https://example.com/',
        ogTitle: 'Short',
        ogImage: 'https://example.com/banner.png',
        headingCounts: { h1: 3, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      },
    };

    const findings = testSEO(snapshot, 'session_1');
    const titles = findings.map((f) => f.title);

    expect(titles).toContain('Title tag too short (< 10 characters)');
    expect(titles).toContain('Multiple <h1> headings found (3)');
  });

  it('passes pages with fully optimized SEO elements', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      metadata: {
        title: 'Acme SaaS - Automated QA Testing for Modern Web Applications',
        description: 'Acme SaaS delivers intelligent, production-ready website QA automation directly in your browser.',
        h1Count: 1,
        h1Texts: ['Automated QA Testing for Modern Web Applications'],
        canonical: 'https://example.com/',
        ogTitle: 'Acme SaaS QA Automation',
        ogImage: 'https://example.com/og-image.jpg',
        headingCounts: { h1: 1, h2: 4, h3: 2, h4: 0, h5: 0, h6: 0 },
      },
    };

    const findings = testSEO(snapshot, 'session_1');
    expect(findings).toHaveLength(0);
  });
});
