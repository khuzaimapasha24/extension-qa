import { describe, it, expect } from 'vitest';
import { generateGitHubActionsWorkflow } from '../../src/reporting/github-actions-generator';

describe('GitHubActionsGenerator', () => {
  it('generates a standard GitHub Actions CI/CD workflow file', () => {
    const yaml = generateGitHubActionsWorkflow();

    expect(yaml).toContain('name: AI QA Autonomous E2E Pipeline');
    expect(yaml).toContain('uses: actions/checkout@v4');
    expect(yaml).toContain('uses: actions/setup-node@v4');
    expect(yaml).toContain('node-version: 20');
    expect(yaml).toContain('run: npx playwright install --with-deps chromium');
    expect(yaml).toContain('run: npx playwright test');
    expect(yaml).toContain('uses: actions/upload-artifact@v4');
    expect(yaml).toContain('name: playwright-qa-report');
  });

  it('allows customization of workflow parameters', () => {
    const yaml = generateGitHubActionsWorkflow({
      workflowName: 'Custom Client QA Suite',
      nodeVersion: '22',
      cronSchedule: '0 4 * * *',
      testCommand: 'npm run test:e2e',
    });

    expect(yaml).toContain('name: Custom Client QA Suite');
    expect(yaml).toContain('node-version: 22');
    expect(yaml).toContain("- cron: '0 4 * * *'");
    expect(yaml).toContain('run: npm run test:e2e');
  });
});
