import { PageMetadata, DiscoveredImage } from '../shared/types/discovery';
import { generateUniqueSelector } from './element-detector';

/**
 * Extracts head metadata, OpenGraph tags, and heading hierarchy from the document.
 */
export function extractPageMetadata(doc: Document = document): PageMetadata {
  const getMeta = (selector: string): string | undefined => {
    const el = doc.querySelector(selector);
    return el?.getAttribute('content') || undefined;
  };

  const canonicalEl = doc.querySelector('link[rel="canonical"]');
  const canonical = canonicalEl?.getAttribute('href') || undefined;

  const h1Elements = Array.from(doc.querySelectorAll('h1'));
  const h1Texts = h1Elements
    .map((el) => el.textContent?.trim() || '')
    .filter((text) => text.length > 0);

  const headingCounts = {
    h1: h1Elements.length,
    h2: doc.querySelectorAll('h2').length,
    h3: doc.querySelectorAll('h3').length,
    h4: doc.querySelectorAll('h4').length,
    h5: doc.querySelectorAll('h5').length,
    h6: doc.querySelectorAll('h6').length,
  };

  const charsetEl = doc.querySelector('meta[charset]') || doc.querySelector('meta[http-equiv="Content-Type"]');
  const charset = charsetEl?.getAttribute('charset') || charsetEl?.getAttribute('content') || undefined;

  return {
    title: doc.title || '',
    description: getMeta('meta[name="description"]'),
    canonical,
    robots: getMeta('meta[name="robots"]'),
    ogTitle: getMeta('meta[property="og:title"]'),
    ogDescription: getMeta('meta[property="og:description"]'),
    ogImage: getMeta('meta[property="og:image"]'),
    lang: doc.documentElement.lang || undefined,
    charset,
    viewport: getMeta('meta[name="viewport"]'),
    h1Count: h1Elements.length,
    h1Texts,
    headingCounts,
  };
}

/**
 * Extracts all images with alt attributes and dimension data.
 */
export function extractImages(doc: Document = document): DiscoveredImage[] {
  const imageElements = Array.from(doc.querySelectorAll('img'));

  return imageElements.map((img) => {
    const src = img.src || img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const hasAltText = alt.trim().length > 0;

    const naturalWidth = img.naturalWidth || img.width || 0;
    const naturalHeight = img.naturalHeight || img.height || 0;

    // An image is considered broken if it completed loading but has 0 natural dimensions
    const isBroken = Boolean(img.complete && naturalWidth === 0 && src.length > 0);

    return {
      src,
      alt,
      hasAltText,
      naturalWidth,
      naturalHeight,
      isBroken,
      loading: img.getAttribute('loading') || undefined,
      selector: generateUniqueSelector(img),
    };
  });
}
