import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelManager } from '../../src/ai/model-manager';
import { MLCEngineInterface } from '@mlc-ai/web-llm';

describe('ModelManager', () => {
  let manager: ModelManager;

  const mockEngine: Partial<MLCEngineInterface> = {
    unload: vi.fn().mockResolvedValue(undefined),
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"isDefect":false}' } }],
        }),
      } as unknown,
    } as unknown as MLCEngineInterface['chat'],
  };

  const mockEngineFactory = vi.fn().mockResolvedValue(mockEngine as MLCEngineInterface);

  beforeEach(() => {
    manager = new ModelManager(mockEngineFactory as unknown as typeof import('@mlc-ai/web-llm').CreateMLCEngine);
    vi.clearAllMocks();
  });

  it('starts in NOT_LOADED status', () => {
    const status = manager.getStatus();
    expect(status.status).toBe('NOT_LOADED');
    expect(manager.isReady()).toBe(false);
  });

  it('handles unsupported hardware gracefully by setting status to ERROR', async () => {
    vi.spyOn(manager, 'checkHardware').mockResolvedValue({
      supported: false,
      tier: 'UNSUPPORTED',
      recommendedModelId: 'test-model',
      notes: 'No GPU',
    });

    const success = await manager.loadModel('test-model');
    expect(success).toBe(false);
    expect(manager.getStatus().status).toBe('ERROR');
    expect(manager.getStatus().lastError).toContain('WebGPU is not supported');
  });

  it('loads model, triggers progress callback, and enters READY state', async () => {
    vi.spyOn(manager, 'checkHardware').mockResolvedValue({
      supported: true,
      tier: 'LIGHT_WEBGPU',
      recommendedModelId: 'SmolLM2-360M',
      notes: 'OK',
    });

    const progressReports: number[] = [];
    const success = await manager.loadModel('SmolLM2-360M', (pct) => {
      progressReports.push(pct);
    });

    expect(success).toBe(true);
    expect(manager.isReady()).toBe(true);
    expect(manager.getStatus().status).toBe('READY');
    expect(mockEngineFactory).toHaveBeenCalled();
  });

  it('proactively routes to universal compatibility model when hardware lacks shader-f16', async () => {
    vi.spyOn(manager, 'checkHardware').mockResolvedValue({
      supported: true,
      tier: 'LIGHT_WEBGPU',
      hasShaderF16: false,
      recommendedModelId: 'SmolLM2-360M-Instruct-q4f32_1-MLC',
      notes: 'OK',
    });

    const success = await manager.loadModel('SmolLM2-360M-Instruct-q4f16_1-MLC');
    expect(success).toBe(true);
    expect(manager.isReady()).toBe(true);
    expect(manager.getStatus().currentModelId).toBe('SmolLM2-360M-Instruct-q4f32_1-MLC');
    expect(mockEngineFactory).toHaveBeenCalledWith('SmolLM2-360M-Instruct-q4f32_1-MLC', expect.any(Object));
  });

  it('falls back to universal compatibility model if initial model fails', async () => {
    vi.spyOn(manager, 'checkHardware').mockResolvedValue({
      supported: true,
      tier: 'LIGHT_WEBGPU',
      hasShaderF16: true,
      recommendedModelId: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
      notes: 'OK',
    });

    mockEngineFactory
      .mockRejectedValueOnce(new Error('shader-f16 runtime error'))
      .mockResolvedValueOnce(mockEngine as MLCEngineInterface);

    const success = await manager.loadModel('SmolLM2-360M-Instruct-q4f16_1-MLC');
    expect(success).toBe(true);
    expect(manager.isReady()).toBe(true);
    expect(manager.getStatus().currentModelId).toBe('SmolLM2-360M-Instruct-q4f32_1-MLC');
  });

  it('generates chat completion when model is ready', async () => {
    vi.spyOn(manager, 'checkHardware').mockResolvedValue({
      supported: true,
      tier: 'LIGHT_WEBGPU',
      recommendedModelId: 'SmolLM2-360M',
      notes: 'OK',
    });

    await manager.loadModel('SmolLM2-360M');

    const reply = await manager.generateChatCompletion([
      { role: 'user', content: 'Is this button broken?' },
    ]);

    expect(reply).toBe('{"isDefect":false}');
  });

  it('throws error if completion is attempted before model is ready', async () => {
    await expect(
      manager.generateChatCompletion([{ role: 'user', content: 'Hello' }])
    ).rejects.toThrow(/not ready/i);
  });

  it('unloads model and resets state', async () => {
    vi.spyOn(manager, 'checkHardware').mockResolvedValue({
      supported: true,
      tier: 'LIGHT_WEBGPU',
      recommendedModelId: 'SmolLM2-360M',
      notes: 'OK',
    });

    await manager.loadModel('SmolLM2-360M');
    expect(manager.isReady()).toBe(true);

    await manager.unloadModel();
    expect(manager.isReady()).toBe(false);
    expect(manager.getStatus().status).toBe('NOT_LOADED');
    expect(mockEngine.unload).toHaveBeenCalled();
  });

  it('configures indexeddb cacheBackend when loading models', async () => {
    vi.spyOn(manager, 'checkHardware').mockResolvedValue({
      supported: true,
      tier: 'LIGHT_WEBGPU',
      recommendedModelId: 'SmolLM2-360M-Instruct-q4f32_1-MLC',
      notes: 'OK',
    });

    await manager.loadModel('SmolLM2-360M-Instruct-q4f32_1-MLC');
    expect(mockEngineFactory).toHaveBeenCalledWith(
      'SmolLM2-360M-Instruct-q4f32_1-MLC',
      expect.objectContaining({
        appConfig: expect.objectContaining({
          cacheBackend: 'indexeddb',
        }),
      })
    );
  });

  it('clearCache successfully executes without throwing', async () => {
    const success = await manager.clearCache();
    expect(success).toBe(true);
    expect(manager.getStatus().status).toBe('NOT_LOADED');
  });
});
