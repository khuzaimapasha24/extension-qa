/**
 * Comprehensive Security & PII Redactor for AI Website QA Agent.
 * Ensures zero leakage of credentials, tokens, credit cards, SSNs, or sensitive parameters.
 */

// Regex patterns for sensitive identifiers
export const CREDIT_CARD_REGEX =
  /\b(?:\d{4}[ -]?){3}\d{4}\b|\b3[47]\d{2}[ -]?\d{6}[ -]?\d{5}\b/g;

export const SSN_REGEX =
  /\b(?!000|666|9\d{2})\d{3}[ -]?(?!00)\d{2}[ -]?(?!0000)\d{4}\b/g;

export const OPENAI_API_KEY_REGEX =
  /\b(?:sk-proj-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9]{10,})\b/g;

export const GEMINI_API_KEY_REGEX =
  /\bAIza[0-9A-Za-z-_]{35}\b|\bAQ\.[A-Za-z0-9_-]{30,}\b/g;

export const ANTHROPIC_API_KEY_REGEX =
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g;

export const GITHUB_TOKEN_REGEX =
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{82}\b/g;

export const AWS_KEY_REGEX = /\b(?:AKIA|ASIA|AROA)[A-Z0-9]{16}\b/g;

export const BEARER_TOKEN_REGEX =
  /\bBearer\s+[A-Za-z0-9_\-.~+/=]+\b/gi;

export const SENSITIVE_PARAM_NAMES = [
  'password',
  'passwd',
  'pass',
  'pwd',
  'token',
  'auth',
  'authorization',
  'apikey',
  'api_key',
  'geminiapikey',
  'gemini_api_key',
  'openaiapikey',
  'openai_api_key',
  'anthropicapikey',
  'anthropic_api_key',
  'secret',
  'client_secret',
  'access_token',
  'refresh_token',
  'cvv',
  'cvc',
  'ssn',
];

export class SecurityRedactor {
  /**
   * Sanitizes plain text by scanning and replacing all known credential, card, and token patterns.
   */
  public redactText(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let sanitized = text;

    // 1. Credit Card Numbers (Mask all but last 4 digits)
    sanitized = sanitized.replace(CREDIT_CARD_REGEX, (match) => {
      const digitsOnly = match.replace(/\D/g, '');
      if (digitsOnly.length < 13 || digitsOnly.length > 19) return match;
      const last4 = digitsOnly.slice(-4);
      return `[REDACTED_CARD: ****-${last4}]`;
    });

    // 2. Social Security Numbers
    sanitized = sanitized.replace(SSN_REGEX, '[REDACTED_SSN]');

    // 3. Known API Keys & Cloud Secrets
    sanitized = sanitized.replace(OPENAI_API_KEY_REGEX, '[REDACTED_OPENAI_KEY]');
    sanitized = sanitized.replace(GEMINI_API_KEY_REGEX, '[REDACTED_GEMINI_KEY]');
    sanitized = sanitized.replace(ANTHROPIC_API_KEY_REGEX, '[REDACTED_ANTHROPIC_KEY]');
    sanitized = sanitized.replace(GITHUB_TOKEN_REGEX, '[REDACTED_GITHUB_TOKEN]');
    sanitized = sanitized.replace(AWS_KEY_REGEX, '[REDACTED_AWS_KEY]');
    sanitized = sanitized.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]');

    // 4. URL query parameters with sensitive names
    sanitized = this.redactUrlParams(sanitized);

    return sanitized;
  }

  /**
   * Redacts sensitive key=value pairs within URLs or query strings.
   */
  public redactUrlParams(urlOrText: string): string {
    if (!urlOrText || typeof urlOrText !== 'string') return urlOrText;

    let result = urlOrText;
    for (const param of SENSITIVE_PARAM_NAMES) {
      // Matches ?param=value or &param=value or whitespace param=value in text/queries
      const regex = new RegExp(`([?&\\s]|^)(${param}=)([^&\\s"'>]+)`, 'gi');
      result = result.replace(regex, '$1$2[REDACTED_SECRET]');
    }
    return result;
  }

  /**
   * Recursively sanitizes nested objects, arrays, and primitives.
   * Also masks values for keys matching sensitive words (e.g. password, secret).
   */
  public redactDeep<T>(data: T, seen = new WeakSet()): T {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
      return this.redactText(data) as unknown as T;
    }

    if (typeof data !== 'object') {
      return data;
    }

    // Circular reference guard
    if (seen.has(data as object)) {
      return '[Circular]' as unknown as T;
    }
    seen.add(data as object);

    if (data instanceof Error) {
      const sanitizedErr: Record<string, unknown> = {
        name: data.name,
        message: this.redactText(data.message),
      };
      if (data.stack) {
        sanitizedErr.stack = this.redactText(data.stack);
      }
      return sanitizedErr as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.redactDeep(item, seen)) as unknown as T;
    }

    const output: Record<string, unknown> = {};
    const entries = Object.entries(data as Record<string, unknown>);

    for (const [key, value] of entries) {
      const lowerKey = key.toLowerCase();
      const isSensitiveKey = SENSITIVE_PARAM_NAMES.some(
        (name) => lowerKey === name || lowerKey.includes(name)
      );

      if (isSensitiveKey) {
        output[key] = '[REDACTED_CONFIDENTIAL]';
      } else {
        output[key] = this.redactDeep(value, seen);
      }
    }

    return output as T;
  }
}

export const redactor = new SecurityRedactor();
