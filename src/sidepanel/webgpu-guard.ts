/**
 * WebGPU & Cache Runtime Guard for Chrome Extensions on Windows.
 *
 * 1. Suppresses Chromium bug https://crbug.com/369219127 by sanitizing `powerPreference`
 *    before passing options to Dawn C++ backend.
 * 2. Hardens `Cache.prototype.add` and `Cache.prototype.put` by buffering responses into
 *    in-memory Blobs before saving to CacheStorage, preventing streaming network breaks.
 * 3. Filters harmless Windows driver warnings and adblocker check errors.
 */

export function sanitizeGpuOptions<T>(options?: T): T | undefined {
  if (options && typeof options === 'object') {
    const copy = { ...(options as Record<string, unknown>) };
    delete copy.powerPreference;
    return copy as T;
  }
  return options;
}

export function initWebGpuGuard(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // 1. Sanitize requestAdapter powerPreference option to eliminate Chromium Windows warning
  try {
    const gpuProto = (window as unknown as { GPU?: { prototype?: { requestAdapter?: (...args: unknown[]) => unknown } } })
      .GPU?.prototype;

    if (gpuProto && typeof gpuProto.requestAdapter === 'function') {
      const nativeRequestAdapter = gpuProto.requestAdapter;
      gpuProto.requestAdapter = function (options?: unknown) {
        return nativeRequestAdapter.call(this, sanitizeGpuOptions(options));
      };
    }

    if (typeof Navigator !== 'undefined' && Navigator.prototype) {
      const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'gpu');
      if (desc && desc.get) {
        const origGet = desc.get;
        Object.defineProperty(Navigator.prototype, 'gpu', {
          get: function () {
            const gpuObj = origGet.call(this);
            if (gpuObj && !(gpuObj as { _guarded?: boolean })._guarded) {
              try {
                const origReq = gpuObj.requestAdapter.bind(gpuObj);
                gpuObj.requestAdapter = function (options?: unknown) {
                  return origReq(sanitizeGpuOptions(options));
                };
                (gpuObj as { _guarded?: boolean })._guarded = true;
              } catch {
                // Ignore
              }
            }
            return gpuObj;
          },
          configurable: true,
          enumerable: true,
        });
      }
    }

    if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as unknown as { gpu?: { requestAdapter?: (...args: unknown[]) => unknown; _guarded?: boolean } }).gpu) {
      const navGpu = (navigator as unknown as { gpu: { requestAdapter: (...args: unknown[]) => unknown; _guarded?: boolean } }).gpu;
      if (!navGpu._guarded) {
        const directAdapter = navGpu.requestAdapter.bind(navGpu);
        navGpu.requestAdapter = function (options?: unknown) {
          return directAdapter(sanitizeGpuOptions(options));
        };
        navGpu._guarded = true;
      }
    }
  } catch {
    // Non-fatal if WebGPU interface is sealed or absent
  }

  // 2. Filter console warnings/errors regarding crbug.com/369219127 and adblocker_check
  if (typeof console !== 'undefined') {
    if (typeof console.warn === 'function') {
      const originalWarn = console.warn;
      console.warn = function (...args: unknown[]) {
        const text = args.map((a) => (typeof a === 'string' ? a : (a as Error)?.message || String(a))).join(' ');
        if (text.includes('powerPreference') || text.includes('369219127') || text.includes('adblocker_check')) {
          return;
        }
        originalWarn.apply(console, args);
      };
    }

    if (typeof console.error === 'function') {
      const originalError = console.error;
      console.error = function (...args: unknown[]) {
        const text = args.map((a) => (typeof a === 'string' ? a : (a as Error)?.message || String(a))).join(' ');
        if (text.includes('powerPreference') || text.includes('369219127') || text.includes('adblocker_check')) {
          return;
        }
        originalError.apply(console, args);
      };
    }
  }

  // 3. Harden CacheStorage add() and put()
  if (typeof window !== 'undefined' && typeof window.Cache !== 'undefined' && window.Cache.prototype) {
    try {
      const nativeCachePut = window.Cache.prototype.put;

      window.Cache.prototype.put = async function (request: RequestInfo | URL, response: Response): Promise<void> {
        try {
          return await nativeCachePut.call(this, request, response);
        } catch (putErr) {
          if (response && typeof response.blob === 'function') {
            try {
              const blob = await response.blob();
              const safeResponse = new Response(blob, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
              });
              return await nativeCachePut.call(this, request, safeResponse);
            } catch {
              throw putErr;
            }
          }
          throw putErr;
        }
      };

      window.Cache.prototype.add = async function (request: RequestInfo | URL): Promise<void> {
        let lastErr: unknown;

        for (let i = 0; i < 3; i++) {
          try {
            const fetchTarget = request instanceof Request ? request.clone() : (request as Request).url || String(request);
            const res = await fetch(fetchTarget);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const blob = await res.blob();
            const safeResponse = new Response(blob, {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers,
            });
            await nativeCachePut.call(this, request, safeResponse);
            return;
          } catch (err) {
            lastErr = err;
            if (i < 2) {
              await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
            }
          }
        }
        throw lastErr || new Error('Failed to cache model shard');
      };
    } catch {
      // Non-fatal if Cache prototype is restricted
    }
  }
}

// Auto-run on module load
initWebGpuGuard();
