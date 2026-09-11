import { Finding } from '../shared/types/qa';
import { redactSensitiveText } from '../shared/logger/logger';

export interface NetworkFailureItem {
  url: string;
  method: string;
  status: number;
  statusText?: string;
  type: 'script' | 'stylesheet' | 'image' | 'font' | 'fetch' | 'xhr' | 'other';
  duration?: number;
  timestamp: number;
}

export function testNetworkFailures(failures: NetworkFailureItem[], pathname: string, sessionId: string): Finding[] {
  const findings: Finding[] = [];

  for (const failure of failures) {
    const cleanUrl = redactSensitiveText(failure.url);
    const is5xx = failure.status >= 500;
    const is404 = failure.status === 404;

    const severity = is5xx ? 'CRITICAL' : is404 && (failure.type === 'script' || failure.type === 'stylesheet') ? 'HIGH' : 'MEDIUM';

    findings.push({
      id: `net_fail_${findings.length + 1}_${Date.now()}`,
      sessionId,
      category: 'NETWORK',
      title: `HTTP ${failure.status} resource failure: ${failure.type} (${cleanUrl.slice(0, 50)}...)`,
      description: `Failed to load ${failure.type} asset from ${cleanUrl}. Server responded with status ${failure.status} ${failure.statusText || ''}.`,
      status: 'FAIL',
      severity,
      confidence: 1.0,
      page: pathname,
      evidence: [{
        type: 'network_error',
        description: 'Captured failed network request',
        data: {
          url: cleanUrl,
          status: failure.status,
          method: failure.method,
          type: failure.type,
        },
        timestamp: failure.timestamp,
      }],
      steps: [`Request resource via ${failure.method} ${cleanUrl}`, `Observe HTTP response status ${failure.status}`],
      expected: 'All required web assets and API endpoints should return HTTP 200 or cached responses.',
      actual: `HTTP ${failure.status} error encountered.`,
      recommendation: `Verify server route or asset hosting path for ${cleanUrl}.`,
      retestCount: 0,
      timestamp: Date.now(),
    });
  }

  return findings;
}
