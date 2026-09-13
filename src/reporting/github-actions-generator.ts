export interface GitHubActionsOptions {
  workflowName?: string;
  nodeVersion?: string;
  cronSchedule?: string;
  testCommand?: string;
}

/**
 * Autonomous GitHub Actions Workflow Generator.
 * Generates ready-to-commit .github/workflows/qa-pipeline.yml for 24/7 CI/CD testing.
 */
export function generateGitHubActionsWorkflow(options: GitHubActionsOptions = {}): string {
  const {
    workflowName = 'AI QA Autonomous E2E Pipeline',
    nodeVersion = '20',
    cronSchedule = '0 2 * * *', // Daily at 02:00 UTC
    testCommand = 'npx playwright test',
  } = options;

  return `name: ${workflowName}

on:
  push:
    branches: [ main, master, develop ]
  pull_request:
    branches: [ main, master ]
  schedule:
    # Autonomous Nightly Regression Run
    - cron: '${cronSchedule}'
  workflow_dispatch:

jobs:
  autonomous-e2e:
    name: Run Autonomous Playwright Tests
    timeout-minutes: 45
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js v${nodeVersion}
        uses: actions/setup-node@v4
        with:
          node-version: ${nodeVersion}
          cache: 'npm'

      - name: Install Project Dependencies
        run: npm ci || npm install

      - name: Install Playwright Browsers with Dependencies
        run: npx playwright install --with-deps chromium

      - name: Execute Autonomous QA E2E Suite
        run: ${testCommand}
        env:
          CI: true

      - name: Archive Test Results & HTML Report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-qa-report
          path: playwright-report/
          retention-days: 30
`;
}
