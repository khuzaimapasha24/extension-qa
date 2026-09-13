import { Finding } from '../shared/types/qa';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('VisualRegressionAuditor');

export interface VisualAuditOptions {
  checkBrokenImages?: boolean;
  checkTypographyHierarchy?: boolean;
  checkHorizontalOverflow?: boolean;
  checkOccludedElements?: boolean;
}

/**
 * Visual Regression & Layout Integrity Auditor.
 * Detects visual anomalies, broken assets, horizontal blowout, and typography flaws.
 */
export class VisualRegressionAuditor {
  /**
   * Audits a live DOM tree for visual, layout, and rendering defects.
   */
  public audit(
    doc: Document,
    pageUrl: string,
    sessionId: string,
    options: VisualAuditOptions = {}
  ): Finding[] {
    const {
      checkBrokenImages = true,
      checkTypographyHierarchy = true,
      checkHorizontalOverflow = true,
      checkOccludedElements = true,
    } = options;

    const findings: Finding[] = [];
    if (!doc) return findings;

    logger.info(`Running visual regression & layout audit on ${pageUrl}...`);

    // 1. Broken Image Detection
    if (checkBrokenImages) {
      const images = Array.from(doc.querySelectorAll<HTMLImageElement>('img'));
      for (const img of images) {
        const src = img.getAttribute('src');
        const isBroken =
          !src ||
          src.trim() === '' ||
          src === '#' ||
          (typeof img.naturalWidth === 'number' && img.complete && img.naturalWidth === 0);

        if (isBroken) {
          const selector = img.id ? `#${img.id}` : img.className ? `img.${img.className.split(' ')[0]}` : 'img';
          findings.push({
            id: `finding_vis_img_${sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sessionId,
            page: pageUrl,
            category: 'FUNCTIONAL',
            severity: 'MEDIUM',
            status: 'FAIL',
            confidence: 0.95,
            title: '[Visual Defect] Broken or Missing Image Asset',
            description: `An image element failed to render or has an invalid/missing src attribute: "${src || 'none'}". Alt: "${img.alt || 'none'}".`,
            elementSelector: selector,
            steps: [
              `Navigate to ${pageUrl}`,
              `Locate image element: ${selector}`,
              'Observe broken image icon or empty zero-dimension placeholder',
            ],
            expected: 'All image assets must have valid URLs and render successfully without 404 or decoding errors.',
            actual: `Image is broken (src: "${src || 'empty'}")`,
            recommendation: 'Verify asset deployment path, update image URL, and ensure responsive fallback image is provided.',
            timestamp: Date.now(),
            retestCount: 0,
          });
        }
      }
    }

    // 2. Typography Hierarchy Anomaly Detection
    if (checkTypographyHierarchy) {
      const h1Elements = Array.from(doc.querySelectorAll('h1'));

      // Check if page is missing an H1 entirely
      if (h1Elements.length === 0) {
        findings.push({
          id: `finding_vis_h1_missing_${sessionId}_${Date.now()}`,
          sessionId,
          page: pageUrl,
          category: 'ACCESSIBILITY',
          severity: 'LOW',
          status: 'FAIL',
          confidence: 0.96,
          title: '[Visual Hierarchy] Missing Primary Heading (H1)',
          description: 'The page does not contain a top-level <h1> heading tag, violating visual typographic hierarchy and accessibility guidelines.',
          steps: [`Inspect document heading outline on ${pageUrl}`],
          expected: 'Page must include exactly one prominent <h1> tag identifying the page topic.',
          actual: '0 <h1> tags found in DOM',
          recommendation: 'Add a semantic <h1> heading at the top of the primary content section.',
          timestamp: Date.now(),
          retestCount: 0,
        });
      }

      // Check for multiple H1 tags (confuses hierarchy)
      if (h1Elements.length > 2) {
        findings.push({
          id: `finding_vis_h1_multiple_${sessionId}_${Date.now()}`,
          sessionId,
          page: pageUrl,
          category: 'ACCESSIBILITY',
          severity: 'LOW',
          status: 'FAIL',
          confidence: 0.91,
          title: `[Visual Hierarchy] Excessive Top-Level Headings (${h1Elements.length} H1 tags)`,
          description: `Page declares ${h1Elements.length} separate <h1> tags, which flattens the typographic document outline.`,
          steps: [`Inspect heading structure on ${pageUrl}`],
          expected: 'Page should maintain a single primary <h1> with subsections using <h2> and <h3>.',
          actual: `${h1Elements.length} <h1> tags detected`,
          recommendation: 'Demote subordinate section headings from <h1> to <h2>.',
          timestamp: Date.now(),
          retestCount: 0,
        });
      }
    }

    // 3. Horizontal Viewport Overflow Detection
    if (checkHorizontalOverflow && typeof window !== 'undefined' && doc.documentElement) {
      const scrollWidth = doc.documentElement.scrollWidth;
      const clientWidth = doc.documentElement.clientWidth;

      if (scrollWidth > clientWidth + 10) {
        findings.push({
          id: `finding_vis_overflow_${sessionId}_${Date.now()}`,
          sessionId,
          page: pageUrl,
          category: 'RESPONSIVE',
          severity: 'HIGH',
          status: 'FAIL',
          confidence: 0.98,
          title: '[Layout Defect] Horizontal Viewport Blowout Detected',
          description: `Document content overflows the viewport width (scrollWidth: ${scrollWidth}px > clientWidth: ${clientWidth}px), creating an unintended horizontal scrollbar and broken mobile layout.`,
          steps: [
            `Navigate to ${pageUrl}`,
            'Observe horizontal scrollbar on document body',
            'Scroll right to inspect clipped / overflowing container',
          ],
          expected: 'Page content must fit entirely within viewport width without horizontal scrollbars.',
          actual: `Unintended horizontal overflow of ${scrollWidth - clientWidth}px`,
          recommendation: 'Inspect fixed-width elements (e.g. min-width: 1200px or wide tables) and apply max-width: 100% or overflow-x: auto.',
          timestamp: Date.now(),
          retestCount: 0,
        });
      }
    }

    // 4. Zero-dimension or Occluded Interactive Controls
    if (checkOccludedElements) {
      const buttons = Array.from(doc.querySelectorAll<HTMLButtonElement>('button'));
      for (const btn of buttons.slice(0, 20)) {
        if (typeof btn.getBoundingClientRect === 'function') {
          const rect = btn.getBoundingClientRect();
          const hasZeroDimension = rect.width === 0 && rect.height === 0;
          const isHiddenAttr = btn.hasAttribute('hidden') || btn.style.display === 'none';

          if (hasZeroDimension && !isHiddenAttr && btn.textContent && btn.textContent.trim().length > 0) {
            findings.push({
              id: `finding_vis_zero_btn_${sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              sessionId,
              page: pageUrl,
              category: 'FUNCTIONAL',
              severity: 'MEDIUM',
              status: 'FAIL',
              confidence: 0.92,
              title: `[Visual Defect] Collapsed / Zero-Dimension Interactive Button "${btn.textContent.trim().slice(0, 20)}"`,
              description: `Button element has text content "${btn.textContent.trim()}" but computed bounding client rect has width: 0px and height: 0px, making it unclickable for users.`,
              elementSelector: btn.id ? `#${btn.id}` : 'button',
              steps: [`Locate button "${btn.textContent.trim()}" on ${pageUrl}`],
              expected: 'Interactive buttons must have clickable dimensions (min 24x24px recommended).',
              actual: 'Button rendered with 0x0px dimensions',
              recommendation: 'Check CSS display, overflow, or float properties collapsing the button container.',
              timestamp: Date.now(),
              retestCount: 0,
            });
          }
        }
      }
    }

    return findings;
  }
}

export const visualRegressionAuditor = new VisualRegressionAuditor();
