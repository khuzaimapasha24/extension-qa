import { describe, it, expect } from 'vitest';
import { normalizeUrl, isSameOrigin, WebsiteCrawler } from '../../src/qa/crawler';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('WebsiteCrawler', () => {
  describe('normalizeUrl', () => {
    it('strips hash fragments and trailing slashes', () => {
      expect(normalizeUrl('https://example.com/about/#team')).toBe('https://example.com/about');
      expect(normalizeUrl('https://example.com/services/')).toBe('https://example.com/services');
      // Root URL retains protocol and origin
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    });

    it('strips tracking query parameters while preserving functional parameters', () => {
      const dirty = 'https://example.com/products?id=123&utm_source=twitter&utm_medium=cpc&fbclid=abc';
      const clean = normalizeUrl(dirty);
      expect(clean).toBe('https://example.com/products?id=123');
    });
  });

  describe('isSameOrigin', () => {
    it('strictly verifies exact protocol, hostname, and port', () => {
      const origin = 'https://example.com';
      expect(isSameOrigin('https://example.com/blog/1', origin)).toBe(true);
      expect(isSameOrigin('https://sub.example.com/test', origin)).toBe(false);
      expect(isSameOrigin('http://example.com/test', origin)).toBe(false);
      expect(isSameOrigin('https://external.com/page', origin)).toBe(false);
    });
  });

  describe('WebsiteCrawler queue & discovery map', () => {
    it('enqueues internal links, prevents duplicates, and respects maxPages limit', () => {
      const crawler = new WebsiteCrawler('https://example.com', 10, 2);

      const mockSnapshot1: PageSnapshot = {
        url: 'https://example.com',
        origin: 'https://example.com',
        pathname: '/',
        title: 'Home',
        metadata: {
          title: 'Home',
          h1Count: 1,
          h1Texts: ['Home'],
          headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
        },
        links: [
          {
            href: '/about',
            normalizedUrl: 'https://example.com/about',
            text: 'About',
            isInternal: true,
            isAnchor: false,
            isMailtoOrTel: false,
            selector: 'a#about',
          },
          {
            href: '/contact',
            normalizedUrl: 'https://example.com/contact',
            text: 'Contact',
            isInternal: true,
            isAnchor: false,
            isMailtoOrTel: false,
            selector: 'a#contact',
          },
          {
            href: 'https://twitter.com/example',
            normalizedUrl: 'https://twitter.com/example',
            text: 'Twitter',
            isInternal: false,
            isAnchor: false,
            isMailtoOrTel: false,
            selector: 'a#twitter',
          },
        ],
        buttons: [{ text: 'Login', type: 'button', selector: '#login', isVisible: true, isDisabled: false, riskLevel: 'LOW' }],
        forms: [],
        images: [],
        navigations: [],
        totalInteractiveCount: 4,
        timestamp: 1000,
      };

      const newlyEnqueued = crawler.addPageSnapshot(mockSnapshot1, 0);

      // Enqueued internal links
      expect(newlyEnqueued).toContain('https://example.com/about');
      expect(newlyEnqueued).toContain('https://example.com/contact');
      expect(newlyEnqueued).not.toContain('https://twitter.com/example');

      // Map before popping
      const map = crawler.buildDiscoveryMap('session_test');
      expect(map.totalButtons).toBe(1);
      expect(map.totalInternalLinks).toBe(2);
      expect(map.totalDiscoveredPages).toBe(3); // 1 visited + 2 in queue

      // Next crawlable URL
      const next = crawler.getNextUrlToCrawl();
      expect(next).not.toBeNull();
      expect(['https://example.com/about', 'https://example.com/contact']).toContain(next?.url);
    });
  });
});
