import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsoleRecorder } from '../../src/content/console-recorder';
import { NetworkRecorder } from '../../src/content/network-recorder';

describe('RuntimeRecorders', () => {
  describe('ConsoleRecorder', () => {
    let recorder: ConsoleRecorder;

    beforeEach(() => {
      recorder = new ConsoleRecorder();
    });

    it('buffers errors with stack and location metadata', () => {
      recorder.addError({
        message: 'Uncaught TypeError: Cannot read properties of undefined',
        source: 'https://example.com/app.js',
        lineno: 42,
        colno: 15,
        stack: 'TypeError: Cannot read properties of undefined\n    at init (app.js:42:15)',
        timestamp: Date.now(),
      });

      const errors = recorder.getCapturedErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('TypeError');
      expect(errors[0].lineno).toBe(42);
      expect(errors[0].colno).toBe(15);
    });

    it('limits buffer capacity and clears errors', () => {
      for (let i = 0; i < 60; i++) {
        recorder.addError({
          message: `Error event number ${i}`,
          timestamp: Date.now() + i * 2000,
        });
      }

      const errors = recorder.getCapturedErrors();
      expect(errors.length).toBeLessThanOrEqual(50);

      recorder.clearCapturedErrors();
      expect(recorder.getCapturedErrors()).toHaveLength(0);
    });
  });

  describe('NetworkRecorder', () => {
    let recorder: NetworkRecorder;

    beforeEach(() => {
      recorder = new NetworkRecorder();
    });

    it('captures 4xx and 5xx resource failures and redacts sensitive query parameters', () => {
      const mockEntry = {
        name: 'https://example.com/api/user/checkout?token=secret12345&apiKey=abcde',
        entryType: 'resource',
        startTime: 100,
        duration: 250,
        initiatorType: 'fetch',
        responseStatus: 500,
      } as unknown as PerformanceResourceTiming;

      recorder.inspectResourceEntry(mockEntry);

      const failures = recorder.getCapturedFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0].status).toBe(500);
      expect(failures[0].type).toBe('fetch');
      expect(failures[0].url).not.toContain('secret12345');
      expect(failures[0].url).toContain('[REDACTED_SECRET]');
    });

    it('captures slow resource timeouts (> 10s)', () => {
      const timeoutEntry = {
        name: 'https://example.com/analytics.js',
        entryType: 'resource',
        startTime: 100,
        duration: 12500,
        initiatorType: 'script',
        responseStatus: 200,
      } as unknown as PerformanceResourceTiming;

      recorder.inspectResourceEntry(timeoutEntry);

      const failures = recorder.getCapturedFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0].status).toBe(408);
      expect(failures[0].statusText).toContain('Timeout');
      expect(failures[0].type).toBe('script');
    });

    it('ignores healthy, fast resources (HTTP 200 with normal latency)', () => {
      const healthyEntry = {
        name: 'https://example.com/logo.png',
        entryType: 'resource',
        startTime: 100,
        duration: 120,
        initiatorType: 'image',
        responseStatus: 200,
      } as unknown as PerformanceResourceTiming;

      recorder.inspectResourceEntry(healthyEntry);
      expect(recorder.getCapturedFailures()).toHaveLength(0);
    });
  });

  describe('InjectedInterceptor CSP Safety', () => {
    it('injectInterceptorIntoPage does not append script elements to DOM (adheres strictly to CSP)', async () => {
      const { injectInterceptorIntoPage } = await import('../../src/content/injected-interceptor');
      const appendChildSpy = vi.spyOn(document.head, 'appendChild');

      injectInterceptorIntoPage();

      expect(appendChildSpy).not.toHaveBeenCalled();
      const scripts = document.head.querySelectorAll('script');
      expect(scripts.length).toBe(0);
      expect((window as any).__AI_QA_INTERCEPTOR_ACTIVE__).toBe(true);
    });
  });
});
