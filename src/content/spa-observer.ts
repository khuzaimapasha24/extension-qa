import { createLogger } from '../shared/logger/logger';

const logger = createLogger('SPAObserver');

export type RouteChangeCallback = (newUrl: string, title: string) => void;

export class SPAObserver {
  private isObserving = false;
  private listeners: RouteChangeCallback[] = [];
  private lastUrl = '';

  constructor() {
    this.lastUrl = typeof window !== 'undefined' ? window.location.href : '';
  }

  public subscribe(callback: RouteChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    const currentUrl = window.location.href;
    if (currentUrl !== this.lastUrl) {
      logger.info(`Client-side route transition detected: ${this.lastUrl} -> ${currentUrl}`);
      this.lastUrl = currentUrl;
      const title = document.title;
      for (const listener of this.listeners) {
        try {
          listener(currentUrl, title);
        } catch (err) {
          logger.error('Error in route change listener', err);
        }
      }
    }
  }

  public start(): void {
    if (this.isObserving || typeof window === 'undefined') return;
    this.isObserving = true;

    // Listen to standard popstate
    window.addEventListener('popstate', () => this.notify());
    window.addEventListener('hashchange', () => this.notify());

    // Wrap pushState and replaceState non-destructively
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.notify();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.notify();
    };

    logger.info('SPA route change observer started.');
  }
}

export const spaObserver = new SPAObserver();
