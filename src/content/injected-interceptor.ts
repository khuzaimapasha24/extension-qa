/**
 * In-Page Network Interceptor.
 * Runs in the webpage context to non-destructively intercept fetch and XMLHttpRequest,
 * capturing request payloads, response statuses, and data flow in real time.
 */

export interface HttpTransaction {
  id: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  requestPayload?: any;
  responsePayload?: any;
  durationMs: number;
  timestamp: number;
  isMutation: boolean; // POST, PUT, PATCH, DELETE
}

/**
 * Safely initializes the in-page interceptor in the current execution context.
 * Does not create or append inline <script> elements to the DOM to strictly comply
 * with host website Content Security Policy (CSP) directives (such as on drive.google.com, github.com, etc.).
 * In Chrome extensions, the main-world interceptor is loaded directly via manifest.json with "world": "MAIN".
 */
export function injectInterceptorIntoPage(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__AI_QA_INTERCEPTOR_ACTIVE__) return;
  initializeInPageInterceptor();
}

/**
 * Self-contained injection function that executes inside the page's execution context.
 */
export function initializeInPageInterceptor(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__AI_QA_INTERCEPTOR_ACTIVE__) return;
  (window as any).__AI_QA_INTERCEPTOR_ACTIVE__ = true;

  const originalFetch = window.fetch;
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;
  const originalXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  function safeParseJson(data: any): any {
    if (typeof data !== 'string') return data;
    try {
      return JSON.parse(data);
    } catch {
      return data.length > 500 ? `${data.substring(0, 500)}... [truncated]` : data;
    }
  }

  function emitTransaction(tx: HttpTransaction): void {
    try {
      window.postMessage(
        {
          source: 'AI_QA_NETWORK_INTERCEPTOR',
          transaction: tx,
        },
        '*'
      );
    } catch {}
  }

  // 1. Intercept Fetch API
  if (originalFetch) {
    window.fetch = async function (...args: any[]) {
      const startTime = Date.now();
      const firstArg = args[0];
      const secondArg = args[1] || {};

      let url = '';
      if (typeof firstArg === 'string') {
        url = firstArg;
      } else if (firstArg && typeof firstArg.url === 'string') {
        url = firstArg.url;
      }

      const method = (secondArg.method || (firstArg && firstArg.method) || 'GET').toUpperCase();
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      let requestPayload: any = undefined;
      if (secondArg.body) {
        requestPayload = safeParseJson(secondArg.body);
      }

      try {
        const response = await originalFetch.apply(this, args);
        const durationMs = Date.now() - startTime;
        const cloned = response.clone();

        cloned.text().then((text) => {
          const responsePayload = safeParseJson(text);
          emitTransaction({
            id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            requestPayload,
            responsePayload,
            durationMs,
            timestamp: Date.now(),
            isMutation,
          });
        }).catch(() => {
          emitTransaction({
            id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            requestPayload,
            durationMs,
            timestamp: Date.now(),
            isMutation,
          });
        });

        return response;
      } catch (err) {
        emitTransaction({
          id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          url,
          method,
          status: 0,
          statusText: err instanceof Error ? err.message : 'Network Error',
          requestPayload,
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
          isMutation,
        });
        throw err;
      }
    };
  }

  // 2. Intercept XMLHttpRequest API
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    (this as any).__ai_qa_method = method.toUpperCase();
    (this as any).__ai_qa_url = typeof url === 'string' ? url : url.toString();
    (this as any).__ai_qa_headers = {};
    return originalXhrOpen.apply(this, [method, url, ...rest] as any);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (header: string, value: string) {
    if ((this as any).__ai_qa_headers) {
      (this as any).__ai_qa_headers[header] = value;
    }
    return originalXhrSetHeader.apply(this, [header, value]);
  };

  XMLHttpRequest.prototype.send = function (body?: any) {
    const xhr = this;
    const startTime = Date.now();
    const method = (xhr as any).__ai_qa_method || 'GET';
    const url = (xhr as any).__ai_qa_url || '';
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const requestPayload = body ? safeParseJson(body) : undefined;

    xhr.addEventListener('loadend', () => {
      let responsePayload: any = undefined;
      try {
        responsePayload = safeParseJson(xhr.responseText);
      } catch {}

      emitTransaction({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        url,
        method,
        status: xhr.status,
        statusText: xhr.statusText,
        requestPayload,
        responsePayload,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
        isMutation,
      });
    });

    return originalXhrSend.apply(this, [body] as any);
  };
}

// Automatically initialize when executed as a dedicated MAIN world script
if (typeof window !== 'undefined') {
  initializeInPageInterceptor();
}
