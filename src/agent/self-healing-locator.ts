import { createLogger } from '../shared/logger/logger';

const logger = createLogger('SelfHealingLocator');

export type HealingStrategy =
  | 'SEMANTIC_ROLE'
  | 'TEXT_SIMILARITY'
  | 'FORM_CONTROL_MATCH'
  | 'CONTAINER_PROXIMITY'
  | 'ARIA_MATCH';

export interface TargetElementHints {
  tag?: string;
  text?: string;
  name?: string;
  ariaLabel?: string;
  role?: string;
  inputType?: string;
  placeholder?: string;
}

export interface HealedLocatorResult {
  healed: boolean;
  element: HTMLElement | null;
  originalSelector: string;
  healedSelector: string;
  strategy: HealingStrategy | 'NONE';
  confidence: number;
  reason: string;
}

/**
 * Calculates string similarity between 0.0 and 1.0 (Dice's coefficient / token matching).
 */
function calculateTextSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || '').trim().toLowerCase();
  const s2 = (str2 || '').trim().toLowerCase();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w) && w.length > 2) intersection++;
  }
  const total = Math.max(words1.size, words2.size);
  return total > 0 ? intersection / total : 0;
}

/**
 * Self-Healing Locator Engine.
 * Automatically recovers broken locators during autonomous test execution using multi-tier heuristics:
 * - Semantic Role & ARIA
 * - Text Similarity & Label Proximity
 * - Form Control Name & Placeholder Fallbacks
 * - Container Ancestry Search
 */
export class SelfHealingLocator {
  /**
   * Attempts to heal a failing selector using target element hints.
   */
  public heal(
    doc: Document,
    originalSelector: string,
    hints: TargetElementHints = {}
  ): HealedLocatorResult {
    const failedResult: HealedLocatorResult = {
      healed: false,
      element: null,
      originalSelector,
      healedSelector: originalSelector,
      strategy: 'NONE',
      confidence: 0,
      reason: 'No suitable candidate element matched healing heuristics.',
    };

    if (!doc) return failedResult;

    // Strategy 1: Form Control Match by Name or Placeholder
    if (hints.name || hints.placeholder) {
      const nameMatch = hints.name ? doc.querySelector<HTMLElement>(`[name="${hints.name}"]`) : null;
      if (nameMatch) {
        logger.info(`Self-healed selector "${originalSelector}" via name="${hints.name}"`);
        return {
          healed: true,
          element: nameMatch,
          originalSelector,
          healedSelector: `[name="${hints.name}"]`,
          strategy: 'FORM_CONTROL_MATCH',
          confidence: 0.96,
          reason: `Element recovered via distinct name attribute "${hints.name}".`,
        };
      }

      if (hints.placeholder) {
        const placeholderMatch = doc.querySelector<HTMLElement>(`[placeholder*="${hints.placeholder}" i]`);
        if (placeholderMatch) {
          logger.info(`Self-healed selector "${originalSelector}" via placeholder`);
          return {
            healed: true,
            element: placeholderMatch,
            originalSelector,
            healedSelector: `[placeholder*="${hints.placeholder}"]`,
            strategy: 'FORM_CONTROL_MATCH',
            confidence: 0.91,
            reason: `Input recovered via matching placeholder text "${hints.placeholder}".`,
          };
        }
      }
    }

    // Strategy 2: ARIA Label or Accessibility Title
    if (hints.ariaLabel) {
      const ariaMatch = doc.querySelector<HTMLElement>(`[aria-label*="${hints.ariaLabel}" i], [title*="${hints.ariaLabel}" i]`);
      if (ariaMatch) {
        logger.info(`Self-healed selector "${originalSelector}" via ARIA label`);
        return {
          healed: true,
          element: ariaMatch,
          originalSelector,
          healedSelector: `[aria-label*="${hints.ariaLabel}"]`,
          strategy: 'ARIA_MATCH',
          confidence: 0.94,
          reason: `Interactive element recovered via accessible label "${hints.ariaLabel}".`,
        };
      }
    }

    // Strategy 3: Text Similarity on Interactive Elements
    if (hints.text && hints.text.trim().length > 1) {
      const targetText = hints.text.trim();
      const candidates = Array.from(
        doc.querySelectorAll<HTMLElement>(
          'button, a, [role="button"], [role="tab"], [role="link"], input[type="submit"], input[type="button"]'
        )
      );

      let bestCandidate: HTMLElement | null = null;
      let highestScore = 0;

      for (const el of candidates) {
        const textContent = (el.textContent || (el as HTMLInputElement).value || '').trim();
        const score = calculateTextSimilarity(targetText, textContent);
        if (score > highestScore && score >= 0.7) {
          highestScore = score;
          bestCandidate = el;
        }
      }

      if (bestCandidate) {
        const tag = bestCandidate.tagName.toLowerCase();
        const cleanText = targetText.slice(0, 30).replace(/["']/g, '');
        const healedSelector = `${tag}:has-text("${cleanText}")`;
        logger.info(`Self-healed selector "${originalSelector}" to "${healedSelector}" (confidence: ${highestScore})`);

        return {
          healed: true,
          element: bestCandidate,
          originalSelector,
          healedSelector,
          strategy: 'TEXT_SIMILARITY',
          confidence: Math.round(highestScore * 100) / 100,
          reason: `Element recovered via visible text similarity with "${targetText}" (score: ${(highestScore * 100).toFixed(0)}%).`,
        };
      }
    }

    // Strategy 4: Semantic Role + Input Type
    if (hints.role || (hints.tag === 'input' && hints.inputType)) {
      if (hints.role) {
        const roleCandidate = doc.querySelector<HTMLElement>(`[role="${hints.role}"]`);
        if (roleCandidate) {
          return {
            healed: true,
            element: roleCandidate,
            originalSelector,
            healedSelector: `[role="${hints.role}"]`,
            strategy: 'SEMANTIC_ROLE',
            confidence: 0.75,
            reason: `Element matched by semantic ARIA role "${hints.role}".`,
          };
        }
      }

      if (hints.inputType) {
        const typeCandidate = doc.querySelector<HTMLElement>(`input[type="${hints.inputType}"]`);
        if (typeCandidate) {
          return {
            healed: true,
            element: typeCandidate,
            originalSelector,
            healedSelector: `input[type="${hints.inputType}"]`,
            strategy: 'FORM_CONTROL_MATCH',
            confidence: 0.72,
            reason: `Form control matched by input type "${hints.inputType}".`,
          };
        }
      }
    }

    // Strategy 5: Container Ancestry Search
    // If selector had a container part like "#cart-modal .submit-button", find the container then search for button
    if (originalSelector.includes(' ')) {
      const parts = originalSelector.split(/\s+/);
      const containerSelector = parts[0];
      try {
        const container = doc.querySelector(containerSelector);
        if (container) {
          const actionElement = container.querySelector<HTMLElement>(
            'button, [role="button"], input[type="submit"], a.btn, a.button'
          );
          if (actionElement) {
            const healedSelector = `${containerSelector} button`;
            logger.info(`Self-healed selector via container search: "${healedSelector}"`);
            return {
              healed: true,
              element: actionElement,
              originalSelector,
              healedSelector,
              strategy: 'CONTAINER_PROXIMITY',
              confidence: 0.82,
              reason: `Primary action element located inside parent container "${containerSelector}".`,
            };
          }
        }
      } catch {}
    }

    return failedResult;
  }
}

export const selfHealingLocator = new SelfHealingLocator();
