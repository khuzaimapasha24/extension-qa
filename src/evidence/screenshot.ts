import { CropRegion } from '../shared/types/qa';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('ScreenshotEngine');

export interface ScreenshotResult {
  dataUrl: string;
  width: number;
  height: number;
  cropRegion?: CropRegion;
  isElementCrop: boolean;
}

/**
 * Captures a visible tab screenshot using the Chrome Tabs API.
 */
export async function captureTabScreenshot(
  _tabId?: number,
  quality: number = 75
): Promise<string | null> {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.captureVisibleTab === 'function') {
      const q = Math.min(100, Math.max(10, quality));
      return await new Promise<string | null>((resolve) => {
        let settled = false;
        const settle = (val: string | null) => {
          if (!settled) {
            settled = true;
            resolve(val);
          }
        };

        try {
          const captureCall = chrome.tabs.captureVisibleTab as unknown as (
            options: chrome.tabs.CaptureVisibleTabOptions,
            callback: (dataUrl: string) => void
          ) => Promise<string> | void;

          const result = captureCall({ format: 'jpeg', quality: q }, (dataUrl) => {
            if (chrome.runtime?.lastError || !dataUrl) {
              settle(null);
            } else {
              settle(dataUrl);
            }
          });

          if (result && typeof (result as Promise<string>).then === 'function') {
            (result as Promise<string>).then(settle).catch(() => settle(null));
          }
        } catch {
          settle(null);
        }
      });
    }
    logger.warn('chrome.tabs.captureVisibleTab not available in current environment');
    return null;
  } catch (err) {
    logger.error('Failed to capture visible tab screenshot', err);
    return null;
  }
}

/**
 * Crops a full tab screenshot to a specific element's bounding box using Canvas or OffscreenCanvas.
 */
export async function cropScreenshotToElement(
  fullDataUrl: string,
  rect: CropRegion,
  maxDimension: number = 800
): Promise<ScreenshotResult> {
  try {
    // 1. OffscreenCanvas (Service Worker / modern browser)
    if (typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function') {
      const response = await fetch(fullDataUrl);
      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);

      // Clamp crop region within source image bounds
      const srcX = Math.max(0, Math.min(rect.x, imageBitmap.width - 10));
      const srcY = Math.max(0, Math.min(rect.y, imageBitmap.height - 10));
      const srcW = Math.max(10, Math.min(rect.width, imageBitmap.width - srcX));
      const srcH = Math.max(10, Math.min(rect.height, imageBitmap.height - srcY));

      // Calculate scaled output dimensions
      let outW = srcW;
      let outH = srcH;
      if (outW > maxDimension || outH > maxDimension) {
        if (outW > outH) {
          outH = Math.round((outH * maxDimension) / outW);
          outW = maxDimension;
        } else {
          outW = Math.round((outW * maxDimension) / outH);
          outH = maxDimension;
        }
      }

      const canvas = new OffscreenCanvas(outW, outH);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(imageBitmap, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        const croppedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
        const reader = new FileReader();
        const croppedDataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(croppedBlob);
        });

        return {
          dataUrl: croppedDataUrl,
          width: outW,
          height: outH,
          cropRegion: { x: srcX, y: srcY, width: srcW, height: srcH },
          isElementCrop: true,
        };
      }
    }

    // 2. HTML Canvas fallback (Window / Side Panel)
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const testCanvas = document.createElement('canvas');
      const testCtx = typeof testCanvas.getContext === 'function' ? testCanvas.getContext('2d') : null;
      if (testCtx) {
        const img = new Image();
        let loaded = false;
        await new Promise<void>((resolve) => {
          img.onload = () => {
            loaded = true;
            resolve();
          };
          img.onerror = () => resolve();
          setTimeout(resolve, 200); // Guard against environments where Image does not decode
          img.src = fullDataUrl;
        });

        if (loaded) {
          const srcX = Math.max(0, Math.min(rect.x, (img.width || 1280) - 10));
          const srcY = Math.max(0, Math.min(rect.y, (img.height || 800) - 10));
          const srcW = Math.max(10, Math.min(rect.width, (img.width || 1280) - srcX));
          const srcH = Math.max(10, Math.min(rect.height, (img.height || 800) - srcY));

          let outW = srcW;
          let outH = srcH;
          if (outW > maxDimension || outH > maxDimension) {
            if (outW > outH) {
              outH = Math.round((outH * maxDimension) / outW);
              outW = maxDimension;
            } else {
              outW = Math.round((outW * maxDimension) / outH);
              outH = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
            return {
              dataUrl: canvas.toDataURL('image/jpeg', 0.8),
              width: outW,
              height: outH,
              cropRegion: { x: srcX, y: srcY, width: srcW, height: srcH },
              isElementCrop: true,
            };
          }
        }
      }
    }
  } catch (err) {
    logger.warn('Canvas crop failed, returning full viewport screenshot', err);
  }

  // Graceful fallback for non-canvas/mock test environments
  return {
    dataUrl: fullDataUrl,
    width: rect.width || 800,
    height: rect.height || 600,
    cropRegion: rect,
    isElementCrop: false,
  };
}
