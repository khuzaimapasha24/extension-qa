import { describe, it, expect } from 'vitest';
import { generatePlaywrightTest } from '../../src/reporting/playwright-generator';
import { QAReportData } from '../../src/reporting/report-types';
import { Finding } from '../../src/shared/types/qa';

describe('PlaywrightGenerator', () => {
  const mockReportData: QAReportData = {
    metadata: {
      reportId: 'rep_pw_1',
      sessionId: 'sess_pw_1',
      url: 'https://myshop.com/checkout',
      title: 'MyShop Checkout Page',
      timestamp: 1720000000000,
      formattedDate: 'Sep 12, 2026, 10:00 AM',
      durationMs: 45000,
      engineVersion: '1.0.0',
    },
    summary: {
      overallScore: 78,
      rating: 'GOOD',
      totalFindings: 2,
      criticalCount: 1,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      testsExecuted: 15,
      pagesScanned: 2,
      elementsScanned: 35,
    },
    scores: {
      overallScore: 78,
      functionalScore: 70,
      accessibilityScore: 85,
      performanceScore: 80,
      securityScore: 90,
      categoryScores: {} as any,
    },
    findings: [
      {
        id: 'f_crit_1',
        sessionId: 'sess_pw_1',
        category: 'FUNCTIONAL',
        severity: 'CRITICAL',
        title: 'Checkout submit button does not respond',
        description: 'Clicking submit produces no reaction',
        page: 'https://myshop.com/checkout',
        selector: 'button#btn-place-order',
        elementSelector: 'button#btn-place-order',
        steps: ['Fill cart', 'Click place order'],
        expected: 'Order confirmation',
        actual: 'No action',
        confidence: 0.98,
        timestamp: 1720000005000,
        retestCount: 1,
        status: 'FAIL',
        evidence: [],
        recommendation: 'Attach click handler properly',
      },
      {
        id: 'f_high_1',
        sessionId: 'sess_pw_1',
        category: 'NETWORK',
        severity: 'HIGH',
        title: '500 Server Error on payment endpoint',
        description: 'POST /api/pay fails with 500',
        page: 'https://myshop.com/checkout',
        selector: '#payment-section',
        elementSelector: '#payment-section',
        steps: [],
        expected: '200 OK',
        actual: '500 Internal Server Error',
        confidence: 1.0,
        timestamp: 1720000010000,
        retestCount: 1,
        status: 'FAIL',
        evidence: [],
        recommendation: 'Fix backend controller',
      },
    ],
    discoveryMap: {
      url: 'https://myshop.com/checkout',
      title: 'MyShop Checkout Page',
      timestamp: 1720000000000,
      pages: ['https://myshop.com/checkout'],
      forms: [
        {
          formSelector: 'form#checkout-form',
          id: 'checkout-form',
          name: 'checkoutForm',
          action: '/api/order',
          method: 'POST',
          fields: [
            {
              name: 'email',
              type: 'email',
              selector: 'input[name="email"]',
              required: true,
              placeholder: 'Enter your email',
            },
            {
              name: 'password',
              type: 'password',
              selector: 'input[name="password"]',
              required: true,
            },
            {
              name: 'phone',
              type: 'tel',
              selector: 'input[name="phone"]',
              required: false,
            },
            {
              name: 'terms',
              type: 'checkbox',
              selector: 'input[name="terms"]',
              required: true,
            },
          ],
          submitButton: {
            selector: 'button[type="submit"]',
            text: 'Place Order',
            type: 'submit',
          },
        },
      ],
      buttons: [],
      links: [],
      headings: [],
      inputs: [],
    },
  };

  it('generates a complete valid Playwright TypeScript test file', () => {
    const code = generatePlaywrightTest(mockReportData);

    expect(code).toContain("import { test, expect } from '@playwright/test';");
    expect(code).toContain("test.describe('Autonomous QA E2E Suite: MyShop Checkout Page'");
    expect(code).toContain("await page.goto('https://myshop.com/checkout'");
    expect(code).toContain("test('Baseline Health: Verifies page loads without fatal exceptions'");
  });

  it('generates user journey test for discovered forms with synthetic inputs', () => {
    const code = generatePlaywrightTest(mockReportData);

    expect(code).toContain("test('User Journey: Populate and submit form \"checkout-form\"'");
    expect(code).toContain("await page.locator('input[name=\"email\"]').fill('qa.engineer@example.com')");
    expect(code).toContain("await page.locator('input[name=\"password\"]').fill('AutomationP@ssw0rd!2026')");
    expect(code).toContain("await page.locator('input[name=\"phone\"]').fill('+15551234567')");
    expect(code).toContain("await page.locator('input[name=\"terms\"]').check()");
    expect(code).toContain("const submitBtn = page.locator('button[type=\"submit\"]');");
    expect(code).toContain("await submitBtn.click();");
  });

  it('generates regression guards for critical and high findings', () => {
    const code = generatePlaywrightTest(mockReportData);

    expect(code).toContain("test.describe('Regression Guards (Defect Prevention)'");
    expect(code).toContain("Guard against CRITICAL: Checkout submit button does not respond");
    expect(code).toContain("const targetElement = page.locator('button#btn-place-order');");
    expect(code).toContain("await expect(targetElement).toBeAttached();");
  });

  it('generates cross-device responsive test cases', () => {
    const code = generatePlaywrightTest(mockReportData);

    expect(code).toContain("test.describe('Responsive & Cross-Device Layout Verification'");
    expect(code).toContain("Mobile Portrait (iPhone 14)");
    expect(code).toContain("Tablet Portrait (iPad Mini)");
    expect(code).toContain("Desktop Standard (1080p)");
    expect(code).toContain("document.documentElement.scrollWidth > window.innerWidth");
  });

  it('respects configuration options to disable specific suites', () => {
    const code = generatePlaywrightTest(mockReportData, {
      includeFormTests: false,
      includeRegressionGuards: false,
      includeResponsiveTests: false,
    });

    expect(code).not.toContain('User Journey: Populate and submit form');
    expect(code).not.toContain('Regression Guards (Defect Prevention)');
    expect(code).not.toContain('Responsive & Cross-Device Layout Verification');
    expect(code).toContain('Baseline Health');
  });
});
