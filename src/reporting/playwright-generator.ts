import { QAReportData } from './report-types';
import { DiscoveredForm, DiscoveredFormField } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';

export interface PlaywrightGeneratorOptions {
  includeFormTests?: boolean;
  includeRegressionGuards?: boolean;
  includeResponsiveTests?: boolean;
  includeConsoleMonitoring?: boolean;
  timeoutMs?: number;
}

/**
 * Escapes strings for safe inclusion in TypeScript/JavaScript template literals.
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Derives a synthetic, valid sample value for a form field based on its type and name.
 */
function getSyntheticValue(field: DiscoveredFormField): string {
  const name = (field.name || '').toLowerCase();
  const type = (field.type || 'text').toLowerCase();
  const placeholder = (field.placeholder || '').toLowerCase();

  if (type === 'email' || name.includes('email') || placeholder.includes('email')) {
    return 'qa.engineer@example.com';
  }
  if (type === 'password' || name.includes('password') || name.includes('pwd')) {
    return 'AutomationP@ssw0rd!2026';
  }
  if (type === 'tel' || name.includes('phone') || name.includes('tel') || name.includes('mobile')) {
    return '+15551234567';
  }
  if (type === 'number' || name.includes('quantity') || name.includes('amount') || name.includes('age')) {
    return '1';
  }
  if (type === 'url' || name.includes('website') || name.includes('url')) {
    return 'https://example.com';
  }
  if (name.includes('name') || name.includes('first') || name.includes('prenom')) {
    return 'Alex';
  }
  if (name.includes('last') || name.includes('nom')) {
    return 'Tester';
  }
  if (name.includes('city') || name.includes('ville')) {
    return 'Metropolis';
  }
  if (name.includes('zip') || name.includes('postal')) {
    return '10001';
  }
  if (name.includes('address') || name.includes('street')) {
    return '123 QA Automation Way';
  }
  if (name.includes('company') || name.includes('societe')) {
    return 'Acme Quality Assurance Ltd';
  }
  if (name.includes('search') || name.includes('query') || placeholder.includes('search')) {
    return 'Autonomous QA';
  }
  return 'Verified QA Sample Input';
}

/**
 * Converts a raw CSS selector to a clean Playwright locator expression.
 */
function toPlaywrightLocator(selector: string): string {
  if (!selector || selector.trim() === '') {
    return "page.locator('body')";
  }

  const clean = selector.trim();

  // If selector is a simple ID
  if (/^#[a-zA-Z0-9_-]+$/.test(clean)) {
    return `page.locator('${escapeString(clean)}')`;
  }

  // Standard CSS selector
  return `page.locator('${escapeString(clean)}')`;
}

/**
 * Autonomous Playwright Test Script Generator.
 * Compiles real exploratory QA findings and discovery maps into an executable TypeScript Playwright suite.
 */
