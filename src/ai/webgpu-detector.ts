import { createLogger } from '../shared/logger/logger';

const logger = createLogger('WebGPUDetector');

export type WebGPUTier = 'FULL_WEBGPU' | 'LIGHT_WEBGPU' | 'UNSUPPORTED';

export interface WebGPUReport {
  supported: boolean;
  tier: WebGPUTier;
  adapterName?: string;
  vendor?: string;
  architecture?: string;
  maxBufferSizeMB?: number;
  hasShaderF16?: boolean;
  recommendedModelId: string;
  notes: string;
}

export const DEFAULT_LIGHT_MODEL = 'SmolLM2-360M-Instruct-q4f32_1-MLC';
export const DEFAULT_COMPAT_MODEL = 'SmolLM2-360M-Instruct-q4f32_1-MLC';
export const DEFAULT_FULL_MODEL = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
export const F16_FAST_MODEL = 'SmolLM2-360M-Instruct-q4f16_1-MLC';

export class WebGPUDetector {
  /**
   * Detects WebGPU support, tests adapter creation, and assesses device tier.
   */
  public async detectWebGPU(): Promise<WebGPUReport> {
    // 1. Check if navigator.gpu exists in current execution context
    const nav = typeof navigator !== 'undefined' ? (navigator as unknown as {
      gpu?: {
        requestAdapter: (options?: unknown) => Promise<{
          limits?: { maxBufferSize?: number };
          features?: { has: (name: string) => boolean };
          requestAdapterInfo?: () => Promise<{ description?: string; device?: string; vendor?: string; architecture?: string }>;
        } | null>;
      };
    }) : undefined;

    if (!nav || !nav.gpu) {
      logger.info('WebGPU not detected in environment. Activating deterministic fallback.');
      return {
        supported: false,
        tier: 'UNSUPPORTED',
        recommendedModelId: DEFAULT_COMPAT_MODEL,
        notes: 'WebGPU is not supported in this environment. Deterministic QA engine active.',
      };
    }

    try {
      // 2. Request GPU adapter
      const adapter = await nav.gpu.requestAdapter();
      if (!adapter) {
        logger.warn('navigator.gpu present, but requestAdapter returned null.');
        return {
          supported: false,
          tier: 'UNSUPPORTED',
          recommendedModelId: DEFAULT_COMPAT_MODEL,
          notes: 'GPU adapter unavailable or disabled by browser flags.',
        };
      }

      // 3. Inspect adapter limits & features
      const limits = adapter.limits;
      const maxBufferSize = limits?.maxBufferSize ?? 0;
      const maxBufferSizeMB = Math.round(maxBufferSize / (1024 * 1024));

      // Check whether shader-f16 (16-bit float shaders) is supported and can actually be used.
      // Note: On Windows Chromium Dawn, adapter.features.has('shader-f16') may be true based on
      // hardware driver queries, but adapter.requestDevice({ requiredFeatures: ['shader-f16'] })
      // throws unless Chrome is launched with "--enable-dawn-features=allow_unsafe_apis".
      // We probe actual device creation to ensure 100% reliable detection.
      let hasShaderF16 = false;
      const features = (adapter as { features?: { has: (feature: string) => boolean } }).features;
      if (features && typeof features.has === 'function' && features.has('shader-f16')) {
        const reqDevice = (adapter as { requestDevice?: (opts?: unknown) => Promise<{ destroy?: () => void }> }).requestDevice;
        if (typeof reqDevice === 'function') {
          try {
            const probeDevice = await reqDevice.call(adapter, { requiredFeatures: ['shader-f16'] });
            hasShaderF16 = true;
            if (probeDevice && typeof probeDevice.destroy === 'function') {
              probeDevice.destroy();
            }
          } catch {
            hasShaderF16 = false;
          }
        } else {
          hasShaderF16 = true;
        }
      }

      // 4. Retrieve adapter info if available
      let adapterName = 'Standard WebGPU Adapter';
      let vendor = 'Generic';
      let architecture = 'Unknown';

      try {
        if (typeof adapter.requestAdapterInfo === 'function') {
          const info = await adapter.requestAdapterInfo();
          adapterName = info.description || info.device || adapterName;
          vendor = info.vendor || vendor;
          architecture = info.architecture || architecture;
        }
      } catch {
        // requestAdapterInfo optional or restricted
      }

      // 5. Categorize capability tier based on buffer size
      // 1GB+ buffer allows 1B-3B quantized models; smaller buffers support sub-1B models
      const isFullCapability = maxBufferSizeMB >= 1024;
      const tier: WebGPUTier = isFullCapability ? 'FULL_WEBGPU' : 'LIGHT_WEBGPU';
      
      // Determine recommended model based on tier:
      // Both DEFAULT_FULL_MODEL (Llama-3.2-1B-Instruct-q4f32_1-MLC) and
      // DEFAULT_COMPAT_MODEL (SmolLM2-360M-Instruct-q4f32_1-MLC) use universal 32-bit floats,
      // guaranteeing rock-solid execution across all browsers without requiring unsafe flags.
      const recommendedModelId = isFullCapability ? DEFAULT_FULL_MODEL : DEFAULT_COMPAT_MODEL;

      logger.info(`WebGPU active: ${adapterName} (${vendor}), maxBuffer: ${maxBufferSizeMB}MB, shader-f16: ${hasShaderF16}, tier: ${tier}`);

      return {
        supported: true,
        tier,
        adapterName,
        vendor,
        architecture,
        maxBufferSizeMB,
        hasShaderF16,
        recommendedModelId,
        notes: `WebGPU acceleration active (shader-f16: ${hasShaderF16 ? 'supported' : 'unsupported, universal 32-bit mode active'}). Recommended model: ${recommendedModelId}.`,
      };
    } catch (err) {
      logger.error('Error during WebGPU detection', err);
      return {
        supported: false,
        tier: 'UNSUPPORTED',
        recommendedModelId: DEFAULT_LIGHT_MODEL,
        notes: `WebGPU check failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

export const webgpuDetector = new WebGPUDetector();
