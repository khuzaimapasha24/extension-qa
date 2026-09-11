import { ConsoleErrorItem } from '../qa/console-tester';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('ConsoleRecorder');

export class ConsoleRecorder {
  private buffer: ConsoleErrorItem[] = [];
  private maxBufferSize: number = 50;
  private isListening: boolean = false;

  private errorHandler = (event: ErrorEvent) => {
    try {
      const message = event.message || (event.error && event.error.message) || 'Unknown runtime error';
      const stack = event.error && event.error.stack ? String(event.error.stack) : undefined;
      const source = event.filename || undefined;
      const lineno = event.lineno || undefined;
      const colno = event.colno || undefined;

      this.addError({
        message,
        source,
        lineno,
        colno,
        stack,
        timestamp: Date.now(),
      });
    } catch (e) {
      logger.error('Failed to capture window error event', e);
    }
  };

  private rejectionHandler = (event: PromiseRejectionEvent) => {
    try {
      const reason = event.reason;
      let message = 'Unhandled Promise Rejection';
      let stack: string | undefined;

      if (reason instanceof Error) {
        message = `Unhandled Rejection: ${reason.message}`;
        stack = reason.stack;
      } else if (typeof reason === 'string') {
        message = `Unhandled Rejection: ${reason}`;
      } else if (reason && typeof reason === 'object') {
        message = `Unhandled Rejection: ${JSON.stringify(reason)}`;
      }

      this.addError({
        message,
        stack,
        timestamp: Date.now(),
      });
    } catch (e) {
      logger.error('Failed to capture rejection event', e);
    }
  };

  public start(): void {
    if (this.isListening) return;

    if (typeof window !== 'undefined') {
      window.addEventListener('error', this.errorHandler);
      window.addEventListener('unhandledrejection', this.rejectionHandler);
      this.isListening = true;
      logger.info('Console recorder attached');
    }
  }

  public stop(): void {
    if (!this.isListening) return;

    if (typeof window !== 'undefined') {
      window.removeEventListener('error', this.errorHandler);
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.isListening = false;
      logger.info('Console recorder detached');
    }
  }

  public addError(error: ConsoleErrorItem): void {
    // Avoid spamming exact identical messages within 1 second
    const last = this.buffer[this.buffer.length - 1];
    if (last && last.message === error.message && Math.abs(error.timestamp - last.timestamp) < 1000) {
      return;
    }

    this.buffer.push(error);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  public getCapturedErrors(): ConsoleErrorItem[] {
    return [...this.buffer];
  }

  public clearCapturedErrors(): void {
    this.buffer = [];
  }
}

export const consoleRecorder = new ConsoleRecorder();
