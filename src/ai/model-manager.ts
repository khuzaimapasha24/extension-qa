import {
  CreateMLCEngine,
  MLCEngineInterface,
  InitProgressReport,
  prebuiltAppConfig,
  AppConfig,
} from '@mlc-ai/web-llm';
import { webgpuDetector, WebGPUReport, DEFAULT_COMPAT_MODEL } from './webgpu-detector';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('ModelManager');

/**
 * Configure WebLLM to use IndexedDB storage backend in Chrome Extensions.
 * In Chrome extensions, CacheStorage has cross-origin and header validation limitations
 * for multi-hundred megabyte model shards; IndexedDB provides reliable persistence.
 */
export const EXTENSION_APP_CONFIG: AppConfig = {
  ...prebuiltAppConfig,
  cacheBackend: 'indexeddb',
};

export type ModelStatus = 'NOT_LOADED' | 'DOWNLOADING' | 'READY' | 'ERROR';

export interface ModelManagerStatus {
  status: ModelStatus;
  currentModelId: string | null;
  progressPercent: number;
  progressText: string;
  hardwareReport?: WebGPUReport;
  lastError?: string;
}

export class ModelManager {
  private engine: MLCEngineInterface | null = null;
  private status: ModelStatus = 'NOT_LOADED';
  private currentModelId: string | null = null;
  private progressPercent: number = 0;
  private progressText: string = 'Model not initialized';
  private lastError?: string;
  private hardwareReport?: WebGPUReport;
  private loadPromise: Promise<boolean> | null = null;

  constructor(private engineFactory: typeof CreateMLCEngine = CreateMLCEngine) {}

  public getStatus(): ModelManagerStatus {
    return {
      status: this.status,
      currentModelId: this.currentModelId,
      progressPercent: this.progressPercent,
      progressText: this.progressText,
      hardwareReport: this.hardwareReport,
      lastError: this.lastError,
    };
  }

  public isReady(): boolean {
    return this.status === 'READY' && this.engine !== null;
  }

  /**
   * Initializes hardware inspection and checks WebGPU compatibility.
   */
  public async checkHardware(): Promise<WebGPUReport> {
    this.hardwareReport = await webgpuDetector.detectWebGPU();
    return this.hardwareReport;
  }

