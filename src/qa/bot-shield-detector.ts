import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('BotShieldDetector');

export type BotShieldProvider =
  | 'CLOUDFLARE_TURNSTILE'
  | 'GOOGLE_RECAPTCHA'
  | 'HCAPTCHA'
  | 'ARKOSE_LABS'
  | 'AWS_WAF'
  | 'NONE';

export interface BotShieldDetection {
  detected: boolean;
  provider: BotShieldProvider;
  providerName: string;
  selector?: string;
  testKeysAdvice: string;
  bypassGuidance: string;
}

export class BotShieldDetector {
  /**
   * Scans snapshot for anti-bot defenses and CAPTCHA challenges.
   */
  public detectBotShield(snapshot: PageSnapshot): BotShieldDetection {
    // 1. Check forms, buttons, and interactive elements
    const elementsToCheck: string[] = [];

    const forms = Array.isArray(snapshot.forms) ? snapshot.forms : [];
    for (const form of forms) {
      elementsToCheck.push(form.selector || '', form.id || '');
      const fields = Array.isArray(form.fields) ? form.fields : [];
      for (const field of fields) {
        elementsToCheck.push(field.selector || '', field.name || '', field.label || '');
      }
    }

    const buttons = Array.isArray(snapshot.buttons) ? snapshot.buttons : [];
    for (const btn of buttons) {
      elementsToCheck.push(btn.selector || '', btn.text || '', btn.type || '');
    }

    const links = Array.isArray(snapshot.links) ? snapshot.links : [];
    for (const link of links) {
      elementsToCheck.push(link.selector || '', link.text || '', link.href || '');
    }

    const combinedStr = elementsToCheck.join(' ').toLowerCase();

    // 1. Cloudflare Turnstile
    if (combinedStr.includes('turnstile') || combinedStr.includes('cf-turnstile')) {
      return {
        detected: true,
        provider: 'CLOUDFLARE_TURNSTILE',
        providerName: 'Cloudflare Turnstile',
        selector: '.cf-turnstile, [data-turnstile]',
        testKeysAdvice: 'Use test sitekey "1x00000000000000000000AA" (always passes) and test secret "1x0000000000000000000000000000000AA" on staging environments.',
        bypassGuidance: 'Configure Cloudflare WAF skip rules for test IP ranges or inject CF-Bypass staging headers.',
      };
    }

    // 2. Google reCAPTCHA
    if (combinedStr.includes('recaptcha') || combinedStr.includes('g-recaptcha')) {
      return {
        detected: true,
        provider: 'GOOGLE_RECAPTCHA',
        providerName: 'Google reCAPTCHA',
        selector: '.g-recaptcha, #g-recaptcha-response',
        testKeysAdvice: 'Use Google official test sitekey "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" and secret "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe" to guarantee 100% pass rate in QA.',
        bypassGuidance: 'Disable reCAPTCHA verification on localhost and staging domains in the reCAPTCHA admin console.',
      };
    }

    // 3. hCaptcha
    if (combinedStr.includes('hcaptcha') || combinedStr.includes('h-captcha')) {
      return {
        detected: true,
        provider: 'HCAPTCHA',
        providerName: 'hCaptcha',
        selector: '.h-captcha, iframe[src*="hcaptcha"]',
        testKeysAdvice: 'Use hCaptcha test sitekey "10000000-ffff-ffff-ffff-000000000001" and secret "0x0000000000000000000000000000000000000000".',
        bypassGuidance: 'Enable test mode or configure custom test bypass tokens in staging settings.',
      };
    }

    // 4. Arkose Labs / FunCaptcha
    if (combinedStr.includes('arkose') || combinedStr.includes('funcaptcha')) {
      return {
        detected: true,
        provider: 'ARKOSE_LABS',
        providerName: 'Arkose Labs (FunCaptcha)',
        selector: '#arkose-frame, .arkose-container',
        testKeysAdvice: 'Use Arkose Labs sandbox environment and pre-configured test keys.',
        bypassGuidance: 'Add QA test runner IP to the Arkose allowlist policy.',
      };
    }

    // 5. AWS WAF
    if (combinedStr.includes('aws-waf') || combinedStr.includes('awswaf')) {
      return {
        detected: true,
        provider: 'AWS_WAF',
        providerName: 'AWS WAF Challenge',
        selector: '#aws-waf-integration',
        testKeysAdvice: 'Configure AWS WAF web ACL rule exception for staging IP CIDR blocks.',
        bypassGuidance: 'Supply custom secret header (e.g. x-staging-bypass-key) evaluated before WAF challenge rules.',
      };
    }

    return {
      detected: false,
      provider: 'NONE',
      providerName: 'None',
      testKeysAdvice: '',
      bypassGuidance: '',
    };
  }

  /**
   * Generates informational QA findings with developer staging test credentials and bypass guidance.
   */
  public generateFindings(snapshot: PageSnapshot, sessionId: string): Finding[] {
    const detection = this.detectBotShield(snapshot);
    if (!detection.detected) {
      return [];
    }

    logger.info(`Detected bot protection: ${detection.providerName} on ${snapshot.url}`);

    return [
      {
        id: `finding_botshield_${sessionId}_${detection.provider}`,
        sessionId,
        category: 'FUNCTIONAL',
        severity: 'INFO',
        status: 'WARNING',
        confidence: 0.95,
        title: `[Bot Shield Detected] ${detection.providerName} Active on "${snapshot.title || 'Target Page'}"`,
        description: `This page includes ${detection.providerName} anti-bot challenge protection. Automated QA agents and synthetic test runners may encounter interactive CAPTCHA roadblocks. Developer staging test keys should be used in non-production environments to enable continuous testing.`,
        page: snapshot.url,
        selector: detection.selector,
        steps: [
          `Navigate to ${snapshot.url}`,
          `Inspect form submission pipeline for ${detection.providerName}`,
          'Check if automated test runners are blocked by CAPTCHA challenge',
        ],
        expected: 'Staging and preview environments should use official mock test keys to avoid blocking test automation.',
        actual: `${detection.providerName} protection is active.`,
        recommendation: `${detection.testKeysAdvice} ${detection.bypassGuidance}`,
        evidence: [
          {
            type: 'dom_snippet',
            description: 'Bot shield provider detection details',
            data: detection as unknown as Record<string, unknown>,
            timestamp: Date.now(),
          },
        ],
        retestCount: 0,
        timestamp: Date.now(),
      },
    ];
  }
}

export const botShieldDetector = new BotShieldDetector();
