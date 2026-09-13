import { describe, it, expect } from 'vitest';
import { PatchGenerator } from '../../src/agent/patch-generator';
import { Finding } from '../../src/shared/types/qa';

describe('PatchGenerator', () => {
  const generator = new PatchGenerator();

  const baseFinding: Finding = {
    id: 'finding_test_123',
    sessionId: 'sess_1',
    page: 'https://example.com/checkout',
    category: 'ACCESSIBILITY',
    severity: 'MEDIUM',
    status: 'FAIL',
    confidence: 0.95,
    title: '[Accessibility] Missing alt attribute on product image',
    description: 'The image element is missing an alt attribute.',
    elementSelector: 'img.product-thumb',
    steps: ['Navigate to page', 'Inspect img.product-thumb'],
    expected: 'All images must have descriptive alt text',
    actual: 'Missing alt attribute',
    recommendation: 'Add alt attribute describing the product visual',
    timestamp: Date.now(),
    retestCount: 0,
  };

  it('generates an accessibility patch for missing alt attribute', () => {
    const patch = generator.generatePatch(baseFinding);

    expect(patch.defectId).toBe('finding_test_123');
    expect(patch.category).toBe('ACCESSIBILITY');
    expect(patch.targetFile).toContain('ImageMedia.tsx');
    expect(patch.diff).toContain('--- a/');
    expect(patch.diff).toContain('+++ b/');
    expect(patch.diff).toContain('alt={label ||');
    expect(patch.rootCauseAnalysis).toContain('WCAG 2.1');
    expect(patch.riskAssessment.level).toBe('LOW');
  });

  it('generates a patch for missing primary H1 heading', () => {
    const h1Finding: Finding = {
      ...baseFinding,
      id: 'finding_h1',
      title: '[Visual Hierarchy] Missing Primary Heading (H1)',
      description: '0 H1 tags found in DOM',
    };

    const patch = generator.generatePatch(h1Finding);

    expect(patch.targetFile).toContain('MainLayout.tsx');
    expect(patch.diff).toContain('<h1');
    expect(patch.rootCauseAnalysis).toContain('semantic document outline');
  });

  it('generates a responsive patch for horizontal overflow blowout', () => {
    const overflowFinding: Finding = {
      ...baseFinding,
      id: 'finding_overflow',
      category: 'RESPONSIVE',
      severity: 'HIGH',
      title: '[Layout Defect] Horizontal Viewport Blowout Detected',
      description: 'Document content overflows viewport width',
    };

    const patch = generator.generatePatch(overflowFinding);

    expect(patch.targetFile).toBe('src/styles/layout.css');
    expect(patch.diff).toContain('overflow-x: hidden');
    expect(patch.diff).toContain('max-width: 100vw');
    expect(patch.riskAssessment.level).toBe('MEDIUM');
  });

  it('generates a security patch for reflected XSS canary vulnerability', () => {
    const xssFinding: Finding = {
      ...baseFinding,
      id: 'finding_xss',
      category: 'SECURITY',
      severity: 'CRITICAL',
      title: '[Security Vulnerability] Reflected XSS Canary Executed in Live DOM',
      description: 'Canary string <svg onload=alert(1)> was rendered directly',
    };

    const patch = generator.generatePatch(xssFinding);

    expect(patch.targetFile).toContain('CommentRenderer.tsx');
    expect(patch.diff).toContain('comment-text');
    expect(patch.diff).toContain('Autonomous QA Patch: Neutralize XSS canary');
    expect(patch.rootCauseAnalysis).toContain('innerHTML');
  });

  it('generates a business logic patch for pricing math discrepancy', () => {
    const pricingFinding: Finding = {
      ...baseFinding,
      id: 'finding_pricing',
      category: 'FUNCTIONAL',
      severity: 'HIGH',
      title: '[Business Logic] Pricing Discrepancy: Subtotal - Discount != Total',
      description: 'Discount caused total to drift',
    };

    const patch = generator.generatePatch(pricingFinding);

    expect(patch.targetFile).toContain('cart-calculator.ts');
    expect(patch.diff).toContain('Math.max(0, subtotal - discount)');
    expect(patch.diff).toContain('Math.round');
  });

  it('compiles multiple patches into a consolidated multi-file patch file', () => {
    const patch1 = generator.generatePatch(baseFinding);
    const patch2 = generator.generatePatch({
      ...baseFinding,
      id: 'finding_overflow',
      category: 'RESPONSIVE',
      title: 'Horizontal Viewport Blowout',
    });

    const unifiedFile = generator.generateUnifiedPatchFile([patch1, patch2]);

    expect(unifiedFile).toContain('# Autonomous QA Engineering Patch Bundle');
    expect(unifiedFile).toContain('# Total Patches: 2');
    expect(unifiedFile).toContain('--- a/src/components/common/ImageMedia.tsx');
    expect(unifiedFile).toContain('--- a/src/styles/layout.css');
  });
});
