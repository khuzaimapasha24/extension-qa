import { describe, it, expect } from 'vitest';
import { testButtons } from '../../src/qa/button-tester';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('ButtonTester', () => {
  const baseSnapshot: PageSnapshot = {
    url: 'https://example.com/',
    origin: 'https://example.com',
    pathname: '/',
    title: 'Example',
    metadata: {
      title: 'Example',
      h1Count: 1,
      h1Texts: ['Heading'],
      headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    },
    links: [],
    buttons: [],
    forms: [],
    images: [],
    navigations: [],
    totalInteractiveCount: 0,
    timestamp: Date.now(),
  };

  it('detects buttons missing accessible text labels', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      buttons: [
        {
          text: '',
          selector: 'button#icon-only',
          type: 'button',
          riskLevel: 'LOW',
          isDisabled: false,
          isVisible: true,
        },
      ],
    };

    const findings = testButtons(snapshot, 'session_1');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Button missing accessible text label');
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].status).toBe('FAIL');
  });

  it('detects high-risk action buttons and marks them for review', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      buttons: [
        {
          text: 'Complete Order & Pay Now',
          selector: 'button#checkout',
          type: 'submit',
          riskLevel: 'HIGH',
          isDisabled: false,
          isVisible: true,
        },
      ],
    };

    const findings = testButtons(snapshot, 'session_1');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('High-risk action button detected');
    expect(findings[0].status).toBe('NEEDS_REVIEW');
    expect(findings[0].severity).toBe('INFO');
  });

  it('allows properly labeled, normal-risk buttons', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      buttons: [
        {
          text: 'Next Page',
          selector: 'button#next',
          type: 'button',
          riskLevel: 'LOW',
          isDisabled: false,
          isVisible: true,
        },
        {
          text: '',
          ariaLabel: 'Close modal dialog',
          selector: 'button#close',
          type: 'button',
          riskLevel: 'LOW',
          isDisabled: false,
          isVisible: true,
        },
      ],
    };

    const findings = testButtons(snapshot, 'session_1');
    expect(findings).toHaveLength(0);
  });
});