  /**
   * Loads a quantized model into WebGPU VRAM.
   */
  public async loadModel(
    modelId?: string,
    onProgress?: (progress: number, text: string) => void
  ): Promise<boolean> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      let initProgressCallback: ((report: InitProgressReport) => void) | undefined;
      let targetModelId = '';
      try {
        const hw = await this.checkHardware();
        if (!hw.supported) {
          this.status = 'ERROR';
          this.lastError = 'WebGPU is not supported on this device. Local AI unavailable.';
          logger.warn(this.lastError);
          return false;
        }

        const requestedModel = modelId || hw.recommendedModelId || DEFAULT_COMPAT_MODEL;

        if (this.isReady() && this.currentModelId === requestedModel) {
          logger.info(`Model ${requestedModel} is already ready in VRAM.`);
          return true;
        }

        // Proactively route model selection if device does not support shader-f16
        targetModelId = requestedModel;
        if (hw.hasShaderF16 !== true && targetModelId.includes('f16')) {
          logger.info(`WebGPU device lacks shader-f16 extension. Proactively switching from ${targetModelId} to ${DEFAULT_COMPAT_MODEL}.`);
          targetModelId = DEFAULT_COMPAT_MODEL;
        }

        if (this.isReady() && this.currentModelId === targetModelId) {
          logger.info(`Model ${targetModelId} is already ready in VRAM.`);
          return true;
        }

        this.status = 'DOWNLOADING';
        this.currentModelId = targetModelId;
        this.progressPercent = 0;
        this.progressText = `Preparing ${targetModelId}...`;
        this.lastError = undefined;

        logger.info(`Starting load for model: ${targetModelId} with indexeddb storage backend`);

        initProgressCallback = (report: InitProgressReport) => {
          const pct = Math.round(report.progress * 100);
          this.progressPercent = pct;
          this.progressText = report.text || `Loading model: ${pct}%`;
          if (onProgress) {
            onProgress(pct, this.progressText);
          }
          logger.debug(`MLC Init: [${pct}%] ${this.progressText}`);
        };

        this.engine = await this.engineFactory(targetModelId, {
          appConfig: EXTENSION_APP_CONFIG,
          initProgressCallback,
        });

        this.status = 'READY';
        this.progressPercent = 100;
        this.progressText = 'Model loaded and ready for local inference';
        logger.info(`Model ${targetModelId} loaded successfully into WebGPU.`);
        return true;
      } catch (err) {
        const primaryError = err instanceof Error ? err.message : String(err);
        logger.error(`Model load error for ${targetModelId}:`, err);

        // If error was related to Cache, IndexedDB, or Network, clean partial cache to avoid corrupt state
        if (
          primaryError.includes('Cache') ||
          primaryError.includes('IndexedDB') ||
          primaryError.includes('network') ||
          primaryError.includes('fetch')
        ) {
          logger.warn('Storage or network error detected during model download. Cleaning partial cache entries...');
          try {
            await this.clearCache();
          } catch (cErr) {
            logger.debug('Error clearing caches after failure', cErr);
          }
        }

        // Automatic fallback to universal compatibility model if initial attempt failed on a non-compat model
        if (
          this.currentModelId !== DEFAULT_COMPAT_MODEL &&
          ((this.currentModelId || '').includes('SmolLM2') ||
            (this.currentModelId || '').includes('q0f32') ||
            (this.currentModelId || '').includes('q4f16') ||
            (this.currentModelId || '').includes('f16'))
        ) {
          try {
            logger.info(`Model ${this.currentModelId} encountered error (${primaryError}). Switching smoothly to universal compatibility model ${DEFAULT_COMPAT_MODEL}...`);
            this.progressText = `Switching to universal model ${DEFAULT_COMPAT_MODEL}...`;
            this.currentModelId = DEFAULT_COMPAT_MODEL;
            this.engine = await this.engineFactory(DEFAULT_COMPAT_MODEL, {
              appConfig: EXTENSION_APP_CONFIG,
              initProgressCallback,
            });
            this.status = 'READY';
            this.progressPercent = 100;
            this.progressText = 'Model loaded and ready for local inference';
            this.lastError = undefined;
            logger.info(`Fallback model ${DEFAULT_COMPAT_MODEL} loaded successfully into WebGPU.`);
            return true;
          } catch (fallbackErr) {
            logger.warn(`Fallback model ${DEFAULT_COMPAT_MODEL} also failed:`, fallbackErr);
          }
        }

        this.status = 'ERROR';
        let friendlyError = primaryError;
        if (
          primaryError.includes('Cache.add') ||
          primaryError.includes('Cache.put') ||
          primaryError.includes('network error') ||
          primaryError.includes('fetch') ||
          primaryError.includes('Failed to fetch')
        ) {
          friendlyError = `Network connection interrupted while downloading model shards: ${primaryError}. Please ensure an active internet connection or click "Clear Cache & Retry".`;
        } else if (primaryError.includes('quota') || primaryError.includes('Storage')) {
          friendlyError = `Storage quota exceeded: ${primaryError}. Free up disk space and click "Clear Cache & Retry".`;
        }
        this.lastError = friendlyError;
        this.engine = null;
        logger.error(`Failed to load model ${this.currentModelId || 'unknown'}: ${friendlyError}`, err);
        return false;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Unloads current model from VRAM and frees resources.
   */
  public async unloadModel(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch (err) {
        logger.debug('Error unloading model engine', err);
      }
      this.engine = null;
    }

    this.status = 'NOT_LOADED';
    this.currentModelId = null;
    this.progressPercent = 0;
    this.progressText = 'Model unloaded';
    logger.info('Model unloaded from VRAM.');
  }

  /**
   * Generates a chat completion using the active local model.
   */
  public async generateChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: { maxTokens?: number; temperature?: number } = {}
  ): Promise<string> {
    if (!this.isReady() || !this.engine) {
      throw new Error('Local AI Model is not ready for inference.');
    }

    try {
      const response = await this.engine.chat.completions.create({
        messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        max_tokens: options.maxTokens ?? 512,
        temperature: options.temperature ?? 0.2,
      });

      const reply = response.choices[0]?.message?.content || '';
      return reply;
    } catch (err) {
      logger.error('Inference error during chat completion', err);
      throw err;
    }
  }

  /**
   * Clears WebGPU model cache from both IndexedDB and CacheStorage.
   */
  public async clearCache(): Promise<boolean> {
    await this.unloadModel();

    let success = true;

    // 1. Delete WebLLM IndexedDB databases
    if (typeof indexedDB !== 'undefined') {
      const dbNames = ['webllm/model', 'webllm/wasm', 'webllm/config', 'tvmjs'];
      for (const dbName of dbNames) {
        try {
          indexedDB.deleteDatabase(dbName);
          logger.info(`Deleted IndexedDB database: ${dbName}`);
        } catch (e) {
          logger.debug(`Could not delete IndexedDB ${dbName}`, e);
        }
      }

      if (typeof indexedDB.databases === 'function') {
        try {
          const dbs = await indexedDB.databases();
          for (const db of dbs) {
            if (db.name && (db.name.includes('webllm') || db.name.includes('mlc') || db.name.includes('tvm'))) {
              indexedDB.deleteDatabase(db.name);
              logger.info(`Deleted dynamic IndexedDB database: ${db.name}`);
            }
          }
        } catch (dErr) {
          logger.debug('Error querying indexedDB.databases()', dErr);
        }
      }
    }

    // 2. Clear CacheStorage entries if present
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          if (key.includes('webllm') || key.includes('mlc') || key.includes('tvm')) {
            await caches.delete(key);
            logger.info(`Deleted cache storage: ${key}`);
          }
        }
      } catch (err) {
        logger.warn('Failed to clear CacheStorage', err);
        success = false;
      }
    }

    return success;
  }
}

export const modelManager = new ModelManager();
