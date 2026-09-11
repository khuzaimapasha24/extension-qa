import { createLogger } from '../shared/logger/logger';

const logger = createLogger('VirtualMailbox');

export interface VirtualMailMessage {
  id: number;
  from: string;
  subject: string;
  date: string;
  body?: string;
  textBody?: string;
  htmlBody?: string;
}

export interface VerificationExtractionResult {
  email: string;
  otpCode?: string;
  verificationLink?: string;
  subject?: string;
  receivedAt: number;
}

export class VirtualMailboxEngine {
  private readonly domains = ['1secmail.com', '1secmail.net', '1secmail.org'];
  private readonly baseUrl = 'https://www.1secmail.com/api/v1/';

  /**
   * Generates a disposable temporary email address for registration/signup QA.
   */
  public generateDisposableEmail(prefix = 'qa_agent'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    const domain = this.domains[Math.floor(Math.random() * this.domains.length)];
    const username = `${prefix}_${timestamp}_${random}`;
    return `${username}@${domain}`;
  }

  /**
   * Extracts OTP codes (4-8 digits) from subject or body text.
   */
  public extractOtp(text: string): string | undefined {
    if (!text) return undefined;

    // High confidence patterns: "code is 123456", "OTP: 123456", "verification code: 1234"
    const patternSpecific = /(?:code|otp|pin|token|verification|verify)[\s:=]+([0-9]{4,8})\b/i;
    const matchSpecific = text.match(patternSpecific);
    if (matchSpecific && matchSpecific[1]) {
      return matchSpecific[1];
    }

    // General 4 to 8 digit standalone numbers (avoiding years like 2024-2026)
    const matchGeneral = text.match(/\b([0-9]{4,8})\b/);
    if (matchGeneral && matchGeneral[1]) {
      const val = parseInt(matchGeneral[1], 10);
      if (val < 2020 || val > 2030) {
        return matchGeneral[1];
      }
    }

    return undefined;
  }

  /**
   * Extracts confirmation or activation URLs from message content.
   */
  public extractVerificationLink(text: string): string | undefined {
    if (!text) return undefined;
    const urlPattern = /https?:\/\/[^\s"'<>]+(?:verify|confirm|activate|token|register|validation)[^\s"'<>]*/i;
    const match = text.match(urlPattern);
    return match ? match[0] : undefined;
  }

  /**
   * Fetches message list for the generated disposable email address.
   */
  public async getMessages(email: string): Promise<VirtualMailMessage[]> {
    const [login, domain] = email.split('@');
    if (!login || !domain) return [];

    try {
      const url = `${this.baseUrl}?action=getMessages&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const list = (await res.json()) as VirtualMailMessage[];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      logger.warn(`Could not fetch messages for ${email}:`, err);
      return [];
    }
  }

  /**
   * Reads the full body of a specific message ID.
   */
  public async readMessage(email: string, messageId: number): Promise<VirtualMailMessage | null> {
    const [login, domain] = email.split('@');
    if (!login || !domain) return null;

    try {
      const url = `${this.baseUrl}?action=readMessage&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}&id=${messageId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return (await res.json()) as VirtualMailMessage;
    } catch (err) {
      logger.warn(`Could not read message ${messageId} for ${email}:`, err);
      return null;
    }
  }

  /**
   * Actively polls disposable inbox until verification email arrives or timeout occurs.
   */
  public async pollForVerificationEmail(
    email: string,
    options: { timeoutMs?: number; intervalMs?: number } = {}
  ): Promise<VerificationExtractionResult | null> {
    const { timeoutMs = 15000, intervalMs = 2000 } = options;
    const startTime = Date.now();

    logger.info(`Polling virtual mailbox for ${email} (timeout: ${timeoutMs}ms)...`);

    while (Date.now() - startTime < timeoutMs) {
      const messages = await this.getMessages(email);
      if (messages.length > 0) {
        const latest = messages[0];
        const fullMsg = await this.readMessage(email, latest.id);
        const combinedText = `${latest.subject} ${fullMsg?.body || ''} ${fullMsg?.textBody || ''} ${fullMsg?.htmlBody || ''}`;

        const otpCode = this.extractOtp(combinedText);
        const verificationLink = this.extractVerificationLink(combinedText);

        logger.info(`Verification email detected for ${email}! OTP: ${otpCode || 'none'}, Link: ${verificationLink ? 'yes' : 'no'}`);
        return {
          email,
          otpCode,
          verificationLink,
          subject: latest.subject,
          receivedAt: Date.now(),
        };
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    logger.warn(`Polling timed out for virtual mailbox ${email}`);
    return null;
  }
}

export const virtualMailbox = new VirtualMailboxEngine();
