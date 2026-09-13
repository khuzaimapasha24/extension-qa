import { describe, it, expect, vi } from 'vitest';
import { SpecMatcher } from '../../src/ai/spec-matcher';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('SpecMatcher', () => {
  const matcher = new SpecMatcher();

  const mockSnapshot: PageSnapshot = {
    url: 'https://ecommerce.example.com/checkout',
    title: 'Secure Checkout - Store',
    headings: [
      { text: 'Order Summary & Payment', level: 'h1', selector: 'h1.order-title' },
      { text: 'Shipping Address', level: 'h2', selector: 'h2.shipping-heading' },
    ],
    buttons: [
      { text: 'Place Order Now', selector: '#place-order-btn' },
      { text: 'Apply Coupon', selector: '.coupon-btn' },
    ],
    forms: [
      {
        selector: '#checkout-form',
        fields: [
          { name: 'email', type: 'email', placeholder: 'Enter email address', selector: '#email' },
          { name: 'card_number', type: 'text', placeholder: 'Card number', selector: '#card-number' },
        ],
      },
    ],
    links: [
      { text: 'Privacy Policy', url: '/legal/privacy', selector: 'footer a.privacy' },
      { text: 'Return to Cart', url: '/cart', selector: 'a.back-cart' },
    ],
    interactiveElementsCount: 6,
    timestamp: Date.now(),
  };

  it('parses PRD text and markdown bullets into distinct requirement strings', () => {
    const rawPrd = `
# Acceptance Criteria
* User must see "Place Order Now" button
- [ ] Email input field should be present
1. User must be able to view Privacy Policy link
- Heading for Order Summary must exist
* Short
`;
    const parsed = matcher.parseRequirements(rawPrd);
    expect(parsed).toEqual([
      'User must see "Place Order Now" button',
      'Email input field should be present',
      '1. User must be able to view Privacy Policy link',
      'Heading for Order Summary must exist',
    ]);
  });

  it('handles empty or malformed spec input gracefully', () => {
    expect(matcher.parseRequirements('')).toEqual([]);
    // @ts-expect-error test invalid type
    expect(matcher.parseRequirements(null)).toEqual([]);
  });

  it('evaluates button requirement and finds matching button', () => {
    const evaluation = matcher.evaluateHeuristic(
      'There should be a Place Order Now button to complete transaction',
      mockSnapshot
    );
    expect(evaluation.status).toBe('VERIFIED_PASS');
    expect(evaluation.matchedElementSelector).toBe('#place-order-btn');
    expect(evaluation.confidence).toBeGreaterThan(0.8);
  });

  it('evaluates heading requirement and matches page headings', () => {
    const evaluation = matcher.evaluateHeuristic(
      'Page title or heading must display Order Summary',
      mockSnapshot
    );
    expect(evaluation.status).toBe('VERIFIED_PASS');
    expect(evaluation.matchedElementSelector).toBe('h1.order-title');
  });

  it('evaluates input field requirements in forms', () => {
    const evaluation = matcher.evaluateHeuristic(
      'An input field for entering customer email should be rendered',
      mockSnapshot
    );
    expect(evaluation.status).toBe('VERIFIED_PASS');
    expect(evaluation.matchedElementSelector).toBe('#email');
  });

  it('evaluates navigation links matching text or url', () => {
    const evaluation = matcher.evaluateHeuristic(
      'Footer must have a Privacy Policy link',
      mockSnapshot
    );
    expect(evaluation.status).toBe('VERIFIED_PASS');
    expect(evaluation.matchedElementSelector).toBe('footer a.privacy');
  });

  it('returns MISSING_FAIL when requirement cannot be found', () => {
    const evaluation = matcher.evaluateHeuristic(
      'Crypto wallet Web3 connect button must be visible',
      mockSnapshot
    );
    expect(evaluation.status).toBe('MISSING_FAIL');
    expect(evaluation.remediationSuggestion).toBeDefined();
  });

  it('evaluates complete compliance report and generates findings for failed items', async () => {
    const spec = `
* User must see Place Order Now button
* Crypto payment option button must exist
* Email input field must be present
`;
    const report = await matcher.evaluateCompliance(spec, mockSnapshot, 'sess-123');

    expect(report.totalRequirements).toBe(3);
    expect(report.passedCount).toBe(2);
    expect(report.failedCount).toBe(1);
    expect(report.overallComplianceScore).toBe(67);
    expect(report.findings.length).toBe(1);
    expect(report.findings[0].category).toBe('FUNCTIONAL');
    expect(report.findings[0].severity).toBe('HIGH');
    expect(report.findings[0].title).toContain('[PRD Spec Mismatch]');
  });
});
