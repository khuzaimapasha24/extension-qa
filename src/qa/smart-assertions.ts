import { Finding } from '../shared/types/qa';

export interface CalculationEquationParams {
  subtotal: number;
  discount?: number;
  tax?: number;
  shipping?: number;
  total: number;
  tolerance?: number;
}

export interface LineItemCheckParams {
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface PercentageDiscountParams {
  subtotal: number;
  percentage: number;
  actualDiscount: number;
  tolerance?: number;
}

export interface SmartAssertionResult {
  passed: boolean;
  message: string;
  finding?: Partial<Finding>;
}

/**
 * Smart Business Logic Assertions Engine.
 * Verifies financial, e-commerce, and business rule arithmetic without relying on brittle DOM selectors.
 */
export class SmartAssertions {
  /**
   * Verifies the fundamental e-commerce equation:
   * Subtotal - Discount + Tax + Shipping === Total
   */
  public static assertCalculationEquation(
    params: CalculationEquationParams,
    sessionId: string,
    pageUrl: string
  ): SmartAssertionResult {
    const { subtotal, discount = 0, tax = 0, shipping = 0, total, tolerance = 0.05 } = params;

    const expectedTotal = Math.round((subtotal - discount + tax + shipping) * 100) / 100;
    const actualTotal = Math.round(total * 100) / 100;
    const discrepancy = Math.abs(expectedTotal - actualTotal);

    if (discrepancy <= tolerance) {
      return {
        passed: true,
        message: `Calculation equation verified: ${subtotal} - ${discount} + ${tax} + ${shipping} = ${actualTotal}`,
      };
    }

    const finding: Partial<Finding> = {
      id: `smart_assert_calc_${sessionId}_${Date.now()}`,
      sessionId,
      category: 'FUNCTIONAL',
      severity: 'CRITICAL',
      status: 'FAIL',
      confidence: 0.99,
      title: '[Business Logic] Order Grand Total Math Discrepancy',
      description: `Discrepancy detected in checkout total arithmetic: Subtotal (${subtotal}) - Discount (${discount}) + Tax (${tax}) + Shipping (${shipping}) equals ${expectedTotal.toFixed(2)}, but displayed total is ${actualTotal.toFixed(2)} (Discrepancy: ${discrepancy.toFixed(2)}).`,
      page: pageUrl,
      steps: [
        `Navigate to ${pageUrl}`,
        'Locate pricing and checkout totals breakdown',
        `Evaluate formula: Subtotal(${subtotal}) - Discount(${discount}) + Tax(${tax}) + Shipping(${shipping})`,
      ],
      expected: `Grand total must equal ${expectedTotal.toFixed(2)}`,
      actual: `Grand total displayed as ${actualTotal.toFixed(2)}`,
      recommendation: 'Review rounding precision, coupon deduction ordering, and tax application order in cart calculation engine.',
      timestamp: Date.now(),
    };

    return {
      passed: false,
      message: `Math discrepancy: expected ${expectedTotal}, got ${actualTotal}`,
      finding,
    };
  }

