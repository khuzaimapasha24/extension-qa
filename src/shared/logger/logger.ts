import { redactor } from '../security/redactor';

export function redactSensitiveText(input: string): string {
  return redactor.redactText(input);
}

export function redactObject<T>(obj: T): T {
  return redactor.redactDeep(obj);
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: number;
  module: string;
  level: LogLevel;
  message: string;
  details?: unknown;
}

class Logger {
  private moduleName: string;
  private logs: LogEntry[] = [];
  private maxLogs = 500;

  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }

  private log(level: LogLevel, message: string, details?: unknown) {
    const safeMessage = redactSensitiveText(message);
    const safeDetails = details !== undefined ? redactObject(details) : undefined;
    const entry: LogEntry = {
      timestamp: Date.now(),
      module: this.moduleName,
      level,
      message: safeMessage,
      details: safeDetails,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    const prefix = `[QA-${this.moduleName}]`;
    const formatDetail = (d: unknown) => {
      if (d === undefined || d === null) return '';
      if (typeof d === 'object' && 'message' in d && typeof (d as any).message === 'string') {
        return (d as any).message;
      }
      return d;
    };

    switch (level) {
      case 'debug':
        // Only log in dev or non-production
        break;
      case 'info':
        console.log(prefix, safeMessage, formatDetail(safeDetails));
        break;
      case 'warn':
        console.warn(prefix, safeMessage, formatDetail(safeDetails));
        break;
      case 'error':
        console.error(prefix, safeMessage, formatDetail(safeDetails));
        break;
    }
  }

  public debug(message: string, details?: unknown) {
    this.log('debug', message, details);
  }

  public info(message: string, details?: unknown) {
    this.log('info', message, details);
  }

  public warn(message: string, details?: unknown) {
    this.log('warn', message, details);
  }

  public error(message: string, details?: unknown) {
    this.log('error', message, details);
  }

  public getRecentLogs(): LogEntry[] {
    return [...this.logs];
  }
}

export function createLogger(moduleName: string): Logger {
  return new Logger(moduleName);
}
