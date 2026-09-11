import { Finding } from '../shared/types/qa';

export interface ConsoleErrorItem {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  timestamp: number;
}

export function testConsoleErrors(errors: ConsoleErrorItem[], pathname: string, sessionId: string): Finding[] {
  const findings: Finding[] = [];

  for (const err of errors) {
    const isCritical = /syntaxerror|referenceerror|fatal|crash/i.test(err.message);
    const severity = isCritical ? 'CRITICAL' : 'HIGH';

    findings.push({
      id: `console_err_${findings.length + 1}_${Date.now()}`,
      sessionId,
      category: 'CONSOLE',
      title: `Uncaught JavaScript runtime error: ${err.message.slice(0, 60)}...`,
      description: err.message,
      status: 'FAIL',
      severity,
      confidence: 1.0,
      page: pathname,
      evidence: [{
        type: 'console_error',
        description: 'Captured browser console error',
        data: {
          message: err.message,
          stack: err.stack,
          source: err.source,
          lineno: err.lineno,
        },
        timestamp: err.timestamp,
      }],
      steps: ['Observe browser runtime console', 'Intercept uncaught exception in window.onerror'],
      expected: 'Page should execute without unhandled runtime exceptions or script crashes.',
      actual: err.message,
      recommendation: 'Inspect error stack trace and wrap risky operations in try-catch or resolve undefined variables.',
      retestCount: 0,
      timestamp: Date.now(),
    });
  }

  return findings;
}
