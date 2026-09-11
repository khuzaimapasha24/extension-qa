import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  highlightElement,
  getElementCropCoordinates,
  clearHighlights,
} from '../../src/content/dom-highlighter';

describe('DOMHighlighter', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="container" style="width: 800px; height: 600px;">
        <button id="btn-submit" style="width: 120px; height: 40px;">Submit Order</button>
        <a id="bad-link" href="#" style="width: 80px; height: 20px;">Click here</a>
      </div>
    `;
  });

  afterEach(() => {
    clearHighlights(document);
    document.body.innerHTML = '';
  });

  it('creates a visible pulsing overlay and badge for target element', () => {
    const btn = document.querySelector('#btn-submit') as HTMLElement;
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      width: 120,
      height: 40,
      right: 220,
      bottom: 90,
      x: 100,
      y: 50,
      toJSON: () => {},
    });

    const result = highlightElement('#btn-submit', 'Submit Button', 5000, document);

    expect(result.highlighted).toBe(true);
    expect(result.rect).toBeDefined();
    expect(result.rect?.x).toBe(100);
    expect(result.rect?.y).toBe(50);
    expect(result.rect?.width).toBe(120);
    expect(result.rect?.height).toBe(40);

    const overlay = document.getElementById('ai-qa-highlight-overlay-container');
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('Submit Button');
  });

  it('returns highlighted: false when selector does not match any element', () => {
    const result = highlightElement('#non-existent-selector', undefined, 5000, document);
    expect(result.highlighted).toBe(false);

    const overlay = document.getElementById('ai-qa-highlight-overlay-container');
    expect(overlay).toBeNull();
  });

  it('calculates DPR-scaled and padded crop coordinates clamped to viewport', () => {
    const link = document.querySelector('#bad-link') as HTMLElement;
    vi.spyOn(link, 'getBoundingClientRect').mockReturnValue({
      left: 50,
      top: 100,
      width: 80,
      height: 20,
      right: 130,
      bottom: 120,
      x: 50,
      y: 100,
      toJSON: () => {},
    });

    const mockWindow = {
      devicePixelRatio: 2,
      innerWidth: 1000,
      innerHeight: 800,
    } as unknown as Window;

    const coords = getElementCropCoordinates('#bad-link', 10, document, mockWindow);

    expect(coords).not.toBeNull();
    // (50 - 10) * 2 = 80
    expect(coords?.x).toBe(80);
    // (100 - 10) * 2 = 180
    expect(coords?.y).toBe(180);
    // (80 + 20) * 2 = 200
    expect(coords?.width).toBe(200);
    // (20 + 20) * 2 = 80
    expect(coords?.height).toBe(80);
  });

  it('clears active highlight overlays on demand', () => {
    highlightElement('#btn-submit', 'Submit', 5000, document);
    expect(document.getElementById('ai-qa-highlight-overlay-container')).not.toBeNull();

    clearHighlights(document);
    expect(document.getElementById('ai-qa-highlight-overlay-container')).toBeNull();
  });
});
