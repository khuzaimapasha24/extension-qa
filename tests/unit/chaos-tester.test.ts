import { describe, it, expect } from 'vitest';
import { ChaosTester, STANDARD_FUZZ_PAYLOADS } from '../../src/qa/chaos-tester';
import { PageSnapshot, DiscoveredButton, DiscoveredForm } from '../../src/shared/types/discovery';

describe('ChaosTester', () => {
  const tester = new ChaosTester();

  it('exposes standard fuzz payloads across core edge categories', () => {
    expect(STANDARD_FUZZ_PAYLOADS.length).toBeGreaterThanOrEqual(5);
    const categories = STANDARD_FUZZ_PAYLOADS.map((p) => p.category);
    expect(categories).toContain('LENGTH_OVERFLOW');
    expect(categories).toContain('UNICODE_STRESS');
    expect(categories).toContain('NUMERIC_BOUNDARY');
    expect(categories).toContain('SANITIZATION_PROBE');

    const longStr = STANDARD_FUZZ_PAYLOADS.find((p) => p.category === 'LENGTH_OVERFLOW');
    expect(longStr?.value.length).toBe(5000);
  });

  it('flags high-risk transaction buttons for double-click debounce protection', () => {
    const buttons: DiscoveredButton[] = [
      {
        text: 'Pay Now $99',
        selector: '#pay-btn',
        riskLevel: 'HIGH',
        type: 'submit',
        isVisible: true,
        isDisabled: false,
      },
      {
        text: 'Learn More',
        selector: '#learn-more',
        riskLevel: 'LOW',
        type: 'button',
        isVisible: true,
        isDisabled: false,
      },
    ];

    const findings = tester.testButtonDebounce(buttons, 'sess-123', 'https://shop.example.com/checkout');
    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('Rapid Double-Click Debounce');
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].selector).toBe('#pay-btn');
    expect(findings[0].recommendation).toContain('client-side request debouncing');
  });

  it('inspects form fields and flags text fields missing maxlength and quantity fields for negative validation', () => {
    const forms: DiscoveredForm[] = [
      {
        id: 'checkout-form',
        selector: '#checkout-form',
        action: '/checkout',
        method: 'POST',
        riskLevel: 'HIGH',
        submitButtonSelector: '#submit-order',
        fields: [
          {
            name: 'customerNotes',
            label: 'Order Notes',
            type: 'text',
            selector: 'input[name="customerNotes"]',
            required: false,
          },
          {
            name: 'quantity',
            label: 'Item Quantity',
            type: 'number',
            selector: 'input[name="quantity"]',
            required: true,
          },
        ],
      },
    ];

    const findings = tester.testFormBoundaries(forms, 'sess-123', 'https://shop.example.com/cart');
    expect(findings.length).toBe(2);

    const lengthFinding = findings.find((f) => f.title.includes('Missing Input Length Constraint'));
    expect(lengthFinding).toBeDefined();
    expect(lengthFinding?.selector).toBe('input[name="customerNotes"]');

    const numericFinding = findings.find((f) => f.title.includes('Verify Non-Negative Constraint'));
    expect(numericFinding).toBeDefined();
    expect(numericFinding?.selector).toBe('input[name="quantity"]');
  });

  it('runs complete chaos audit combining button debouncing and form boundaries', () => {
    const mockSnapshot: PageSnapshot = {
      url: 'https://shop.example.com/checkout',
      origin: 'https://shop.example.com',
      pathname: '/checkout',
      title: 'Checkout',
      timestamp: Date.now(),
      totalInteractiveCount: 2,
      metadata: {
        title: 'Checkout',
        h1Count: 1,
        h1Texts: ['Checkout'],
        headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      },
      forms: [
        {
          id: 'order-form',
          selector: '#order-form',
          action: '/process-order',
          method: 'POST',
          riskLevel: 'HIGH',
          fields: [
            {
              name: 'customerNote',
              label: 'Note',
              type: 'text',
              selector: '#customerNote',
              required: false,
            },
          ],
        },
      ],
      buttons: [
        {
          text: 'Confirm Order',
          selector: '#confirm-btn',
          riskLevel: 'HIGH',
          type: 'submit',
          isVisible: true,
          isDisabled: false,
        },
      ],
      links: [],
      images: [],
      navigations: [],
    };

    const auditFindings = tester.runChaosAudit(mockSnapshot, 'sess-999');
    expect(auditFindings.length).toBe(2);
    expect(auditFindings.some((f) => f.title.includes('Debounce'))).toBe(true);
    expect(auditFindings.some((f) => f.title.includes('Input Length'))).toBe(true);
  });
});
