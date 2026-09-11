import { describe, it, expect, vi, afterEach } from 'vitest';
import { flowAnalyzer } from '../../src/ai/flow-analyzer';
import { PageSnapshot } from '../../src/shared/types/discovery';
import { cloudLlmClient } from '../../src/ai/cloud-llm-client';

describe('FlowAnalyzer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseSnapshot: PageSnapshot = {
    url: 'https://store.example.com/checkout',
    origin: 'https://store.example.com',
    pathname: '/checkout',
    title: 'Awesome Store - Product Cart',
    metadata: {
      title: 'Awesome Store - Product Cart',
      description: 'Buy premium products online',
      canonical: 'https://store.example.com/checkout',
      robots: 'index, follow',
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1.0',
      h1Count: 1,
      h1Texts: ['Shopping Cart and Checkout'],
      headingCounts: {
        h1: 1,
        h2: 2,
        h3: 1,
        h4: 0,
        h5: 0,
        h6: 0,
      },
    },
    links: [
      {
        href: 'https://store.example.com/shop',
        normalizedUrl: 'https://store.example.com/shop',
        text: 'Shop All Products',
        isInternal: true,
        isAnchor: false,
        isMailtoOrTel: false,
        selector: 'nav a:first-child',
      },
      {
        href: '#',
        normalizedUrl: 'https://store.example.com/checkout#',
        text: 'Quick View Item',
        isInternal: false,
        isAnchor: true,
        isMailtoOrTel: false,
        selector: '.item a.quick-view',
      },
    ],
    buttons: [
      {
        text: 'Checkout Now',
        type: 'submit',
        isDisabled: false,
        isVisible: true,
        riskLevel: 'HIGH',
        selector: 'button#checkout',
      },
    ],
    forms: [
      {
        id: 'checkout-form',
        name: 'checkout',
        action: '/pay',
        method: 'POST',
        submitButtonSelector: 'button#checkout',
        riskLevel: 'HIGH',
        selector: 'form#checkout-form',
        fields: Array.from({ length: 8 }, (_, i) => ({
          name: `field_${i}`,
          type: 'text',
          placeholder: `Field ${i}`,
          required: i < 5,
          selector: `input#f_${i}`,
        })),
      },
    ],
    images: [],
    navigations: [],
    totalInteractiveCount: 3,
    timestamp: Date.now(),
  };

  it('detects page intent and analyzes conversion flow for e-commerce', async () => {
    const result = await flowAnalyzer.analyzeFlow(baseSnapshot, 'session_123');

    expect(result.flowAnalysis).toBeDefined();
    expect(result.flowAnalysis.pageIntent).toContain('E-Commerce');
    expect(result.flowAnalysis.flowScore).toBeGreaterThan(0);
    expect(result.flowAnalysis.flowScore).toBeLessThanOrEqual(100);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.every((f) => f.category === 'UX')).toBe(true);
  });

  it('identifies dead anchor clicks and generates actionable recommendations', async () => {
    const result = await flowAnalyzer.analyzeFlow(baseSnapshot, 'session_123');

    const deadAnchorFriction = result.flowAnalysis.frictionPoints.find((f) =>
      f.title.includes('Broken / Inert Navigation Anchors')
    );
    expect(deadAnchorFriction).toBeDefined();
    expect(deadAnchorFriction?.severity).toBe('HIGH');

    const anchorRec = result.flowAnalysis.recommendations.find((r) =>
      r.title.includes('Inert Anchor')
    );
    expect(anchorRec).toBeDefined();
    expect(anchorRec?.suggestedImprovement).toBeDefined();
  });

  it('flags long forms as high cognitive friction and suggests multi-step disclosure', async () => {
    const result = await flowAnalyzer.analyzeFlow(baseSnapshot, 'session_123');

    const formFriction = result.flowAnalysis.frictionPoints.find((f) =>
      f.title.includes('High Cognitive Friction in Form')
    );
    expect(formFriction).toBeDefined();
    expect(formFriction?.severity).toBe('MEDIUM');

    const formRec = result.flowAnalysis.recommendations.find((r) =>
      r.title.includes('Progressive Disclosure')
    );
    expect(formRec).toBeDefined();
    expect(formRec?.suggestedImprovement).toContain('2 digestible steps');
  });

  it('flags missing primary CTA on pages with no conversion triggers', async () => {
    const noCtaSnapshot: PageSnapshot = {
      ...baseSnapshot,
      buttons: [],
      links: [],
      forms: [],
    };

    const result = await flowAnalyzer.analyzeFlow(noCtaSnapshot, 'session_456');
    const ctaFriction = result.flowAnalysis.frictionPoints.find((f) =>
      f.title.includes('Missing Primary Call-To-Action')
    );
    expect(ctaFriction).toBeDefined();

    const ctaRec = result.flowAnalysis.recommendations.find((r) =>
      r.title.includes('Hero & Sticky Conversion CTA')
    );
    expect(ctaRec).toBeDefined();
    expect(ctaRec?.priority).toBe('HIGH');
  });

  it('enriches flow analysis with Cloud LLM response when configured', async () => {
    vi.spyOn(cloudLlmClient, 'resolveActiveProvider').mockReturnValue({
      provider: 'gemini',
      apiKey: 'valid-gemini-key',
      model: 'gemini-1.5-pro',
      isCloud: true,
    });

    vi.spyOn(cloudLlmClient, 'generateCompletion').mockResolvedValue(
      JSON.stringify({
        summary: 'Deep AI audit: Streamlined checkout with minor form hesitation.',
        strengths: ['Prominent checkout trigger', 'Mobile responsive controls'],
        additionalRecommendations: [
          {
            priority: 'HIGH',
            title: 'Add One-Click Apple Pay / Google Pay Flow',
            currentFlowIssue: 'Users must type credit card manually',
            suggestedImprovement: 'Enable digital wallet express checkout',
            expectedImpact: '+22% conversion speed on mobile',
          },
        ],
      })
    );

    const result = await flowAnalyzer.analyzeFlow(baseSnapshot, 'session_ai_789', {
      provider: 'gemini',
      geminiApiKey: 'valid-gemini-key',
    });

    expect(result.flowAnalysis.evaluatedBy).toContain('GEMINI Pro Agent');
    expect(result.flowAnalysis.strengths).toContain('Prominent checkout trigger');

    const walletRec = result.flowAnalysis.recommendations.find((r) =>
      r.title.includes('One-Click Apple Pay')
    );
    expect(walletRec).toBeDefined();
    expect(walletRec?.expectedImpact).toContain('+22%');
  });
});