  /**
   * Verifies individual product line totals: Unit Price * Quantity === Line Total
   */
  public static assertLineItems(
    items: LineItemCheckParams[],
    sessionId: string,
    pageUrl: string
  ): SmartAssertionResult[] {
    const results: SmartAssertionResult[] = [];

    for (const item of items) {
      const expected = Math.round(item.unitPrice * item.quantity * 100) / 100;
      const actual = Math.round(item.lineTotal * 100) / 100;
      const diff = Math.abs(expected - actual);

      if (diff <= 0.05) {
        results.push({
          passed: true,
          message: `Line item "${item.name}" verified: ${item.unitPrice} x ${item.quantity} = ${actual}`,
        });
      } else {
        results.push({
          passed: false,
          message: `Line item "${item.name}" calculation error: expected ${expected}, got ${actual}`,
          finding: {
            id: `smart_assert_line_${sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sessionId,
            category: 'FUNCTIONAL',
            severity: 'HIGH',
            status: 'FAIL',
            confidence: 0.97,
            title: `[Business Logic] Line Item Calculation Error for "${item.name}"`,
            description: `Product line item "${item.name}" has invalid arithmetic: Unit price (${item.unitPrice}) x Quantity (${item.quantity}) equals ${expected.toFixed(2)}, but line total is displayed as ${actual.toFixed(2)}.`,
            page: pageUrl,
            steps: [`Inspect line item "${item.name}" in shopping cart / checkout table`],
            expected: `Line total should be ${expected.toFixed(2)}`,
            actual: `Line total is ${actual.toFixed(2)}`,
            recommendation: 'Ensure cart state multiplier applies unit price strictly to updated item quantity.',
            timestamp: Date.now(),
          },
        });
      }
    }

    return results;
  }

  /**
   * Verifies percentage-based discount calculation: Subtotal * (percentage / 100) === Discount
   */
  public static assertPercentageDiscount(
    params: PercentageDiscountParams,
    sessionId: string,
    pageUrl: string
  ): SmartAssertionResult {
    const { subtotal, percentage, actualDiscount, tolerance = 0.05 } = params;
    const expectedDiscount = Math.round(subtotal * (percentage / 100) * 100) / 100;
    const diff = Math.abs(expectedDiscount - actualDiscount);

    if (diff <= tolerance) {
      return {
        passed: true,
        message: `Percentage discount verified: ${percentage}% of ${subtotal} = ${actualDiscount}`,
      };
    }

    return {
      passed: false,
      message: `Discount discrepancy: ${percentage}% of ${subtotal} should be ${expectedDiscount}, but got ${actualDiscount}`,
      finding: {
        id: `smart_assert_discount_${sessionId}_${Date.now()}`,
        sessionId,
        category: 'FUNCTIONAL',
        severity: 'HIGH',
        status: 'FAIL',
        confidence: 0.95,
        title: `[Business Logic] Promo Code / Discount Calculation Error (${percentage}% OFF)`,
        description: `Advertised ${percentage}% discount on subtotal of ${subtotal} should yield a discount of ${expectedDiscount.toFixed(2)}, but checkout deducted ${actualDiscount.toFixed(2)}.`,
        page: pageUrl,
        steps: [`Apply ${percentage}% discount code to cart with subtotal ${subtotal}`],
        expected: `Discount should be exactly ${expectedDiscount.toFixed(2)}`,
        actual: `Discount applied is ${actualDiscount.toFixed(2)}`,
        recommendation: 'Verify discount code calculation pipeline to prevent under-discounting or over-discounting customers.',
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Verifies free shipping threshold logic: If subtotal >= threshold, shipping must be 0.
   */
  public static assertFreeShippingThreshold(
    subtotal: number,
    threshold: number,
    shippingCharge: number,
    sessionId: string,
    pageUrl: string
  ): SmartAssertionResult {
    if (subtotal >= threshold && shippingCharge > 0) {
      return {
        passed: false,
        message: `Free shipping threshold violated: subtotal ${subtotal} exceeds threshold ${threshold}, but shipping fee of ${shippingCharge} was charged.`,
        finding: {
          id: `smart_assert_shipping_${sessionId}_${Date.now()}`,
          sessionId,
          category: 'FUNCTIONAL',
          severity: 'HIGH',
          status: 'FAIL',
          confidence: 0.96,
          title: '[Business Logic] Free Shipping Policy Threshold Violated',
          description: `Order subtotal (${subtotal}) qualifies for free shipping (threshold: ${threshold}), but a shipping fee of ${shippingCharge} is still applied.`,
          page: pageUrl,
          steps: [
            `Add items totaling ${subtotal} to cart (exceeding ${threshold} threshold)`,
            'Proceed to shipping / payment options',
          ],
          expected: 'Shipping charge must be 0.00 (Free Shipping)',
          actual: `Shipping charged: ${shippingCharge}`,
          recommendation: 'Update shipping rate calculation logic to waive delivery fees once subtotal hits qualifying threshold.',
          timestamp: Date.now(),
        },
      };
    }

    return {
      passed: true,
      message: `Shipping charge logic verified for subtotal ${subtotal} with threshold ${threshold}`,
    };
  }

  /**
   * Verifies that total is never negative.
   */
  public static assertPositiveTotal(
    total: number,
    sessionId: string,
    pageUrl: string
  ): SmartAssertionResult {
    if (total < 0) {
      return {
        passed: false,
        message: `Order grand total is negative: ${total}`,
        finding: {
          id: `smart_assert_negative_${sessionId}_${Date.now()}`,
          sessionId,
          category: 'FUNCTIONAL',
          severity: 'CRITICAL',
          status: 'FAIL',
          confidence: 0.99,
          title: '[Business Logic] Negative Grand Total Allowed',
          description: `Checkout total is negative (${total}), enabling negative payment processing or merchant liabilities.`,
          page: pageUrl,
          steps: ['Inspect grand total when credits or discounts are applied'],
          expected: 'Total must be greater than or equal to 0.00',
          actual: `Total is negative: ${total}`,
          recommendation: 'Apply Math.max(0, calculatedTotal) barrier to all order calculations.',
          timestamp: Date.now(),
        },
      };
    }

    return {
      passed: true,
      message: `Grand total is non-negative: ${total}`,
    };
  }
}
