/**
 * Standalone WebGPU Runtime Guard for Chrome Extensions on Windows.
 * Runs synchronously before any bundled modules or WebAssembly libraries load.
 *
 * 1. Suppresses Chromium bug crbug.com/369219127 by sanitizing `powerPreference`
 *    before passing options to Dawn C++ backend.
 * 2. Filters harmless Windows driver warnings and third-party adblocker check errors.
 */
(function () {
  'use strict';

  function sanitizeGpuOptions(options) {
    if (options && typeof options === 'object') {
      var copy = Object.assign({}, options);
      delete copy.powerPreference;
      return copy;
    }
    return options;
  }

  // 1. Intercept GPU.prototype.requestAdapter
  try {
    if (typeof GPU !== 'undefined' && GPU.prototype && typeof GPU.prototype.requestAdapter === 'function') {
      var origGpuRequestAdapter = GPU.prototype.requestAdapter;
      GPU.prototype.requestAdapter = function (options) {
        return origGpuRequestAdapter.call(this, sanitizeGpuOptions(options));
      };
    }
  } catch (e) {}

  // 2. Intercept navigator.gpu.requestAdapter and Navigator.prototype.gpu getter
  try {
    if (typeof Navigator !== 'undefined' && Navigator.prototype) {
      var desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'gpu');
      if (desc && desc.get) {
        var origGet = desc.get;
        Object.defineProperty(Navigator.prototype, 'gpu', {
          get: function () {
            var gpuObj = origGet.call(this);
            if (gpuObj && !gpuObj._guarded) {
              try {
                var origReq = gpuObj.requestAdapter.bind(gpuObj);
                gpuObj.requestAdapter = function (options) {
                  return origReq(sanitizeGpuOptions(options));
                };
                gpuObj._guarded = true;
              } catch (err) {}
            }
            return gpuObj;
          },
          configurable: true,
          enumerable: true,
        });
      }
    }

    if (typeof navigator !== 'undefined' && navigator.gpu && !navigator.gpu._guarded) {
      var directReq = navigator.gpu.requestAdapter.bind(navigator.gpu);
      navigator.gpu.requestAdapter = function (options) {
        return directReq(sanitizeGpuOptions(options));
      };
      navigator.gpu._guarded = true;
    }
  } catch (e) {}

  // 3. Intercept console.warn and console.error to filter crbug.com/369219127 and adblocker_check
  try {
    if (typeof console !== 'undefined') {
      var origWarn = console.warn;
      console.warn = function () {
        var msg = Array.prototype.slice.call(arguments).map(function (a) {
          return typeof a === 'string' ? a : (a && a.message) || String(a);
        }).join(' ');
        if (msg.indexOf('powerPreference') !== -1 || msg.indexOf('369219127') !== -1 || msg.indexOf('adblocker_check') !== -1) {
          return;
        }
        return origWarn.apply(console, arguments);
      };

      var origErr = console.error;
      console.error = function () {
        var msg = Array.prototype.slice.call(arguments).map(function (a) {
          return typeof a === 'string' ? a : (a && a.message) || String(a);
        }).join(' ');
        if (msg.indexOf('powerPreference') !== -1 || msg.indexOf('369219127') !== -1 || msg.indexOf('adblocker_check') !== -1) {
          return;
        }
        return origErr.apply(console, arguments);
      };
    }
  } catch (e) {}
})();
