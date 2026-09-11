import { NetworkFailureItem } from '../qa/network-tester';
import { HttpTransaction } from './injected-interceptor';
import { redactSensitiveText, createLogger } from '../shared/logger/logger';

const logger = createLogger('NetworkRecorder');

export class NetworkRecorder {
  private buffer: NetworkFailureItem[] = [];
  private transactions: HttpTransaction[] = [];
  private maxBufferSize: number = 60;
  private maxTransactionBufferSize: number = 100;
  private observer: PerformanceObserver | null = null;
  private isListening: boolean = false;
  private messageListener: ((event: MessageEvent) => void) | null = null;

  public start(): void {
    if (this.isListening) return;

    // 1. PerformanceObserver for low-level resource timing & 4xx/5xx failures
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.inspectResourceEntry(entry as PerformanceResourceTiming);
          }
        });

        this.observer.observe({ entryTypes: ['resource'] });
        logger.info('Network resource observer attached');
      } catch (e) {
        logger.warn('PerformanceObserver resource inspection not supported', e);
      }
    }

    // 2. Window message listener for rich in-page fetch/XHR payload interceptor
    if (typeof window !== 'undefined' && window.addEventListener) {
      this.messageListener = (event: MessageEvent) => {
        if (event.data && event.data.source === 'AI_QA_NETWORK_INTERCEPTOR' && event.data.transaction) {
          this.recordTransaction(event.data.transaction as HttpTransaction);
        }
      };
      window.addEventListener('message', this.messageListener);
      logger.info('Live API & data payload interceptor attached');
    }

    this.isListening = true;
  }

  public stop(): void {
    if (!this.isListening) return;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (typeof window !== 'undefined' && this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    this.isListening = false;
    logger.info('Network resource observer detached');
  }

  public recordTransaction(tx: HttpTransaction): void {
    this.transactions.push(tx);
    if (this.transactions.length > this.maxTransactionBufferSize) {
      this.transactions.shift();
    }

    // If HTTP error, record as failure item with rich payload info
    if (tx.status >= 400) {
      const errDetail = typeof tx.responsePayload === 'object'
        ? JSON.stringify(tx.responsePayload)
        : String(tx.responsePayload || tx.statusText);

      this.addFailure({
        url: redactSensitiveText(tx.url),
        method: tx.method as any,
        status: tx.status,
        statusText: `${tx.statusText}${errDetail ? ` (${errDetail.substring(0, 100)})` : ''}`,
        type: 'fetch',
        duration: tx.durationMs,
        timestamp: tx.timestamp,
      });
    }

    logger.debug(`Intercepted ${tx.method} ${tx.url} [${tx.status}] in ${tx.durationMs}ms`);
  }

  public inspectResourceEntry(entry: PerformanceResourceTiming): void {
    try {
      const status = (entry as unknown as { responseStatus?: number }).responseStatus || 0;
      const duration = Math.round(entry.duration);

      let type: NetworkFailureItem['type'] = 'other';
      const initiator = (entry.initiatorType || '').toLowerCase();
      if (initiator === 'script' || initiator === 'xmlhttprequest' || initiator === 'fetch' || initiator === 'stylesheet' || initiator === 'image') {
        type = initiator as NetworkFailureItem['type'];
      }

      if (status >= 400) {
        this.addFailure({
          url: redactSensitiveText(entry.name),
          method: 'GET',
          status,
          statusText: status >= 500 ? 'Server Error' : 'Not Found / Client Error',
          type,
          duration,
          timestamp: Date.now(),
        });
      } else if (duration > 10000) {
        this.addFailure({
          url: redactSensitiveText(entry.name),
          method: 'GET',
          status: 408,
          statusText: 'Resource Request Timeout (> 10s)',
          type,
          duration,
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      logger.error('Failed to inspect resource entry', e);
    }
  }

  public scanExistingPerformanceEntries(): void {
    if (typeof window !== 'undefined' && window.performance && typeof window.performance.getEntriesByType === 'function') {
      try {
        const entries = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        for (const entry of entries) {
          this.inspectResourceEntry(entry);
        }
      } catch (e) {
        logger.warn('Could not scan existing performance entries', e);
      }
    }
  }

  public addFailure(failure: NetworkFailureItem): void {
    const last = this.buffer[this.buffer.length - 1];
    if (last && last.url === failure.url && last.status === failure.status && Math.abs(failure.timestamp - last.timestamp) < 2000) {
      return;
    }

    this.buffer.push(failure);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  public getCapturedFailures(): NetworkFailureItem[] {
    if (this.buffer.length === 0) {
      this.scanExistingPerformanceEntries();
    }
    return [...this.buffer];
  }

  public clearCapturedFailures(): void {
    this.buffer = [];
  }

  public getCapturedTransactions(): HttpTransaction[] {
    return [...this.transactions];
  }

  public getRecentTransactions(sinceTimestamp: number = 0): HttpTransaction[] {
    return this.transactions.filter((t) => t.timestamp >= sinceTimestamp);
  }

  public hasSuccessfulMutation(sinceTimestamp: number = 0): boolean {
    return this.transactions.some(
      (t) => t.isMutation && t.timestamp >= sinceTimestamp && t.status >= 200 && t.status < 300
    );
  }

  public clearCapturedTransactions(): void {
    this.transactions = [];
  }
}

export const networkRecorder = new NetworkRecorder();
