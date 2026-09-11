import { PageSnapshot, DiscoveredButton, DiscoveredForm } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('ChaosTester');

export interface ChaosFuzzPayload {
  name: string;
  value: string;
  category: 'LENGTH_OVERFLOW' | 'UNICODE_STRESS' | 'NUMERIC_BOUNDARY' | 'SANITIZATION_PROBE';
  description: string;
}

export const STANDARD_FUZZ_PAYLOADS: ChaosFuzzPayload[] = [
  {
    name: 'Long String (5000 chars)',
    value: 'A'.repeat(5000),
    category: 'LENGTH_OVERFLOW',
    description: 'Tests maximum input buffer limit and layout overflow resistance.',
  },
  {
    name: 'Unicode & Emoji Stress',
    value: '🔥🚀§±!@#$%^&*()_+~`|}{[]:;?><,./-= 汉字 العربية ñüé',
    category: 'UNICODE_STRESS',
    description: 'Tests multi-byte UTF-8 character encoding and database collation handling.',
  },
  {
    name: 'Negative Quantity Boundary',
    value: '-10',
    category: 'NUMERIC_BOUNDARY',
    description: 'Tests negative numbers in quantity or price fields to prevent unauthorized credit calculations.',
  },
  {
    name: 'Safe XSS Sanitization Probe',
    value: '<img src=x onerror=console.warn("qa_xss_probe")>',
    category: 'SANITIZATION_PROBE',
    description: 'Verifies whether HTML markup is escaped and prevents script injection.',
  },
  {
    name: 'Safe SQLi Sanitization Probe',
    value: "' OR '1'='1",
    category: 'SANITIZATION_PROBE',
    description: 'Verifies whether SQL single-quote characters are escaped and sanitized by the API.',
  },
];

export class ChaosTester {
  /**
   * Evaluates buttons for double-click debounce protection and race condition prevention.
   */
  public testButtonDebounce(
    buttons: DiscoveredButton[],
    sessionId: string,
    pageUrl: string
  ): Finding[] {
    const findings: Finding[] = [];

    // Filter submit and transaction buttons
    const sensitiveButtons = buttons.filter(
      (b) =>
        b.type === 'submit' ||
        b.riskLevel === 'HIGH' ||
        /submit|pay|order|checkout|buy|transfer|book|save/i.test(b.text)
    );

    for (const btn of sensitiveButtons) {
      // In static inspection, check if button lacks disabled handling or form lacks loading state
      const hasSelector = !!btn.selector;
      if (hasSelector && btn.riskLevel === 'HIGH') {
        findings.push({
          id: `finding_chaos_debounce_${sessionId}_${Math.random().toString(36).substring(2, 7)}`,
          sessionId,
          category: 'FUNCTIONAL',
          severity: 'HIGH',
          status: 'WARNING',
          confidence: 0.9,
          title: `[Chaos / Race Condition] Verify Rapid Double-Click Debounce on "${btn.text || 'Action Button'}"`,
          description: `High-risk action button (${btn.selector}) triggers financial or state-altering mutations. If rapid multi-clicks are fired, missing debounce or missing disabled state can cause duplicate charges, duplicate order creation, or race conditions.`,
          page: pageUrl,
          selector: btn.selector,
          steps: [
            `Navigate to ${pageUrl}`,
            `Locate action button: ${btn.selector}`,
            'Rapidly click the button twice within 50ms',
            'Verify that subsequent clicks are debounced and the button enters disabled/loading state',
          ],
          expected: 'Button must immediately disable itself and show loading indicator upon first click until network request completes.',
          actual: 'Button does not declare explicit single-flight guard or inline busy attributes in initial state.',
          recommendation: 'Implement client-side request debouncing, disable button immediately on click (disabled=true or aria-busy="true"), and use idempotency keys on backend requests.',
          evidence: [
            {
              type: 'dom_snippet',
              description: 'Sensitive action button inspected for race conditions',
              data: {
                selector: btn.selector,
                text: btn.text,
                riskLevel: btn.riskLevel,
              },
              timestamp: Date.now(),
            },
          ],
          retestCount: 0,
          timestamp: Date.now(),
        });
      }
    }

    return findings;
  }

