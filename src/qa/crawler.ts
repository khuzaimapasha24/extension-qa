import { PageSnapshot, WebsiteDiscoveryMap } from '../shared/types/discovery';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('WebsiteCrawler');

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ref',
  'source',
];

/**
 * Normalizes a URL string by lowercasing host, removing tracking params, and removing hash fragments.
 */
export function normalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    parsed.hash = '';

    // Remove tracking query params
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    let clean = parsed.toString();
    // Strip trailing slash unless it's the root origin
    if (clean.endsWith('/') && clean.length > parsed.origin.length + 1) {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return urlStr;
  }
}

/**
 * Checks if a target URL shares the exact same origin as the root website.
 */
export function isSameOrigin(urlStr: string, rootOrigin: string): boolean {
  try {
    const targetOrigin = new URL(urlStr).origin.toLowerCase();
    return targetOrigin === rootOrigin.toLowerCase();
  } catch {
    return false;
  }
}

export class WebsiteCrawler {
  private rootUrl: string;
  private origin: string;
  private maxPages: number;
  private crawlDepth: number;
  private visitedUrls = new Set<string>();
  private queue: Array<{ url: string; depth: number }> = [];
  private snapshots = new Map<string, PageSnapshot>();

  constructor(rootUrl: string, maxPages = 10, crawlDepth = 2) {
    this.rootUrl = normalizeUrl(rootUrl);
    try {
      this.origin = new URL(this.rootUrl).origin;
    } catch {
      this.origin = '';
    }
    this.maxPages = maxPages;
    this.crawlDepth = crawlDepth;

    // Seed queue with root
    this.queue.push({ url: this.rootUrl, depth: 0 });
  }

  public getRootUrl(): string {
    return this.rootUrl;
  }

  public getOrigin(): string {
    return this.origin;
  }

  /**
   * Incorporates a scanned page snapshot and queues newly discovered internal links.
   */
  public addPageSnapshot(snapshot: PageSnapshot, currentDepth: number): string[] {
    const normalized = normalizeUrl(snapshot.url);
    this.visitedUrls.add(normalized);
    this.snapshots.set(normalized, snapshot);
    // Remove current page from queue if it was pending
    this.queue = this.queue.filter((q) => q.url !== normalized);

    const newlyEnqueued: string[] = [];

    // If we have not exceeded crawl depth, enqueue internal links
    if (currentDepth < this.crawlDepth) {
      for (const link of snapshot.links) {
        if (!link.isInternal || link.isAnchor || link.isMailtoOrTel) continue;

        const cleanLink = normalizeUrl(link.normalizedUrl);
        if (
          !this.visitedUrls.has(cleanLink) &&
          !this.queue.some((item) => item.url === cleanLink) &&
          this.visitedUrls.size + this.queue.length < this.maxPages &&
          isSameOrigin(cleanLink, this.origin)
        ) {
          this.queue.push({ url: cleanLink, depth: currentDepth + 1 });
          newlyEnqueued.push(cleanLink);
        }
      }
    }

    logger.info(`Processed snapshot for ${normalized}. Queue size: ${this.queue.length}, Visited: ${this.visitedUrls.size}`);
    return newlyEnqueued;
  }

  /**
   * Retrieves the next unvisited URL in the queue.
   */
  public getNextUrlToCrawl(): { url: string; depth: number } | null {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item && !this.visitedUrls.has(item.url)) {
        return item;
      }
    }
    return null;
  }

  /**
   * Builds the aggregated discovery map.
   */
  public buildDiscoveryMap(sessionId: string): WebsiteDiscoveryMap {
    const pages = Array.from(this.snapshots.values());
    let totalInternalLinks = 0;
    let totalButtons = 0;
    let totalForms = 0;
    let totalImages = 0;

    for (const p of pages) {
      totalInternalLinks += p.links.filter((l) => l.isInternal).length;
      totalButtons += p.buttons.length;
      totalForms += p.forms.length;
      totalImages += p.images.length;
    }

    return {
      sessionId,
      rootUrl: this.rootUrl,
      origin: this.origin,
      pages,
      totalDiscoveredPages: pages.length + this.queue.length,
      totalInternalLinks,
      totalButtons,
      totalForms,
      totalImages,
      visitedUrls: Array.from(this.visitedUrls),
      queue: this.queue.map((q) => q.url),
    };
  }
}
