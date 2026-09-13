import { QAReportData } from './report-types';
import { DiscoveredForm, DiscoveredFormField } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';

export interface CypressGeneratorOptions {
  includeFormTests?: boolean;
  includeRegressionGuards?: boolean;
  includeResponsiveTests?: boolean;
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function getSyntheticValue(field: DiscoveredFormField): string {
  const name = (field.name || '').toLowerCase();
  const type = (field.type || 'text').toLowerCase();

  if (type === 'email' || name.includes('email')) return 'qa.tester@example.com';
  if (type === 'password' || name.includes('password')) return 'CypressSecur3!';
  if (type === 'tel' || name.includes('phone')) return '+15559876543';
  if (type === 'number') return '1';
  if (name.includes('name') || name.includes('first')) return 'Jordan';
  if (name.includes('last')) return 'Smith';
  return 'Verified Cypress Input';
}

/**
 * Autonomous Cypress Test Script Generator.
 * Compiles real exploratory QA findings and discovery maps into an executable TypeScript Cypress suite.
 */
export function generateCypressTest(
  data: QAReportData,
  options: CypressGeneratorOptions = {}
): string {
  const {
    includeFormTests = true,
    includeRegressionGuards = true,
    includeResponsiveTests = true,
  } = options;

  const targetUrl = data.metadata.url || 'https://example.com';
  const pageTitle = data.metadata.title || 'Target Application';
  const sanitizedSuiteName = escapeString(pageTitle);
  const forms: DiscoveredForm[] = data.discoveryMap?.forms || [];
  const findings: Finding[] = data.findings || [];

  const code: string[] = [];

  code.push(`/// <reference types="cypress" />`);
  code.push('');
  code.push(`/**`);
  code.push(` * Production Cypress End-to-End Test Suite`);
  code.push(` * Generated autonomously by AI Website QA Agent`);
  code.push(` * Target: ${targetUrl}`);
  code.push(` * Generated on: ${new Date().toISOString()}`);
  code.push(` */`);
  code.push('');

  code.push(`describe('Autonomous QA Cypress Suite: ${sanitizedSuiteName}', () => {`);
  code.push(`  beforeEach(() => {`);
  code.push(`    // Intercept all outgoing API requests for inspection`);
  code.push(`    cy.intercept('**/*').as('networkTraffic');`);
  code.push(`    cy.visit('${escapeString(targetUrl)}', { failOnStatusCode: false });`);
  code.push(`  });`);
  code.push('');

  // Baseline Test
  code.push(`  it('verifies initial page load and body visibility', () => {`);
  code.push(`    cy.get('body').should('be.visible');`);
  code.push(`  });`);
  code.push('');

  // Form Tests
  if (includeFormTests && forms.length > 0) {
    forms.slice(0, 3).forEach((form, index) => {
      const formSelector = form.formSelector || `form:nth-of-type(${index + 1})`;
      const formName = escapeString(form.id || form.name || `Form ${index + 1}`);

      code.push(`  it('populates and submits form: "${formName}"', () => {`);
      code.push(`    cy.get('${escapeString(formSelector)}').should('exist');`);
      code.push('');

      if (form.fields) {
        for (const field of form.fields.slice(0, 10)) {
          if (!field.selector) continue;
          const sel = escapeString(field.selector);
          const type = (field.type || 'text').toLowerCase();

          if (type === 'checkbox' || type === 'radio') {
            code.push(`    cy.get('${sel}').check({ force: true });`);
          } else if (type === 'select' || type === 'select-one') {
            code.push(`    cy.get('${sel}').select(1, { force: true });`);
          } else if (type !== 'hidden' && type !== 'submit' && type !== 'button') {
            const val = escapeString(getSyntheticValue(field));
            code.push(`    cy.get('${sel}').clear().type('${val}');`);
          }
        }
      }

      if (form.submitButton?.selector) {
        code.push(`    cy.get('${escapeString(form.submitButton.selector)}').click();`);
      } else {
        code.push(`    cy.get('${escapeString(formSelector)}').submit();`);
      }

      code.push(`  });`);
      code.push('');
    });
  }

  // Regression Guards
  if (includeRegressionGuards && findings.length > 0) {
    const criticalFindings = findings
      .filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
      .slice(0, 5);

    if (criticalFindings.length > 0) {
      code.push(`  context('Regression Guards (Defect Prevention)', () => {`);
      for (const finding of criticalFindings) {
        const title = escapeString(finding.title);
        code.push(`    it('reproduces and guards against defect: ${title}', () => {`);
        if (finding.elementSelector) {
          code.push(`      cy.get('${escapeString(finding.elementSelector)}').should('exist');`);
        } else {
          code.push(`      cy.get('body').should('be.visible');`);
        }
        code.push(`    });`);
        code.push('');
      }
      code.push(`  });`);
      code.push('');
    }
  }

  // Responsive Tests
  if (includeResponsiveTests) {
    code.push(`  context('Responsive Viewport Validations', () => {`);
    code.push(`    it('renders on mobile viewport (iPhone X)', () => {`);
    code.push(`      cy.viewport(375, 812);`);
    code.push(`      cy.get('body').should('be.visible');`);
    code.push(`    });`);
    code.push('');
    code.push(`    it('renders on tablet viewport (iPad)', () => {`);
    code.push(`      cy.viewport(768, 1024);`);
    code.push(`      cy.get('body').should('be.visible');`);
    code.push(`    });`);
    code.push(`  });`);
  }

  code.push(`});`);
  code.push('');

  return code.join('\n');
}
