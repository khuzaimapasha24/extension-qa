import { Finding } from '../shared/types/qa';

export interface SecurityProbeResult {
  vulnerable: boolean;
  category: 'XSS_INJECTION' | 'SQLI_LEAKAGE' | 'BUFFER_OVERFLOW' | 'DATA_EXPOSURE';
  payloadUsed: string;
  evidence: string;
  finding?: Finding;
}

export interface SecurityPayload {
  name: string;
  category: 'XSS_INJECTION' | 'SQLI_LEAKAGE' | 'BUFFER_OVERFLOW';
  payload: string;
  description: string;
}

/**
 * Security Boundary & Injection Vulnerability Tester.
 * Tests form fields and API endpoints against injection vulnerabilities, SQL leakage,
 * and unescaped script reflection in the DOM.
 */
export class SecurityBoundaryTester {
  /**
   * Curated, non-destructive security probe payloads for automated boundary fuzzing.
   */
  public static getSecurityPayloads(): SecurityPayload[] {
    return [
      {
        name: 'XSS Canary Tag Injection',
        category: 'XSS_INJECTION',
        payload: '<b id="qa-xss-probe">qa_xss_probe</b>',
        description: 'Verifies whether HTML markup is escaped before rendering in the DOM.',
      },
      {
        name: 'XSS Attribute Escape Probe',
        category: 'XSS_INJECTION',
        payload: '"><b id="qa-attr-probe">xss</b>',
        description: 'Tests if attributes are properly quoted and sanitized against breakout.',
      },
      {
        name: 'SQL Syntax Disruption Canary',
        category: 'SQLI_LEAKAGE',
        payload: "test' OR '1'='1",
        description: 'Tests if backend database queries fail safely or leak internal SQL exceptions.',
      },
      {
        name: 'SQL Comment Disruption',
        category: 'SQLI_LEAKAGE',
        payload: "admin'--",
        description: 'Checks for SQL comment injection handling.',
      },
      {
        name: 'Buffer Overflow Repeat Pattern',
        category: 'BUFFER_OVERFLOW',
        payload: 'A'.repeat(2500),
        description: 'Tests whether excessive string length triggers unhandled server crashes (HTTP 500).',
      },
    ];
  }

  /**
   * Inspects rendered DOM to determine whether an injected HTML/XSS payload was rendered unescaped.
   */
  public static inspectXssReflection(
    payload: string,
    doc: Document,
    pageUrl: string,
    sessionId: string
  ): SecurityProbeResult {
    // If our injected probe element actually exists as a live DOM node, markup was unescaped!
    const probe = doc.querySelector('#qa-xss-probe, #qa-attr-probe');

    if (probe) {
      const finding: Finding = {
        id: `finding_sec_xss_${sessionId}_${Date.now()}`,
        sessionId,
        page: pageUrl,
        category: 'SECURITY',
        severity: 'CRITICAL',
        status: 'FAIL',
        confidence: 0.99,
        title: '[Security Vulnerability] Unescaped HTML/XSS Markup Rendered in DOM',
        description: `Cross-Site Scripting (XSS) vulnerability detected. An injected payload was parsed and inserted directly into the live DOM without sanitization. Element id: "${probe.id}".`,
        steps: [
          `Navigate to ${pageUrl}`,
          `Input test security canary string: "${payload}"`,
          'Inspect rendered DOM tree for unescaped element node',
        ],
        expected: 'User input must be strictly HTML-escaped or rendered through text nodes (e.g. textContent).',
        actual: `Injected payload rendered as raw HTML element: <${probe.tagName.toLowerCase()} id="${probe.id}">`,
        recommendation: 'Use automatic context-aware escaping, sanitize with DOMPurify, or avoid dangerous innerHTML bindings.',
        evidence: [
          {
            type: 'dom_snapshot',
            description: 'Unescaped DOM node rendered by injection payload',
            data: { payload, renderedTag: probe.outerHTML },
            timestamp: Date.now(),
          },
        ],
        retestCount: 0,
        timestamp: Date.now(),
      };

      return {
        vulnerable: true,
        category: 'XSS_INJECTION',
        payloadUsed: payload,
        evidence: probe.outerHTML,
        finding,
      };
    }

    return {
      vulnerable: false,
      category: 'XSS_INJECTION',
      payloadUsed: payload,
      evidence: 'Payload was properly sanitized or escaped.',
    };
  }

  /**
   * Inspects HTTP API response bodies for database syntax leaks or internal stack traces.
   */
  public static inspectSqlErrorLeakage(
    responseBody: string,
    endpointUrl: string,
    sessionId: string
  ): SecurityProbeResult {
    if (!responseBody || typeof responseBody !== 'string') {
      return {
        vulnerable: false,
        category: 'SQLI_LEAKAGE',
        payloadUsed: '',
        evidence: 'Empty response body',
      };
    }

    const sqlErrorPatterns = [
      /syntax error in query/i,
      /unclosed quotation mark after the character string/i,
      /SQLSTATE\[/i,
      /PostgreSQL query failed/i,
      /ORA-\d{5}/i,
      /sqlite3\.OperationalError/i,
      /MySqlException/i,
      /SequelizeDatabaseError/i,
      /django\.db\.utils\.(?:OperationalError|ProgrammingError)/i,
    ];

    for (const pattern of sqlErrorPatterns) {
      const match = responseBody.match(pattern);
      if (match) {
        const snippet = responseBody.substring(Math.max(0, match.index! - 50), match.index! + 100);

        const finding: Finding = {
          id: `finding_sec_sqli_leak_${sessionId}_${Date.now()}`,
          sessionId,
          page: endpointUrl,
          category: 'SECURITY',
          severity: 'HIGH',
          status: 'FAIL',
          confidence: 0.98,
          title: '[Security Vulnerability] Database Syntax Error Information Disclosure',
          description: `Backend API endpoint leaked internal database engine details and syntax error traces: "${match[0]}". This exposes database architecture to potential SQL injection attacks.`,
          steps: [
            `Submit quotation disruption payload to ${endpointUrl}`,
            'Inspect raw HTTP response body for database error messages',
          ],
          expected: 'Backend must handle errors gracefully and return generic error responses without exposing database errors.',
          actual: `Internal SQL error leaked in HTTP response: "${snippet}"`,
          recommendation: 'Disable verbose database error disclosures in production and use parameterized SQL queries/ORMs.',
          evidence: [
            {
              type: 'network',
              description: 'Leaked database error snippet',
              data: { endpoint: endpointUrl, snippet },
              timestamp: Date.now(),
            },
          ],
          retestCount: 0,
          timestamp: Date.now(),
        };

        return {
          vulnerable: true,
          category: 'SQLI_LEAKAGE',
          payloadUsed: "test' OR '1'='1",
          evidence: snippet,
          finding,
        };
      }
    }

    return {
      vulnerable: false,
      category: 'SQLI_LEAKAGE',
      payloadUsed: '',
      evidence: 'No database errors disclosed in response body.',
    };
  }
}
