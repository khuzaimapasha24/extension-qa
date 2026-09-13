import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityBoundaryTester } from '../../src/qa/security-boundary-tester';

describe('SecurityBoundaryTester', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('Security Probe Test');
  });

  describe('inspectXssReflection', () => {
    it('detects unescaped HTML element injection in the live DOM', () => {
      // Simulate an unescaped XSS vulnerability: element is inserted directly into DOM
      const injectedEl = doc.createElement('b');
      injectedEl.id = 'qa-xss-probe';
      injectedEl.textContent = 'qa_xss_probe';
      doc.body.appendChild(injectedEl);

      const result = SecurityBoundaryTester.inspectXssReflection(
        '<b id="qa-xss-probe">qa_xss_probe</b>',
        doc,
        'https://example.com/search',
        'sess_sec_1'
      );

      expect(result.vulnerable).toBe(true);
      expect(result.category).toBe('XSS_INJECTION');
      expect(result.finding).toBeDefined();
      expect(result.finding?.severity).toBe('CRITICAL');
      expect(result.finding?.title).toContain('Unescaped HTML/XSS Markup');
    });

    it('confirms safe sanitization when markup is escaped as plain text', () => {
      // Simulate a safe implementation where the browser escapes tags into text nodes
      const textNode = doc.createTextNode('<b id="qa-xss-probe">qa_xss_probe</b>');
      doc.body.appendChild(textNode);

      const result = SecurityBoundaryTester.inspectXssReflection(
        '<b id="qa-xss-probe">qa_xss_probe</b>',
        doc,
        'https://example.com/search',
        'sess_sec_1'
      );

      expect(result.vulnerable).toBe(false);
      expect(result.finding).toBeUndefined();
    });
  });

  describe('inspectSqlErrorLeakage', () => {
    it('detects internal SQL syntax errors leaked in API response body', () => {
      const leakyResponse = JSON.stringify({
        status: 'error',
        message: 'Database query failed: syntax error in query near "WHERE id = 1\'" at line 1',
      });

      const result = SecurityBoundaryTester.inspectSqlErrorLeakage(
        leakyResponse,
        'https://example.com/api/users',
        'sess_sec_1'
      );

      expect(result.vulnerable).toBe(true);
      expect(result.category).toBe('SQLI_LEAKAGE');
      expect(result.finding).toBeDefined();
      expect(result.finding?.severity).toBe('HIGH');
      expect(result.finding?.title).toContain('Database Syntax Error Information Disclosure');
    });

    it('returns not vulnerable when API returns sanitized error message', () => {
      const cleanResponse = JSON.stringify({
        error: 'Invalid query parameters provided.',
        code: 400,
      });

      const result = SecurityBoundaryTester.inspectSqlErrorLeakage(
        cleanResponse,
        'https://example.com/api/users',
        'sess_sec_1'
      );

      expect(result.vulnerable).toBe(false);
      expect(result.finding).toBeUndefined();
    });
  });

  describe('getSecurityPayloads', () => {
    it('returns a set of non-destructive boundary fuzzing payloads', () => {
      const payloads = SecurityBoundaryTester.getSecurityPayloads();

      expect(payloads.length).toBeGreaterThanOrEqual(4);
      expect(payloads.some((p) => p.category === 'XSS_INJECTION')).toBe(true);
      expect(payloads.some((p) => p.category === 'SQLI_LEAKAGE')).toBe(true);
      expect(payloads.some((p) => p.category === 'BUFFER_OVERFLOW')).toBe(true);
    });
  });
});
