import { describe, it, expect } from 'vitest';
import { generateCypressTest } from '../../src/reporting/cypress-generator';
import { QAReportData } from '../../src/reporting/report-types';

describe('CypressGenerator', () => {
  const mockReportData: QAReportData = {
    metadata: {
      reportId: 'rep_cy_1',
      sessionId: 'sess_cy_1',
      url: 'https://myshop.com/login',
      title: 'MyShop Login Page',
      timestamp: 1720000000000,
      formattedDate: 'Sep 12, 2026, 10:00 AM',
      durationMs: 30000,
      engineVersion: '1.0.0',
    },
    summary: {
      overallScore: 88,
      rating: 'GOOD',
      totalFindings: 1,
      criticalCount: 0,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      testsExecuted: 10,
      pagesScanned: 1,
      elementsScanned: 20,
    },
    scores: {
      overallScore: 88,
      functionalScore: 85,
      accessibilityScore: 90,
      performanceScore: 88,
      securityScore: 92,
      categoryScores: {} as any,
    },
    findings: [
      {
        id: 'f_high_1',
        sessionId: 'sess_cy_1',
        category: 'FUNCTIONAL',
        severity: 'HIGH',
        title: 'Submit button missing accessible name',
        description: 'button#btn-submit has no aria-label or text',
        page: 'https://myshop.com/login',
        selector: 'button#btn-submit',
        elementSelector: 'button#btn-submit',
        steps: [],
        expected: 'Accessible label',
        actual: 'No label',
        confidence: 0.95,
        timestamp: 1720000005000,
        retestCount: 1,
        status: 'FAIL',
        evidence: [],
        recommendation: 'Add aria-label',
      },
    ],
    discoveryMap: {
      url: 'https://myshop.com/login',
      title: 'MyShop Login Page',
      timestamp: 1720000000000,
      pages: ['https://myshop.com/login'],
      forms: [
        {
          formSelector: 'form#login-form',
          id: 'login-form',
          name: 'loginForm',
          action: '/api/login',
          method: 'POST',
          fields: [
            {
              name: 'email',
              type: 'email',
              selector: 'input#user-email',
              required: true,
            },
            {
              name: 'password',
              type: 'password',
              selector: 'input#user-pass',
              required: true,
            },
          ],
          submitButton: {
            selector: 'button#btn-submit',
            text: 'Sign In',
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

  it('generates a complete valid Cypress TypeScript test file', () => {
    const code = generateCypressTest(mockReportData);

    expect(code).toContain('/// <reference types="cypress" />');
    expect(code).toContain("describe('Autonomous QA Cypress Suite: MyShop Login Page'");
    expect(code).toContain("cy.visit('https://myshop.com/login'");
    expect(code).toContain("cy.get('body').should('be.visible')");
  });

  it('generates form population and submission in Cypress syntax', () => {
    const code = generateCypressTest(mockReportData);

    expect(code).toContain("it('populates and submits form: \"login-form\"'");
    expect(code).toContain("cy.get('input#user-email').clear().type('qa.tester@example.com')");
    expect(code).toContain("cy.get('input#user-pass').clear().type('CypressSecur3!')");
    expect(code).toContain("cy.get('button#btn-submit').click()");
  });

  it('generates regression guard tests in Cypress syntax', () => {
    const code = generateCypressTest(mockReportData);

    expect(code).toContain("context('Regression Guards (Defect Prevention)'");
    expect(code).toContain("cy.get('button#btn-submit').should('exist')");
  });

  it('generates responsive viewport checks', () => {
    const code = generateCypressTest(mockReportData);

    expect(code).toContain("context('Responsive Viewport Validations'");
    expect(code).toContain('cy.viewport(375, 812)');
    expect(code).toContain('cy.viewport(768, 1024)');
  });
});
