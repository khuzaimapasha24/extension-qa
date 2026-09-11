import { describe, it, expect } from 'vitest';
import { BotShieldDetector } from '../../src/qa/bot-shield-detector';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('BotShieldDetector', () => {
  const detector = new BotShieldDetector();

  const createBaseSnapshot = (overrides: Partial<PageSnapshot> = {}): PageSnapshot => ({
    url: 'https://example.com/login',
    origin: 'https://example.com',
    pathname: '/login',
    title: 'Login Page',
    timestamp: Date.now(),
    totalInteractiveCount: 1,
    metadata: {
      title: 'Login Page',
      h1Count: 1,
      h1Texts: ['Login'],
      headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    },
    forms: [],
    buttons: [],
    links: [],
    images: [],
    navigations: [],
    ...overrides,
  });

  it('detects Cloudflare Turnstile and provides staging test keys', () => {
    const snapshot = createBaseSnapshot({
      forms: [
        {
          id: 'signup-form',
          selector: '#signup-form',
          action: '/signup',
          method: 'POST',
          riskLevel: 'LOW',
          fields: [
            {
              name: 'cf-turnstile-response',
              type: 'hidden',
              selector: '.cf-turnstile',
              required: true,
            },
          ],
        },
      ],
    });

    const detection = detector.detectBotShield(snapshot);
    expect(detection.detected).toBe(true);
    expect(detection.provider).toBe('CLOUDFLARE_TURNSTILE');
    expect(detection.testKeysAdvice).toContain('1x00000000000000000000AA');

    const findings = detector.generateFindings(snapshot, 'sess-123');
    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain('Cloudflare Turnstile Active');
    expect(findings[0].severity).toBe('INFO');
  });

  it('detects Google reCAPTCHA and provides official Google test keys', () => {
    const snapshot = createBaseSnapshot({
      buttons: [
        {
          text: 'Protected by reCAPTCHA',
          type: 'button',
          selector: '.g-recaptcha',
          isVisible: true,
          isDisabled: false,
          riskLevel: 'LOW',
        },
      ],
    });

    const detection = detector.detectBotShield(snapshot);
    expect(detection.detected).toBe(true);
    expect(detection.provider).toBe('GOOGLE_RECAPTCHA');
    expect(detection.testKeysAdvice).toContain('6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI');
  });

  it('returns clean none result on pages without bot protection', () => {
    const snapshot = createBaseSnapshot({
      forms: [
        {
          id: 'search-form',
          selector: '#search-form',
          action: '/search',
          method: 'GET',
          riskLevel: 'LOW',
          fields: [
            {
              name: 'query',
              type: 'text',
              selector: 'input[name="query"]',
              required: false,
            },
          ],
        },
      ],
    });

    const detection = detector.detectBotShield(snapshot);
    expect(detection.detected).toBe(false);
    expect(detection.provider).toBe('NONE');

    const findings = detector.generateFindings(snapshot, 'sess-123');
    expect(findings.length).toBe(0);
  });
});