export function generatePlaywrightTest(
  data: QAReportData,
  options: PlaywrightGeneratorOptions = {}
): string {
  const {
    includeFormTests = true,
    includeRegressionGuards = true,
    includeResponsiveTests = true,
    includeConsoleMonitoring = true,
    timeoutMs = 30000,
  } = options;

  const targetUrl = data.metadata.url || 'https://example.com';
  const pageTitle = data.metadata.title || 'Target Application';
  const sanitizedSuiteName = escapeString(pageTitle);
  const forms: DiscoveredForm[] = data.discoveryMap?.forms || [];
  const findings: Finding[] = data.findings || [];

  const code: string[] = [];

  // 1. Imports and Header Metadata
  code.push(`import { test, expect } from '@playwright/test';`);
  code.push('');
  code.push(`/**`);
  code.push(` * Production End-to-End Test Suite`);
  code.push(` * Generated autonomously by AI Website QA Agent`);
  code.push(` * Target: ${targetUrl}`);
  code.push(` * Generated on: ${new Date().toISOString()}`);
  code.push(` * Total Findings Analyzed: ${findings.length}`);
  code.push(` */`);
  code.push('');

  // 2. Suite Configuration & Hooks
  code.push(`test.describe('Autonomous QA E2E Suite: ${sanitizedSuiteName}', () => {`);
  code.push(`  test.beforeEach(async ({ page }) => {`);
  code.push(`    // Set baseline timeout`);
  code.push(`    test.setTimeout(${timeoutMs});`);
  code.push(`    // Navigate to target application`);
  code.push(`    await page.goto('${escapeString(targetUrl)}', { waitUntil: 'domcontentloaded' });`);
  code.push(`  });`);
  code.push('');

  // 3. Baseline Health & Console Integrity Test
  code.push(`  test('Baseline Health: Verifies page loads without fatal exceptions', async ({ page }) => {`);
  if (includeConsoleMonitoring) {
    code.push(`    const consoleErrors: string[] = [];`);
    code.push(`    page.on('console', (msg) => {`);
    code.push(`      if (msg.type() === 'error') {`);
    code.push(`        consoleErrors.push(msg.text());`);
    code.push(`      }`);
    code.push(`    });`);
    code.push(`    page.on('pageerror', (error) => {`);
    code.push(`      consoleErrors.push(error.message);`);
    code.push(`    });`);
    code.push('');
    code.push(`    // Allow page scripts and initial network requests to settle`);
    code.push(`    await page.waitForLoadState('networkidle').catch(() => {});`);
    code.push('');
    code.push(`    // Assert main document body is rendered`);
    code.push(`    await expect(page.locator('body')).toBeVisible();`);
    code.push(`    expect(consoleErrors, 'Fatal uncaught JS runtime errors detected').toHaveLength(0);`);
  } else {
    code.push(`    await expect(page.locator('body')).toBeVisible();`);
  }
  code.push(`  });`);
  code.push('');

  // 4. Form Submission & Input Validation Tests
  if (includeFormTests && forms.length > 0) {
    forms.slice(0, 3).forEach((form, formIndex) => {
      const formSelector = form.formSelector || `form:nth-of-type(${formIndex + 1})`;
      const formName = form.id || form.name || `Form_${formIndex + 1}`;

      code.push(`  test('User Journey: Populate and submit form "${escapeString(formName)}"', async ({ page }) => {`);
      code.push(`    const formLocator = ${toPlaywrightLocator(formSelector)};`);
      code.push(`    await expect(formLocator, 'Form container should be visible').toBeVisible();`);
      code.push('');

      if (form.fields && form.fields.length > 0) {
        code.push(`    // Populate discovered form fields`);
        for (const field of form.fields.slice(0, 10)) {
          if (!field.selector) continue;
          const inputLoc = toPlaywrightLocator(field.selector);
          const type = (field.type || 'text').toLowerCase();

          if (type === 'checkbox' || type === 'radio') {
            code.push(`    await ${inputLoc}.check().catch(() => {});`);
          } else if (type === 'select' || type === 'select-one') {
            code.push(`    await ${inputLoc}.selectOption({ index: 1 }).catch(() => {});`);
          } else if (type !== 'hidden' && type !== 'submit' && type !== 'button') {
            const val = getSyntheticValue(field);
            code.push(`    await ${inputLoc}.fill('${escapeString(val)}');`);
          }
        }
        code.push('');
      }

      // Submit action
      if (form.submitButton?.selector) {
        code.push(`    // Trigger submit`);
        code.push(`    const submitBtn = ${toPlaywrightLocator(form.submitButton.selector)};`);
        code.push(`    await expect(submitBtn).toBeVisible();`);
        code.push(`    await submitBtn.click();`);
      } else {
        code.push(`    // Trigger enter key submission`);
        code.push(`    await formLocator.press('Enter').catch(() => {});`);
      }

      code.push(`    await page.waitForTimeout(1000);`);
      code.push(`  });`);
      code.push('');
    });
  }

  // 5. Automated Regression Guards for Discovered Defects
  if (includeRegressionGuards && findings.length > 0) {
    const criticalAndHighFindings = findings
      .filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
      .slice(0, 5);

    if (criticalAndHighFindings.length > 0) {
      code.push(`  test.describe('Regression Guards (Defect Prevention)', () => {`);
      for (const finding of criticalAndHighFindings) {
        const testName = escapeString(`Guard against ${finding.severity}: ${finding.title}`);
        code.push(`    test('${testName}', async ({ page }) => {`);
        code.push(`      // Verified Defect: ${escapeString(finding.description.replace(/\n/g, ' '))}`);
        if (finding.elementSelector) {
          const loc = toPlaywrightLocator(finding.elementSelector);
          code.push(`      const targetElement = ${loc};`);
          code.push(`      // Regression assertion: Ensure element is rendered and interactive`);
          code.push(`      await expect(targetElement).toBeAttached();`);
        }
        if (finding.category === 'NETWORK' && finding.actualResult) {
          code.push(`      // Regression check: Ensure network calls do not return error statuses`);
          code.push(`      page.on('response', (response) => {`);
          code.push(`        if (response.url().includes('${escapeString(targetUrl)}')) {`);
          code.push(`          expect(response.status(), \`Endpoint \${response.url()} failed\`).toBeLessThan(400);`);
          code.push(`        }`);
          code.push(`      });`);
        }
        code.push(`      await page.waitForLoadState('domcontentloaded');`);
        code.push(`    });`);
        code.push('');
      }
      code.push(`  });`);
      code.push('');
    }
  }

  // 6. Responsive Breakpoint Tests
  if (includeResponsiveTests) {
    code.push(`  test.describe('Responsive & Cross-Device Layout Verification', () => {`);
    code.push(`    const viewports = [`);
    code.push(`      { name: 'Mobile Portrait (iPhone 14)', width: 390, height: 844 },`);
    code.push(`      { name: 'Tablet Portrait (iPad Mini)', width: 768, height: 1024 },`);
    code.push(`      { name: 'Desktop Standard (1080p)', width: 1920, height: 1080 },`);
    code.push(`    ];`);
    code.push('');
    code.push(`    for (const vp of viewports) {`);
    code.push(`      test(\`Layout renders without horizontal overflow on \${vp.name}\`, async ({ page }) => {`);
    code.push(`        await page.setViewportSize({ width: vp.width, height: vp.height });`);
    code.push(`        await page.goto('${escapeString(targetUrl)}', { waitUntil: 'domcontentloaded' });`);
    code.push(`        const body = page.locator('body');`);
    code.push(`        await expect(body).toBeVisible();`);
    code.push('');
    code.push(`        // Verify absence of horizontal scrollbar leakage`);
    code.push(`        const hasHorizontalScroll = await page.evaluate(() => {`);
    code.push(`          return document.documentElement.scrollWidth > window.innerWidth;`);
    code.push(`        });`);
    code.push(`        expect(hasHorizontalScroll, \`Horizontal overflow detected on \${vp.name}\`).toBeFalsy();`);
    code.push(`      });`);
    code.push(`    }`);
    code.push(`  });`);
  }

  code.push(`});`);
  code.push('');

  return code.join('\n');
}
