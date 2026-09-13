import { describe, it, expect } from 'vitest';
import { GitHubPRGenerator } from '../../src/agent/github-pr-generator';
import { PatchGenerator } from '../../src/agent/patch-generator';
import { Finding } from '../../src/shared/types/qa';

describe('GitHubPRGenerator', () => {
  const prGenerator = new GitHubPRGenerator();
  const patchGenerator = new PatchGenerator();

  const mockFinding1: Finding = {
    id: 'finding_acc_001',
    sessionId: 'sess_1',
    page: 'https://store.example.com',
    category: 'ACCESSIBILITY',
    severity: 'MEDIUM',
    status: 'FAIL',
    confidence: 0.95,
    title: '[Accessibility] Missing alt attribute on product image',
    description: 'The image element is missing an alt attribute.',
    elementSelector: 'img.product',
    steps: ['Inspect img.product'],
    expected: 'All images must have alt text',
    actual: 'No alt attribute',
    timestamp: Date.now(),
    retestCount: 0,
  };

  const mockFinding2: Finding = {
    id: 'finding_sec_002',
    sessionId: 'sess_1',
    page: 'https://store.example.com/search',
    category: 'SECURITY',
    severity: 'CRITICAL',
    status: 'FAIL',
    confidence: 0.98,
    title: '[Security] Reflected XSS canary in search query',
    description: 'Canary string executed without sanitization.',
    elementSelector: '#search-output',
    steps: ['Search for canary payload', 'Observe execution'],
    expected: 'Payload must be HTML escaped',
    actual: 'Payload rendered as raw DOM nodes',
    timestamp: Date.now(),
    retestCount: 0,
  };

  it('generates a single defect pull request with formatted branch, markdown, and CLI script', () => {
    const patch = patchGenerator.generatePatch(mockFinding1);
    const pr = prGenerator.generateSingleDefectPR(mockFinding1, patch, {
      owner: 'acme-corp',
      repo: 'web-store',
      baseBranch: 'main',
    });

    expect(pr.branchName).toContain('fix/qa-autonomous-accessibility-');
    expect(pr.title).toBe('fix(accessibility): Missing alt attribute on product image');
    expect(pr.baseBranch).toBe('main');

    // Body checks
    expect(pr.body).toContain('Autonomous QA Agent: Automated Fix Proposal');
    expect(pr.body).toContain('src/components/common/ImageMedia.tsx');
    expect(pr.body).toContain('```diff');
    expect(pr.body).toContain('Verification Checklist');

    // CLI workflow checks
    expect(pr.gitWorkflowCommands).toContain('git checkout -b');
    expect(pr.gitWorkflowCommands).toContain('git apply');
    expect(pr.gitWorkflowCommands).toContain('git commit -m');
    expect(pr.gitWorkflowCommands).toContain('git push -u origin');

    // API Payload
    expect(pr.apiPayload.title).toBe(pr.title);
    expect(pr.apiPayload.head).toBe(pr.branchName);
    expect(pr.apiPayload.base).toBe('main');
    expect(pr.apiPayload.draft).toBe(false);
  });

  it('generates a composite PR consolidating multiple findings and patches', () => {
    const findings = [mockFinding1, mockFinding2];
    const pr = prGenerator.generateCompositePR(findings, undefined, {
      baseBranch: 'develop',
    });

    expect(pr.branchName).toContain('fix/qa-audit-remediation-');
    expect(pr.title).toContain('autonomous remediation for 2 detected defects');
    expect(pr.baseBranch).toBe('develop');

    // Check table of defects
    expect(pr.body).toContain('**Total Defects Addressed** | 2');
    expect(pr.body).toContain('finding_acc_001'.slice(-8));
    expect(pr.body).toContain('finding_sec_002'.slice(-8));

    // Diffs for both should be included
    expect(pr.body).toContain('Defect #1: [Accessibility] Missing alt attribute on product image');
    expect(pr.body).toContain('Defect #2: [Security] Reflected XSS canary in search query');

    // Workflow command checks
    expect(pr.gitWorkflowCommands).toContain('git fetch origin develop');
    expect(pr.gitWorkflowCommands).toContain('cat << \'EOF\' | git apply -v');
  });
});