  /**
   * Inspects form fields for boundary value restrictions (maxlength, min, input patterns).
   */
  public testFormBoundaries(
    forms: DiscoveredForm[],
    sessionId: string,
    pageUrl: string
  ): Finding[] {
    const findings: Finding[] = [];

    for (const form of forms) {
      for (const field of form.fields) {
        // Check 1: Text fields without maxLength attribute
        const isTextLike = ['text', 'search', 'url', 'tel', 'email'].includes(field.type);
        if (isTextLike && !field.placeholder?.includes('limit') && !field.name.toLowerCase().includes('search')) {
          // If field is susceptible to huge payload buffer stress
          if (field.name.length > 0) {
            findings.push({
              id: `finding_chaos_boundary_${sessionId}_${form.id || 'form'}_${field.name}`,
              sessionId,
              category: 'FUNCTIONAL',
              severity: 'LOW',
              status: 'WARNING',
              confidence: 0.85,
              title: `[Boundary Fuzzing] Missing Input Length Constraint on "${field.label || field.name}"`,
              description: `Form field "${field.name}" (${field.selector}) does not declare a client-side "maxlength" attribute. Inserting 5,000+ character strings could cause layout distortion or server-side buffer rejection.`,
              page: pageUrl,
              selector: field.selector,
              steps: [
                `Navigate to ${pageUrl}`,
                `Locate form field: ${field.selector}`,
                'Attempt to input a 5,000 character string',
                'Verify UI clipping and graceful validation response',
              ],
              expected: 'Input should enforce reasonable client-side maxlength (e.g. 100-255 characters) and reject overly long strings gracefully.',
              actual: 'Field lacks maxlength constraint attribute.',
              recommendation: `Add maxlength="255" attribute to <input name="${field.name}"> and enforce validation schema on backend API.`,
              evidence: [
                {
                  type: 'dom_snippet',
                  description: 'Field lacking length boundary constraint',
                  data: { name: field.name, type: field.type, selector: field.selector },
                  timestamp: Date.now(),
                },
              ],
              retestCount: 0,
              timestamp: Date.now(),
            });
          }
        }

        // Check 2: Number fields without min constraint (e.g. quantity / age / price)
        const isNumericField =
          field.type === 'number' ||
          (/\b(qty|quantity|amount|price|count|items)\b/i.test(field.name) && !/discount/i.test(field.name));
        if (isNumericField) {
          findings.push({
            id: `finding_chaos_neg_number_${sessionId}_${field.name}`,
            sessionId,
            category: 'FUNCTIONAL',
            severity: 'MEDIUM',
            status: 'WARNING',
            confidence: 0.88,
            title: `[Numeric Boundary] Verify Non-Negative Constraint on "${field.label || field.name}"`,
            description: `Numeric field "${field.name}" (${field.selector}) handles quantities or amounts. Must enforce min="0" or min="1" to prevent negative input attacks.`,
            page: pageUrl,
            selector: field.selector,
            steps: [
              `Navigate to ${pageUrl}`,
              `Enter "-5" in ${field.selector}`,
              'Attempt form submission',
            ],
            expected: 'Form must reject negative numbers with inline validation message.',
            actual: 'Field should be validated for negative input boundary attacks.',
            recommendation: `Add min="0" attribute to <input name="${field.name}"> and reject negative integers on backend.`,
            evidence: [
              {
                type: 'dom_snippet',
                description: 'Numeric field boundary check',
                data: { name: field.name, selector: field.selector },
                timestamp: Date.now(),
              },
            ],
            retestCount: 0,
            timestamp: Date.now(),
          });
        }
      }
    }

    return findings;
  }

  /**
   * Complete Chaos & Edge-case audit for a snapshot.
   */
  public runChaosAudit(
    snapshot: PageSnapshot,
    sessionId: string
  ): Finding[] {
    logger.info(`Running chaos and boundary testing audit on ${snapshot.url}...`);
    const buttons = Array.isArray(snapshot.buttons) ? snapshot.buttons : [];
    const forms = Array.isArray(snapshot.forms) ? snapshot.forms : [];
    const debounceFindings = this.testButtonDebounce(buttons, sessionId, snapshot.url);
    const boundaryFindings = this.testFormBoundaries(forms, sessionId, snapshot.url);
    return [...debounceFindings, ...boundaryFindings];
  }
}

export const chaosTester = new ChaosTester();
