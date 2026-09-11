import { describe, it, expect } from 'vitest';
import { redactor } from '../../src/shared/security/redactor';

describe('SecurityRedactor', () => {
  it('masks Visa, MasterCard, and Amex credit card numbers while preserving last 4 digits', () => {
    const textWithVisa = 'Payment received for card 4111 2222 3333 4567 in checkout.';
    const sanitizedVisa = redactor.redactText(textWithVisa);
    expect(sanitizedVisa).toContain('[REDACTED_CARD: ****-4567]');
    expect(sanitizedVisa).not.toContain('4111');

    const textWithMasterCard = 'Processing card 5500-1234-5678-9999 for subscription.';
    const sanitizedMC = redactor.redactText(textWithMasterCard);
    expect(sanitizedMC).toContain('[REDACTED_CARD: ****-9999]');

    const textWithAmex = 'Amex charged: 378282246310005 successfully.';
    const sanitizedAmex = redactor.redactText(textWithAmex);
    expect(sanitizedAmex).toContain('[REDACTED_CARD: ****-0005]');
  });

  it('preserves non-card numbers such as years, zip codes, and short IDs', () => {
    const safeText = 'Order #1234 created in year 2026 for zip code 94016.';
    expect(redactor.redactText(safeText)).toBe(safeText);
  });

  it('masks Social Security Numbers (SSN)', () => {
    const textWithSSN = 'Tax record identification: 001-23-4567 matches profile.';
    const sanitized = redactor.redactText(textWithSSN);
    expect(sanitized).toContain('[REDACTED_SSN]');
    expect(sanitized).not.toContain('001-23-4567');
  });

  it('masks OpenAI, GitHub, AWS, and Bearer authorization tokens', () => {
    const credentials = `
      OpenAI: sk-proj-abcdef1234567890abcdef123456
      Legacy: sk-12345678901234567890abcdef
      GitHub: ghp_1234567890abcdef1234567890abcdef1234
      AWS: AKIAIOSFODNN7EXAMPLE
      Auth: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0
    `;

    const sanitized = redactor.redactText(credentials);

    expect(sanitized).toContain('[REDACTED_OPENAI_KEY]');
    expect(sanitized).toContain('[REDACTED_GITHUB_TOKEN]');
    expect(sanitized).toContain('[REDACTED_AWS_KEY]');
    expect(sanitized).toContain('Bearer [REDACTED_TOKEN]');

    expect(sanitized).not.toContain('sk-proj-');
    expect(sanitized).not.toContain('ghp_');
    expect(sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('redacts sensitive query parameters from URLs', () => {
    const url = 'https://api.example.com/v1/auth?token=sec_9999&user=alice&apiKey=secretKey123&debug=true';
    const sanitized = redactor.redactUrlParams(url);

    expect(sanitized).toContain('token=[REDACTED_SECRET]');
    expect(sanitized).toContain('apiKey=[REDACTED_SECRET]');
    expect(sanitized).toContain('user=alice');
    expect(sanitized).toContain('debug=true');
    expect(sanitized).not.toContain('sec_9999');
    expect(sanitized).not.toContain('secretKey123');
  });

  it('deeply sanitizes complex nested objects and masks confidential keys', () => {
    const nestedData = {
      user: {
        name: 'Jane Doe',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOi...',
        cards: [
          {
            type: 'VISA',
            number: '4111 2222 3333 1111',
          },
        ],
      },
      metadata: {
        note: 'Call customer with SSN 123-45-6789 for verification',
      },
    };

    const sanitized = redactor.redactDeep(nestedData);

    expect(sanitized.user.name).toBe('Jane Doe');
    expect(sanitized.user.password).toBe('[REDACTED_CONFIDENTIAL]');
    expect(sanitized.user.token).toBe('[REDACTED_CONFIDENTIAL]');
    expect(sanitized.user.cards[0].number).toContain('[REDACTED_CARD: ****-1111]');
    expect(sanitized.metadata.note).toContain('[REDACTED_SSN]');
  });

  it('handles circular references in redactDeep safely without throwing stack overflow', () => {
    const circular: any = { name: 'circular-test' };
    circular.self = circular;

    expect(() => redactor.redactDeep(circular)).not.toThrow();
    const res = redactor.redactDeep(circular);
    expect(res.name).toBe('circular-test');
    expect(res.self).toBe('[Circular]');
  });
});
