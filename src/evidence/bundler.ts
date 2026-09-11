import { Finding, EvidenceItem, CropRegion } from '../shared/types/qa';
import { captureTabScreenshot, cropScreenshotToElement } from './screenshot';
import { sendToTab } from '../shared/messaging/bus';
import { redactor } from '../shared/security/redactor';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('EvidenceBundler');

export interface EvidenceEnrichmentOptions {
  captureScreenshots?: boolean;
  maxScreenshotsPerRun?: number;
}

/**
 * Enriches a single finding with multi-modal evidence (DOM snippet, element screenshot).
 */
export async function enrichFinding(
  finding: Finding,
  tabId?: number,
  options: { captureScreenshot?: boolean } = {}
): Promise<Finding> {
  const enriched: Finding = {
    ...finding,
    evidence: [...finding.evidence],
  };

  // 1. Ensure DOM snippet evidence exists if selector is present
  if (enriched.selector) {
    const hasDomSnippet = enriched.evidence.some((e) => e.type === 'dom_snippet');
    if (!hasDomSnippet) {
      enriched.evidence.push({
        type: 'dom_snippet',
        description: `Target element selector: ${enriched.selector}`,
        data: {
          selector: enriched.selector,
          outerHTML: enriched.element ? `<${enriched.element} ...>` : enriched.selector,
          tagName: enriched.element || 'element',
          attributes: {},
        },
        timestamp: Date.now(),
      });
    }
  }

  // 2. Capture element screenshot if requested and selector is present
  if (options.captureScreenshot && enriched.selector && tabId) {
    const hasScreenshot = enriched.evidence.some((e) => e.type === 'screenshot');
    if (!hasScreenshot) {
      try {
        // Request element bounding box from content script
        const highlightRes = await sendToTab(tabId, 'HIGHLIGHT_ELEMENT', {
          selector: enriched.selector,
          durationMs: 3000,
          label: enriched.title,
        });

        const rect = (highlightRes as { rect?: CropRegion })?.rect;

        // Capture visible tab screenshot
        const fullScreenshot = await captureTabScreenshot(tabId);
        if (fullScreenshot) {
          let screenshotItem: EvidenceItem;

          if (rect) {
            const cropped = await cropScreenshotToElement(fullScreenshot, rect);
            screenshotItem = {
              type: 'screenshot',
              description: `Visual screenshot crop for ${enriched.selector}`,
              data: {
                dataUrl: cropped.dataUrl,
                width: cropped.width,
                height: cropped.height,
                cropRegion: cropped.cropRegion,
                isElementCrop: cropped.isElementCrop,
              },
              timestamp: Date.now(),
            };
          } else {
            screenshotItem = {
              type: 'screenshot',
              description: `Full page screenshot for finding: ${enriched.title}`,
              data: {
                dataUrl: fullScreenshot,
                width: 1280,
                height: 800,
                isElementCrop: false,
              },
              timestamp: Date.now(),
            };
          }

          enriched.evidence.push(screenshotItem);
          logger.info(`Attached screenshot evidence to finding: ${enriched.id}`);
        }
      } catch (err) {
        logger.warn(`Could not capture screenshot for finding ${enriched.id}`, err);
      }
    }
  }

  // Security & Privacy: sanitize any potential credentials, card numbers, or PII
  enriched.title = redactor.redactText(enriched.title);
  enriched.description = redactor.redactText(enriched.description);
  enriched.expected = redactor.redactText(enriched.expected);
  enriched.actual = redactor.redactText(enriched.actual);
  if (enriched.recommendation) {
    enriched.recommendation = redactor.redactText(enriched.recommendation);
  }
  enriched.steps = enriched.steps.map((s) => redactor.redactText(s));

  for (const item of enriched.evidence) {
    item.description = redactor.redactText(item.description);
    if (item.type !== 'screenshot' && typeof item.data === 'object' && item.data !== null) {
      item.data = redactor.redactDeep(item.data as any);
    } else if (typeof item.data === 'string') {
      item.data = redactor.redactText(item.data);
    }
  }

  return enriched;
}

/**
 * Enriches a batch of findings with multi-modal evidence.
 * Prioritizes CRITICAL and HIGH severity findings with selectors for screenshot captures.
 */
export async function enrichFindingsBatch(
  findings: Finding[],
  tabId?: number,
  options: EvidenceEnrichmentOptions = {}
): Promise<Finding[]> {
  const captureScreenshots = options.captureScreenshots ?? true;
  const maxScreenshots = options.maxScreenshotsPerRun ?? 6;

  let screenshotsCaptured = 0;
  const result: Finding[] = [];

  for (const finding of findings) {
    const shouldCaptureScreenshot =
      captureScreenshots &&
      Boolean(finding.selector) &&
      (finding.severity === 'CRITICAL' || finding.severity === 'HIGH') &&
      screenshotsCaptured < maxScreenshots;

    const enriched = await enrichFinding(finding, tabId, {
      captureScreenshot: shouldCaptureScreenshot,
    });

    if (shouldCaptureScreenshot && enriched.evidence.some((e) => e.type === 'screenshot')) {
      screenshotsCaptured += 1;
    }

    result.push(enriched);
  }

  logger.info(`Batch enrichment completed: ${result.length} findings processed, ${screenshotsCaptured} visual screenshots attached.`);
  return result;
}
