import { CreateMLCEngine, MLCEngineInterface, InitProgressReport } from '@mlc-ai/web-llm';
import { webgpuDetector, WebGPUReport, DEFAULT_LIGHT_MODEL, DEFAULT_COMPAT_MODEL } from './webgpu-detector';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('ModelManager');

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
    modelId: string = DEFAULT_LIGHT_MODEL,
    onProgress?: (progress: number, text: string) => void
  ): Promise<boolean> {
    if (this.isReady() && this.currentModelId === modelId) {
      logger.info(`Model ${modelId} is already ready in VRAM.`);
      return true;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      let initProgressCallback: ((report: InitProgressReport) => void) | undefined;
      try {
        const hw = await this.checkHardware();
        if (!hw.supported) {
          this.status = 'ERROR';
          this.lastError = 'WebGPU is not supported on this device. Local AI unavailable.';
          logger.warn(this.lastError);
          return false;
        }

        this.status = 'DOWNLOADING';
        this.currentModelId = modelId;
        this.progressPercent = 0;
        this.progressText = `Preparing ${modelId}...`;
        this.lastError = undefined;

        logger.info(`Starting load for model: ${modelId}`);

        initProgressCallback = (report: InitProgressReport) => {
          const pct = Math.round(report.progress * 100);
          this.progressPercent = pct;
          this.progressText = report.text || `Loading model: ${pct}%`;
          if (onProgress) {
            onProgress(pct, this.progressText);
          }
          logger.debug(`MLC Init: [${pct}%] ${this.progressText}`);
        };

        this.engine = await this.engineFactory(modelId, {
          initProgressCallback,
        });

        this.status = 'READY';
        this.progressPercent = 100;
        this.progressText = 'Model loaded and ready for local inference';
        logger.info(`Model ${modelId} loaded successfully into WebGPU.`);
        return true;
      } catch (err) {
        const primaryError = err instanceof Error ? err.message : String(err);

        // Automatic fallback to universal compatibility model if initial attempt failed
        if (modelId !== DEFAULT_COMPAT_MODEL && (modelId.includes('SmolLM2') || modelId.includes('q0f32') || modelId.includes('q4f16'))) {
          try {
            logger.warn(`Model ${modelId} failed (${primaryError}). Retrying with universal compatibility model ${DEFAULT_COMPAT_MODEL}...`);
            this.progressText = `Retrying with universal model ${DEFAULT_COMPAT_MODEL}...`;
            this.currentModelId = DEFAULT_COMPAT_MODEL;
            this.engine = await this.engineFactory(DEFAULT_COMPAT_MODEL, {
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
        this.lastError = primaryError;
        this.engine = null;
        logger.error(`Failed to load model ${modelId}: ${primaryError}`, err);
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
   * Clears WebGPU model cache from CacheStorage if supported.
   */
  public async clearCache(): Promise<boolean> {
    await this.unloadModel();

    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          if (key.includes('webllm') || key.includes('mlc')) {
            await caches.delete(key);
            logger.info(`Deleted cache storage: ${key}`);
          }
        }
        return true;
      } catch (err) {
        logger.warn('Failed to clear CacheStorage', err);
        return false;
      }
    }

    return true;
  }
}

export const modelManager = new ModelManager();
