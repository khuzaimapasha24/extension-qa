import { describe, it, expect } from 'vitest';
import { SmartAssertions } from '../../src/qa/smart-assertions';

describe('SmartAssertions', () => {
  const mockSessionId = 'sess_smart_assert_1';
  const mockUrl = 'https://myshop.com/checkout';

  describe('assertCalculationEquation', () => {
    it('passes when subtotal, discount, tax, and shipping match total', () => {
      const result = SmartAssertions.assertCalculationEquation(
        {
          subtotal: 100.0,
          discount: 20.0,
          tax: 8.0,
          shipping: 5.0,
          total: 93.0,
        },
        mockSessionId,
        mockUrl
      );

      expect(result.passed).toBe(true);
      expect(result.finding).toBeUndefined();
    });

    it('fails and creates finding when there is a math discrepancy', () => {
      const result = SmartAssertions.assertCalculationEquation(
        {
          subtotal: 100.0,
          discount: 20.0,
          tax: 8.0,
          shipping: 5.0,
          total: 85.0, // Should be 93.0!
        },
        mockSessionId,
        mockUrl
      );

      expect(result.passed).toBe(false);
      expect(result.finding).toBeDefined();
      expect(result.finding?.title).toContain('Math Discrepancy');
      expect(result.finding?.severity).toBe('CRITICAL');
      expect(result.finding?.expected).toContain('93.00');
      expect(result.finding?.actual).toContain('85.00');
    });
  });

  describe('assertLineItems', () => {
    it('verifies unit price multiplied by quantity equals line total', () => {
      const results = SmartAssertions.assertLineItems(
        [
          { name: 'T-Shirt', unitPrice: 25.0, quantity: 2, lineTotal: 50.0 },
          { name: 'Hat', unitPrice: 15.0, quantity: 3, lineTotal: 45.0 },
        ],
        mockSessionId,
        mockUrl
      );

      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(true);
    });

    it('flags line items where quantity multiplication is incorrect', () => {
      const results = SmartAssertions.assertLineItems(
        [
          { name: 'Faulty Widget', unitPrice: 10.0, quantity: 3, lineTotal: 20.0 }, // Should be 30.0!
        ],
        mockSessionId,
        mockUrl
      );

      expect(results[0].passed).toBe(false);
      expect(results[0].finding?.title).toContain('Line Item Calculation Error');
      expect(results[0].finding?.severity).toBe('HIGH');
    });
  });

  describe('assertPercentageDiscount', () => {
    it('verifies correct percentage discount calculation', () => {
      const result = SmartAssertions.assertPercentageDiscount(
        {
          subtotal: 200.0,
          percentage: 15,
          actualDiscount: 30.0,
        },
        mockSessionId,
        mockUrl
      );

      expect(result.passed).toBe(true);
    });

    it('detects discount percentage discrepancies', () => {
      const result = SmartAssertions.assertPercentageDiscount(
        {
          subtotal: 200.0,
          percentage: 15, // 15% of 200 is 30.00
          actualDiscount: 15.0, // Faulty discount
        },
        mockSessionId,
        mockUrl
      );

      expect(result.passed).toBe(false);
      expect(result.finding?.title).toContain('Discount Calculation Error (15% OFF)');
      expect(result.finding?.severity).toBe('HIGH');
    });
  });

  describe('assertFreeShippingThreshold', () => {
    it('passes when subtotal is above threshold and shipping is 0', () => {
      const result = SmartAssertions.assertFreeShippingThreshold(75.0, 50.0, 0, mockSessionId, mockUrl);
      expect(result.passed).toBe(true);
    });

    it('fails when order qualifies for free shipping but delivery fee is charged', () => {
      const result = SmartAssertions.assertFreeShippingThreshold(75.0, 50.0, 9.99, mockSessionId, mockUrl);
      expect(result.passed).toBe(false);
      expect(result.finding?.title).toContain('Free Shipping Policy Threshold Violated');
      expect(result.finding?.actual).toContain('9.99');
    });
  });

  describe('assertPositiveTotal', () => {
    it('passes for positive totals', () => {
      const result = SmartAssertions.assertPositiveTotal(12.5, mockSessionId, mockUrl);
      expect(result.passed).toBe(true);
    });

    it('flags negative order totals', () => {
      const result = SmartAssertions.assertPositiveTotal(-5.0, mockSessionId, mockUrl);
      expect(result.passed).toBe(false);
      expect(result.finding?.severity).toBe('CRITICAL');
      expect(result.finding?.title).toContain('Negative Grand Total Allowed');
    });
  });
});
