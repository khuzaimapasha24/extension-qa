import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';
import { AIConfig } from '../shared/types/session';
import { cloudLlmClient } from '../ai/cloud-llm-client';
import { extractJsonFromResponse } from '../ai/prompt-templates';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('BusinessLogicVerifier');

export interface PricingSummaryBreakdown {
  items: Array<{ name: string; unitPrice: number; quantity: number; lineTotal: number }>;
  subtotal?: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  total?: number;
  rawCurrency?: string;
  foundBreakdown: boolean;
}

export class BusinessLogicVerifier {
  /**
   * Extracts price numbers from currency strings like "$49.99", "€ 100,50", "PKR 5,000"
   */
  public parsePrice(text: string): number | null {
    if (!text || typeof text !== 'string') return null;
    const clean = text.replace(/,/g, '').trim();
    const match = clean.match(/[-+]?\s*(?:[$€£¥₹]|USD|EUR|GBP|PKR)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
    if (!match || !match[1]) return null;
    const val = parseFloat(match[1]);
    const isNegative = text.includes('-') || text.toLowerCase().includes('discount') || text.toLowerCase().includes('off');
    return isNaN(val) ? null : (isNegative && !text.includes('+') ? -Math.abs(val) : val);
  }

  /**
   * Parses visible pricing, cart, and checkout text from page DOM or snapshot.
   */
  public extractPricingSummary(text: string): PricingSummaryBreakdown {
    const breakdown: PricingSummaryBreakdown = {
      items: [],
      foundBreakdown: false,
    };

    if (!text || typeof text !== 'string') {
      return breakdown;
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Subtotal
      if (/subtotal/i.test(line)) {
        const p = this.parsePrice(line) ?? (lines[i + 1] ? this.parsePrice(lines[i + 1]) : null);
        if (p !== null && breakdown.subtotal === undefined) {
          breakdown.subtotal = Math.abs(p);
          breakdown.foundBreakdown = true;
        }
      }

      // Discount / Coupon / Promo
      if (/discount|promo|coupon|voucher|save/i.test(line)) {
        const p = this.parsePrice(line) ?? (lines[i + 1] ? this.parsePrice(lines[i + 1]) : null);
        if (p !== null && breakdown.discount === undefined) {
          breakdown.discount = Math.abs(p);
          breakdown.foundBreakdown = true;
        }
      }

      // Tax / VAT
      if (/\btax\b|\bvat\b|\bgst\b/i.test(line)) {
        const p = this.parsePrice(line) ?? (lines[i + 1] ? this.parsePrice(lines[i + 1]) : null);
        if (p !== null && breakdown.tax === undefined) {
          breakdown.tax = Math.abs(p);
          breakdown.foundBreakdown = true;
        }
      }

      // Shipping
      if (/\bshipping\b|\bdelivery\b/i.test(line)) {
        if (/free/i.test(line)) {
          breakdown.shipping = 0;
          breakdown.foundBreakdown = true;
        } else {
          const p = this.parsePrice(line) ?? (lines[i + 1] ? this.parsePrice(lines[i + 1]) : null);
          if (p !== null && breakdown.shipping === undefined) {
            breakdown.shipping = Math.abs(p);
            breakdown.foundBreakdown = true;
          }
        }
      }

      // Total / Grand Total
      if (/(?:grand\s+total|^total\b|\bfinal\s+price\b)/i.test(line) && !/subtotal/i.test(line)) {
        const p = this.parsePrice(line) ?? (lines[i + 1] ? this.parsePrice(lines[i + 1]) : null);
        if (p !== null && breakdown.total === undefined) {
          breakdown.total = Math.abs(p);
          breakdown.foundBreakdown = true;
        }
      }
    }

    return breakdown;
  }

  /**
   * Verifies mathematical calculation consistency on pricing and checkout figures.
   */
  public verifyCalculations(breakdown: PricingSummaryBreakdown, sessionId: string, pageUrl: string): Finding[] {
    const findings: Finding[] = [];
    if (!breakdown.foundBreakdown) return findings;

    const subtotal = breakdown.subtotal ?? 0;
    const discount = breakdown.discount ?? 0;
    const tax = breakdown.tax ?? 0;
    const shipping = breakdown.shipping ?? 0;
    const total = breakdown.total;

    // Check 1: Calculation equation validation: Subtotal - Discount + Tax + Shipping == Total
    if (total !== undefined && (subtotal > 0 || discount > 0 || tax > 0 || shipping > 0)) {
      const expectedTotal = Math.round((subtotal - discount + tax + shipping) * 100) / 100;
      const actualTotal = Math.round(total * 100) / 100;
      const difference = Math.abs(expectedTotal - actualTotal);

      if (difference >= 0.05) {
        findings.push({
          id: `finding_biz_calc_${sessionId}_${Date.now()}`,
          sessionId,
          category: 'FUNCTIONAL',
          severity: 'CRITICAL',
          status: 'FAIL',
          confidence: 0.98,
          title: '[Business Logic] Checkout Math & Pricing Calculation Mismatch',
          description: `Discrepancy detected in checkout pricing arithmetic: Subtotal (${subtotal}) - Discount (${discount}) + Tax (${tax}) + Shipping (${shipping}) equals ${expectedTotal}, but the displayed total is ${actualTotal} (Difference: ${difference.toFixed(2)}).`,
          page: pageUrl,
          steps: [
            `Navigate to ${pageUrl}`,
            'Locate pricing and order summary section',
            `Verify equation: ${subtotal} - ${discount} + ${tax} + ${shipping} vs displayed ${actualTotal}`,
          ],
          expected: `Displayed total must equal ${expectedTotal.toFixed(2)} based on line items, discounts, and taxes`,
          actual: `Displayed total is ${actualTotal.toFixed(2)} (Discrepancy of ${difference.toFixed(2)})`,
          recommendation: 'Review cart calculation utility and rounding precision logic to ensure taxes and discounts match the grand total accurately.',
          evidence: [
            {
              type: 'metric',
              description: 'Pricing breakdown math comparison',
              data: { subtotal, discount, tax, shipping, expectedTotal, actualTotal, difference },
              timestamp: Date.now(),
            },
          ],
          retestCount: 0,
          timestamp: Date.now(),
        });
      }
    }

    // Check 2: Negative total check
    if (total !== undefined && total < 0) {
      findings.push({
        id: `finding_biz_negative_total_${sessionId}_${Date.now()}`,
        sessionId,
        category: 'FUNCTIONAL',
        severity: 'CRITICAL',
        status: 'FAIL',
        confidence: 0.99,
        title: '[Business Logic] Negative Order Total Detected',
        description: `Order total calculated to a negative amount (${total}). Discounts or credits exceed cart value without a zero-floor barrier.`,
        page: pageUrl,
        steps: [
          `Navigate to ${pageUrl}`,
          'Inspect cart grand total with discount applied',
        ],
        expected: 'Grand total must be bounded at a minimum of 0.00',
        actual: `Grand total displayed as negative value: ${total}`,
        recommendation: 'Enforce Math.max(0, total) on checkout totals to prevent negative merchant liabilities.',
        evidence: [
          {
            type: 'metric',
            description: 'Negative total breakdown',
            data: { subtotal, discount, total },
            timestamp: Date.now(),
          },
        ],
        retestCount: 0,
        timestamp: Date.now(),
      });
    }

    return findings;
  }

  /**
   * Complete business logic audit on a page snapshot, enriched by Cloud LLM when available.
   */
  public async auditBusinessLogic(
    snapshot: PageSnapshot,
    sessionId: string,
    rawTextContentOrAiConfig?: string | AIConfig,
    maybeAiConfig?: AIConfig
  ): Promise<Finding[]> {
    logger.info(`Auditing business logic & pricing rules on ${snapshot.url}...`);

    let rawTextContent: string | undefined;
    let aiConfig: AIConfig | undefined;

    if (typeof rawTextContentOrAiConfig === 'string') {
      rawTextContent = rawTextContentOrAiConfig;
      aiConfig = maybeAiConfig;
    } else if (rawTextContentOrAiConfig && typeof rawTextContentOrAiConfig === 'object') {
      aiConfig = rawTextContentOrAiConfig;
    }

    const linksText = Array.isArray(snapshot.links) ? snapshot.links.map((l) => l.text).join('\n') : '';
    const buttonsText = Array.isArray(snapshot.buttons) ? snapshot.buttons.map((b) => b.text).join('\n') : '';
    const content = rawTextContent || `${snapshot.title || ''}\n${linksText}\n${buttonsText}`;
    const breakdown = this.extractPricingSummary(content);
    const findings = this.verifyCalculations(breakdown, sessionId, snapshot.url);

    // AI Enrichment for complex promotional logic & acceptance criteria
    const activeProvider = cloudLlmClient.resolveActiveProvider(aiConfig);
    if (activeProvider.isCloud && activeProvider.apiKey && breakdown.foundBreakdown) {
      try {
        const prompt = `You are a Principal QA Automation Engineer verifying e-commerce and financial business logic.
Audited URL: ${snapshot.url}
Discovered Pricing Breakdown:
${JSON.stringify(breakdown, null, 2)}

Analyze whether there are any subtle business logic defects, discount percentage flaws, currency formatting inconsistencies, or missing checkout disclosure rules.
Respond strictly in valid JSON:
{
  "hasDefect": boolean,
  "defectTitle": string,
  "defectDescription": string,
  "suggestedFix": string
}`;

        const aiResponse = await cloudLlmClient.generateCompletion(prompt, { maxTokens: 400, temperature: 0.1 }, aiConfig);
        if (aiResponse) {
          const parsed = extractJsonFromResponse<{
            hasDefect?: boolean;
            defectTitle?: string;
            defectDescription?: string;
            suggestedFix?: string;
          }>(aiResponse, { hasDefect: false });

          if (parsed.hasDefect && parsed.defectTitle && parsed.defectDescription) {
            findings.push({
              id: `finding_biz_ai_${sessionId}_${Date.now()}`,
              sessionId,
              category: 'FUNCTIONAL',
              severity: 'HIGH',
              status: 'FAIL',
              confidence: 0.92,
              title: `[Business Logic] ${parsed.defectTitle}`,
              description: parsed.defectDescription,
              page: snapshot.url,
              steps: [
                `Navigate to ${snapshot.url}`,
                'Inspect pricing and commercial checkout terms',
                `Observe business rule anomaly: ${parsed.defectTitle}`,
              ],
              expected: 'Commercial transactions and promotions adhere to standard business expectations',
              actual: parsed.defectDescription,
              recommendation: parsed.suggestedFix || 'Align business logic calculation with product terms.',
              evidence: [
                {
                  type: 'metric',
                  description: 'AI verified pricing anomaly',
                  data: { breakdown, aiAnalysis: parsed },
                  timestamp: Date.now(),
                },
              ],
              retestCount: 0,
              timestamp: Date.now(),
            });
          }
        }
      } catch (err) {
        logger.warn('AI Business Logic audit check encountered error:', err);
      }
    }

    return findings;
  }
}

export const businessLogicVerifier = new BusinessLogicVerifier();
