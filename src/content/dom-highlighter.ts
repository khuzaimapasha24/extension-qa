import { CropRegion } from '../shared/types/qa';
import { findDOMElement } from './action-simulator';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('DOMHighlighter');
const OVERLAY_CONTAINER_ID = 'ai-qa-highlight-overlay-container';

let activeTimeout: ReturnType<typeof setTimeout> | null = null;

export interface HighlightResult {
  highlighted: boolean;
  rect?: CropRegion;
}

/**
 * Highlights a target DOM element on the page with a glowing pulsating outline and label.
 */
export function highlightElement(
  selector: string,
  label?: string,
  durationMs: number = 5000,
  doc: Document = document
): HighlightResult {
  try {
    const el = findDOMElement(selector, { textHint: label }, doc);
    if (!el || !(el instanceof HTMLElement || el instanceof SVGElement)) {
      logger.debug(`Element not found for highlight selector: ${selector}`);
      return { highlighted: false };
    }

    // Scroll target into view
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }

    // Measure bounding box
    const rect = el.getBoundingClientRect();
    const cropRegion: CropRegion = {
      x: Math.max(0, Math.round(rect.left)),
      y: Math.max(0, Math.round(rect.top)),
      width: Math.max(10, Math.round(rect.width)),
      height: Math.max(10, Math.round(rect.height)),
    };

    // Remove any existing highlight overlay
    clearHighlights(doc);

    // Create highlight overlay container
    const container = doc.createElement('div');
    container.id = OVERLAY_CONTAINER_ID;
    container.setAttribute('aria-hidden', 'true');
    container.style.cssText = `
      position: fixed;
      left: ${cropRegion.x}px;
      top: ${cropRegion.y}px;
      width: ${cropRegion.width}px;
      height: ${cropRegion.height}px;
      border: 3px solid #f85149;
      box-shadow: 0 0 16px rgba(248, 81, 73, 0.7), inset 0 0 8px rgba(248, 81, 73, 0.25);
      border-radius: 4px;
      pointer-events: none;
      z-index: 2147483647;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    `;

    // Create informative badge
    const badgeText = label || selector;
    const badge = doc.createElement('div');
    badge.style.cssText = `
      position: absolute;
      top: -26px;
      left: 0;
      background: #f85149;
      color: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      white-space: nowrap;
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      pointer-events: none;
    `;
    badge.textContent = `🔍 ${badgeText}`;
    container.appendChild(badge);

    doc.body.appendChild(container);

    // Set automatic removal timer
    if (durationMs > 0) {
      activeTimeout = setTimeout(() => {
        clearHighlights(doc);
      }, durationMs);
    }

    logger.info(`Highlighted element: ${selector}`);
    return {
      highlighted: true,
      rect: cropRegion,
    };
  } catch (err) {
    logger.debug(`Error highlighting element ${selector}`, err);
    return { highlighted: false };
  }
}

/**
 * Calculates pixel-density scaled crop coordinates with padding for screenshot extraction.
 */
export function getElementCropCoordinates(
  selector: string,
  padding: number = 24,
  doc: Document = document,
  win: Window = window
): CropRegion | null {
  try {
    const el = doc.querySelector(selector);
    if (!el || !(el instanceof HTMLElement || el instanceof SVGElement)) {
      return null;
    }

    const rect = el.getBoundingClientRect();
    const dpr = win.devicePixelRatio || 1;
    const viewWidth = (win.innerWidth || doc.documentElement.clientWidth || 1280) * dpr;
    const viewHeight = (win.innerHeight || doc.documentElement.clientHeight || 800) * dpr;

    const scaledX = (rect.left - padding) * dpr;
    const scaledY = (rect.top - padding) * dpr;
    const scaledW = (rect.width + padding * 2) * dpr;
    const scaledH = (rect.height + padding * 2) * dpr;

    const clampedX = Math.max(0, Math.round(scaledX));
    const clampedY = Math.max(0, Math.round(scaledY));
    const clampedW = Math.min(viewWidth - clampedX, Math.round(scaledW));
    const clampedH = Math.min(viewHeight - clampedY, Math.round(scaledH));

    return {
      x: clampedX,
      y: clampedY,
      width: Math.max(20, clampedW),
      height: Math.max(20, clampedH),
    };
  } catch (err) {
    logger.debug(`Failed to get crop coordinates for ${selector}`, err);
    return null;
  }
}

/**
 * Removes the highlight overlay from the document.
 */
export function clearHighlights(doc: Document = document): void {
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }

  const existing = doc.getElementById(OVERLAY_CONTAINER_ID);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}
