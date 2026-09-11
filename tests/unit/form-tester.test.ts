import { describe, it, expect } from 'vitest';
import { testForms } from '../../src/qa/form-tester';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('FormTester', () => {
  const baseSnapshot: PageSnapshot = {
    url: 'https://example.com/form',
    origin: 'https://example.com',
    pathname: '/form',
    title: 'Form Page',
    metadata: {
      title: 'Form Page',
      h1Count: 1,
      h1Texts: ['Form'],
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

  it('detects forms missing a dedicated submit button', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      forms: [
        {
          action: '/submit',
          method: 'POST',
          selector: 'form#contact',
          riskLevel: 'LOW',
          fields: [
            {
              name: 'email',
              type: 'email',
              selector: 'input#email',
              label: 'Email Address',
              required: true,
            },
          ],
        },
      ],
    };

    const findings = testForms(snapshot, 'session_1');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Form missing dedicated submit button');
    expect(findings[0].severity).toBe('MEDIUM');
    expect(findings[0].status).toBe('WARNING');
  });

  it('detects unlabeled form fields', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      forms: [
        {
          action: '/search',
          method: 'GET',
          selector: 'form#search',
          submitButtonSelector: 'button#submit',
          riskLevel: 'LOW',
          fields: [
            {
              name: 'q',
              type: 'text',
              selector: 'input#q',
              required: false,
            },
          ],
        },
      ],
    };

    const findings = testForms(snapshot, 'session_1');
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain('missing accessible label');
    expect(findings[0].category).toBe('ACCESSIBILITY');
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].status).toBe('FAIL');
  });

  it('passes properly structured forms with submit buttons and labels', () => {
    const snapshot: PageSnapshot = {
      ...baseSnapshot,
      forms: [
        {
          action: '/login',
          method: 'POST',
          selector: 'form#login',
          submitButtonSelector: 'button[type="submit"]',
          riskLevel: 'LOW',
          fields: [
            {
              name: 'username',
              type: 'text',
              selector: 'input#user',
              label: 'Username',
              required: true,
            },
            {
              name: 'password',
              type: 'password',
              selector: 'input#pass',
              placeholder: 'Enter password',
              required: true,
            },
          ],
        },
      ],
    };

    const findings = testForms(snapshot, 'session_1');
    expect(findings).toHaveLength(0);
  });
});
