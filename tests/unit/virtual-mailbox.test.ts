import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { virtualMailbox } from '../../src/agent/virtual-mailbox';

describe('VirtualMailboxEngine', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('generates a valid disposable email address', () => {
    const email = virtualMailbox.generateDisposableEmail('qa_test');
    expect(email).toMatch(/^qa_test_[a-z0-9]+_[a-z0-9]+@(1secmail\.com|1secmail\.net|1secmail\.org)$/);
  });

  it('extracts OTP codes from message text', () => {
    expect(virtualMailbox.extractOtp('Your login OTP code is: 582910. Do not share it.')).toBe('582910');
    expect(virtualMailbox.extractOtp('Security code: 8492')).toBe('8492');
    expect(virtualMailbox.extractOtp('Verify your account with token: 19482019')).toBe('19482019');
    expect(virtualMailbox.extractOtp('Welcome to our service in 2025!')).toBeUndefined();
  });

  it('extracts confirmation and activation links from message text', () => {
    const text = 'Please click here to verify your account: https://app.example.com/api/confirm?token=abc123xyz Thank you.';
    const link = virtualMailbox.extractVerificationLink(text);
    expect(link).toBe('https://app.example.com/api/confirm?token=abc123xyz');
  });

  it('polls mailbox and extracts OTP code when message arrives', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('action=getMessages')) {
        callCount++;
        if (callCount < 2) {
          return { ok: true, json: async () => [] };
        }
        return {
          ok: true,
          json: async () => [
            { id: 101, from: 'auth@example.com', subject: 'Your Verification Code: 492019', date: '2026-09-10' },
          ],
        };
      }
      if (url.includes('action=readMessage')) {
        return {
          ok: true,
          json: async () => ({
            id: 101,
            from: 'auth@example.com',
            subject: 'Your Verification Code: 492019',
            body: 'Hello, your OTP is 492019. Activate at https://app.example.com/activate?token=999',
          }),
        };
      }
      return { ok: false };
    }) as any;

    const result = await virtualMailbox.pollForVerificationEmail('qa_bot_1@1secmail.com', {
      timeoutMs: 1000,
      intervalMs: 10,
    });

    expect(result).not.toBeNull();
    expect(result?.otpCode).toBe('492019');
    expect(result?.verificationLink).toBe('https://app.example.com/activate?token=999');
  });

  it('returns null gracefully when mailbox polling times out', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as any;

    const result = await virtualMailbox.pollForVerificationEmail('timeout_user@1secmail.com', {
      timeoutMs: 50,
      intervalMs: 10,
    });

    expect(result).toBeNull();
  });
});
