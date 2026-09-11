import { describe, it, expect, vi, afterEach } from 'vitest';
import { businessLogicVerifier } from '../../src/qa/business-logic-verifier';
import { PageSnapshot } from '../../src/shared/types/discovery';
import { cloudLlmClient } from '../../src/ai/cloud-llm-client';

describe('BusinessLogicVerifier', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockSnapshot: PageSnapshot = {
    url: 'https://store.example.com/cart',
    origin: 'https://store.example.com',
    pathname: '/cart',
    title: 'Your Shopping Cart',
    metadata: {
      title: 'Cart',
      h1Count: 1,
      h1Texts: ['Checkout Cart'],
      headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    },
    links: [],
    buttons: [],
    forms: [],
    images: [],
    navigations: [],
    totalInteractiveCount: 0,
    timestamp: Date.now(),
  };

  it('parses currency strings accurately', () => {
    expect(businessLogicVerifier.parsePrice('$49.99')).toBe(49.99);
    expect(businessLogicVerifier.parsePrice('€ 120.50')).toBe(120.50);
    expect(businessLogicVerifier.parsePrice('1,500.00')).toBe(1500.00);
    expect(businessLogicVerifier.parsePrice('-$20.00')).toBe(-20.00);
    expect(businessLogicVerifier.parsePrice('Discount: 15.00')).toBe(-15.00);
  });

  it('extracts pricing summary breakdown from cart text', () => {
    const cartText = `
      Item: Cool Sneakers - $100.00
      Subtotal: $100.00
      Discount (PROMO10): -$10.00
      Tax: $5.00
      Shipping: Free
      Grand Total: $95.00
    `;
    const breakdown = businessLogicVerifier.extractPricingSummary(cartText);
    expect(breakdown.foundBreakdown).toBe(true);
    expect(breakdown.subtotal).toBe(100);
    expect(breakdown.discount).toBe(10);
    expect(breakdown.tax).toBe(5);
    expect(breakdown.shipping).toBe(0);
    expect(breakdown.total).toBe(95);
  });

  it('passes cleanly when calculations match expected arithmetic', () => {
    const breakdown = {
      items: [],
      subtotal: 100,
      discount: 20,
      tax: 8,
      shipping: 5,
      total: 93, // 100 - 20 + 8 + 5 = 93
      foundBreakdown: true,
    };
    const findings = businessLogicVerifier.verifyCalculations(breakdown, 'sess_1', 'https://store.example.com');
    expect(findings.length).toBe(0);
  });

  it('detects and flags calculation mismatch between subtotal and total', () => {
    const breakdown = {
      items: [],
      subtotal: 100,
      discount: 10,
      tax: 5,
      shipping: 5,
      total: 125, // Expected: 100 - 10 + 5 + 5 = 100, but displayed is 125
      foundBreakdown: true,
    };
    const findings = businessLogicVerifier.verifyCalculations(breakdown, 'sess_1', 'https://store.example.com');
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('CRITICAL');
    expect(findings[0].title).toContain('Calculation Mismatch');
    expect(findings[0].description).toContain('Discrepancy detected');
  });

  it('detects and flags negative order totals as critical defect', () => {
    const breakdown = {
      items: [],
      subtotal: 50,
      discount: 75,
      total: -25,
      foundBreakdown: true,
    };
    const findings = businessLogicVerifier.verifyCalculations(breakdown, 'sess_1', 'https://store.example.com');
    const negFinding = findings.find((f) => f.title.includes('Negative Order Total'));
    expect(negFinding).toBeDefined();
    expect(negFinding?.severity).toBe('CRITICAL');
  });

  it('enriches business logic audit with Cloud LLM insights when configured', async () => {
    vi.spyOn(cloudLlmClient, 'resolveActiveProvider').mockReturnValue({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-1.5-flash',
      isCloud: true,
    });

    vi.spyOn(cloudLlmClient, 'generateCompletion').mockResolvedValue(JSON.stringify({
      hasDefect: true,
      defectTitle: 'Tiered Discount Misapplication',
      defectDescription: 'Cart contains 3 items qualifying for 30% off, but only 10% coupon was applied.',
      suggestedFix: 'Update checkout pricing engine to evaluate tiered promotions prior to subtotal rendering.',
    }));

    const cartText = `
      Subtotal: $200.00
      Discount: $20.00
      Total: $180.00
    `;

    const findings = await businessLogicVerifier.auditBusinessLogic(
      mockSnapshot,
      'sess_ai_biz',
      cartText,
      { provider: 'gemini', geminiApiKey: 'test-key' }
    );

    const aiFinding = findings.find((f) => f.title.includes('Tiered Discount Misapplication'));
    expect(aiFinding).toBeDefined();
    expect(aiFinding?.confidence).toBeGreaterThan(0.9);
  });
});
