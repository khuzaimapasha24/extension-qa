import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebGPUDetector, DEFAULT_LIGHT_MODEL, DEFAULT_COMPAT_MODEL, DEFAULT_FULL_MODEL } from '../../src/ai/webgpu-detector';

describe('WebGPUDetector', () => {
  let detector: WebGPUDetector;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    detector = new WebGPUDetector();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('returns UNSUPPORTED when navigator.gpu is absent', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });

    const report = await detector.detectWebGPU();
    expect(report.supported).toBe(false);
    expect(report.tier).toBe('UNSUPPORTED');
    expect(report.notes).toContain('WebGPU is not supported');
  });

  it('returns UNSUPPORTED when requestAdapter returns null', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue(null),
        },
      },
      configurable: true,
      writable: true,
    });

    const report = await detector.detectWebGPU();
    expect(report.supported).toBe(false);
    expect(report.tier).toBe('UNSUPPORTED');
    expect(report.notes).toContain('GPU adapter unavailable');
  });

  it('classifies as LIGHT_WEBGPU and selects DEFAULT_COMPAT_MODEL when shader-f16 is missing', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue({
            limits: { maxBufferSize: 512 * 1024 * 1024 }, // 512 MB
            features: { has: vi.fn().mockReturnValue(false) },
          }),
        },
      },
      configurable: true,
      writable: true,
    });

    const report = await detector.detectWebGPU();
    expect(report.supported).toBe(true);
    expect(report.tier).toBe('LIGHT_WEBGPU');
    expect(report.hasShaderF16).toBe(false);
    expect(report.recommendedModelId).toBe(DEFAULT_COMPAT_MODEL);
  });

  it('classifies as LIGHT_WEBGPU and selects DEFAULT_LIGHT_MODEL when shader-f16 is supported', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue({
            limits: { maxBufferSize: 512 * 1024 * 1024 }, // 512 MB
            features: { has: vi.fn().mockImplementation((f: string) => f === 'shader-f16') },
          }),
        },
      },
      configurable: true,
      writable: true,
    });

    const report = await detector.detectWebGPU();
    expect(report.supported).toBe(true);
    expect(report.tier).toBe('LIGHT_WEBGPU');
    expect(report.hasShaderF16).toBe(true);
    expect(report.recommendedModelId).toBe(DEFAULT_LIGHT_MODEL);
  });

  it('classifies as FULL_WEBGPU for high-memory adapters (>= 1024MB)', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        gpu: {
          requestAdapter: vi.fn().mockResolvedValue({
            limits: { maxBufferSize: 2048 * 1024 * 1024 }, // 2048 MB
          }),
        },
      },
      configurable: true,
      writable: true,
    });

    const report = await detector.detectWebGPU();
    expect(report.supported).toBe(true);
    expect(report.tier).toBe('FULL_WEBGPU');
    expect(report.recommendedModelId).toBe(DEFAULT_FULL_MODEL);
  });
});
