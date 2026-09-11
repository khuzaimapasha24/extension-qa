import { AIConfig, LLMProvider } from '../shared/types/session';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('CloudLLMClient');

export interface ActiveAIProviderInfo {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  isCloud: boolean;
}

export interface TestKeyResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export class CloudLLMClient {
  /**
   * Automatically resolves the best active AI provider based on configuration.
   * If any single API key is provided, it seamlessly activates that provider.
   */
  public resolveActiveProvider(config?: AIConfig): ActiveAIProviderInfo {
    if (!config) {
      return { provider: 'local_webgpu', isCloud: false };
    }

    const { provider = 'auto', geminiApiKey, geminiModel, openaiApiKey, openaiModel, anthropicApiKey, anthropicModel } = config;

    const hasGemini = Boolean(geminiApiKey && geminiApiKey.trim().length > 5);
    const hasOpenAI = Boolean(openaiApiKey && openaiApiKey.trim().length > 5);
    const hasAnthropic = Boolean(anthropicApiKey && anthropicApiKey.trim().length > 5);

    // Explicit selection with key available
    if (provider === 'gemini' && hasGemini) {
      return {
        provider: 'gemini',
        apiKey: geminiApiKey!.trim(),
        model: geminiModel || 'gemini-3.6-flash',
        isCloud: true,
      };
    }
    if (provider === 'openai' && hasOpenAI) {
      return {
        provider: 'openai',
        apiKey: openaiApiKey!.trim(),
        model: openaiModel || 'gpt-4o-mini',
        isCloud: true,
      };
    }
    if (provider === 'anthropic' && hasAnthropic) {
      return {
        provider: 'anthropic',
        apiKey: anthropicApiKey!.trim(),
        model: anthropicModel || 'claude-3-5-haiku-20241022',
        isCloud: true,
      };
    }
    if (provider === 'local_webgpu') {
      return { provider: 'local_webgpu', isCloud: false };
    }

    // Auto resolution: pick whichever key is available
    if (hasGemini) {
      return {
        provider: 'gemini',
        apiKey: geminiApiKey!.trim(),
        model: geminiModel || 'gemini-3.6-flash',
        isCloud: true,
      };
    }
    if (hasOpenAI) {
      return {
        provider: 'openai',
        apiKey: openaiApiKey!.trim(),
        model: openaiModel || 'gpt-4o-mini',
        isCloud: true,
      };
    }
    if (hasAnthropic) {
      return {
        provider: 'anthropic',
        apiKey: anthropicApiKey!.trim(),
        model: anthropicModel || 'claude-3-5-haiku-20241022',
        isCloud: true,
      };
    }

    // No cloud keys available, fallback to local WebGPU
    return { provider: 'local_webgpu', isCloud: false };
  }

  /**
   * Cleans and sanitizes API keys by stripping leading/trailing whitespace,
   * accidental surrounding quotes, and extraneous Bearer prefixes.
   */
  public sanitizeApiKey(key: string): string {
    let cleaned = (key || '').trim();
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.slice(1, -1).trim();
    }
    if (cleaned.startsWith('Bearer ')) {
      cleaned = cleaned.slice(7).trim();
    }
    return cleaned;
  }

  /**
   * Dispatches a prompt to Google Gemini's REST API with automated fallback across available models.
   * Sends the official x-goog-api-key header to ensure compatibility with newer AQ. keys,
   * and handles OAuth access tokens (ya29.) with Authorization Bearer.
   */
  public async callGemini(
    prompt: string,
    apiKey: string,
    model = 'gemini-2.5-flash',
    temperature = 0.1,
    maxTokens = 800
  ): Promise<string> {
    const cleanedKey = this.sanitizeApiKey(apiKey);
    const candidateModels = [model];
    for (const m of [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-flash-latest',
      'gemini-3.6-flash',
    ]) {
      if (!candidateModels.includes(m)) candidateModels.push(m);
    }

    let lastError: Error | null = null;
    for (const currentModel of candidateModels) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        let url: string;

        if (cleanedKey.startsWith('ya29.')) {
          // Google OAuth 2.0 access token
          headers['Authorization'] = `Bearer ${cleanedKey}`;
          url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`;
        } else {
          // Google AI Studio API key (AIza... or AQ....)
          headers['x-goog-api-key'] = cleanedKey;
          url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(cleanedKey)}`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          const isModelNotFound = response.status === 404 || (response.status === 400 && /model/i.test(errText));
          if (isModelNotFound && candidateModels.indexOf(currentModel) < candidateModels.length - 1) {
            logger.warn(`Gemini model ${currentModel} returned ${response.status}, falling back to next available model...`);
            lastError = new Error(`Gemini API error (${response.status}): ${errText}`);
            continue;
          }
          throw new Error(`Gemini API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const candidate = parts
          .map((p: any) => p.text)
          .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
          .join('\n')
          .trim();

        if (!candidate) {
          if (data.candidates?.[0]?.finishReason === 'STOP') {
            return 'OK';
          }
          throw new Error('Gemini API returned an empty response candidate');
        }
        return candidate;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (candidateModels.indexOf(currentModel) < candidateModels.length - 1) {
          continue;
        }
        throw lastError;
      }
    }

    throw lastError || new Error('Gemini API failed across all fallback models');
  }

  /**
   * Dispatches a prompt to OpenAI's Chat Completions REST API.
   */
  public async callOpenAI(
    prompt: string,
    apiKey: string,
    model = 'gpt-4o-mini',
    temperature = 0.1,
    maxTokens = 800
  ): Promise<string> {
    const url = 'https://api.openai.com/v1/chat/completions';

    const cleanedKey = this.sanitizeApiKey(apiKey);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanedKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI API returned an empty response content');
    }
    return content;
  }

  /**
   * Dispatches a prompt to Anthropic's Messages REST API.
   */
  public async callAnthropic(
    prompt: string,
    apiKey: string,
    model = 'claude-3-5-haiku-20241022',
    temperature = 0.1,
    maxTokens = 800
  ): Promise<string> {
    const url = 'https://api.anthropic.com/v1/messages';

    const cleanedKey = this.sanitizeApiKey(apiKey);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cleanedKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) {
      throw new Error('Anthropic API returned an empty message text');
    }
    return text;
  }

  /**
   * Generates a completion using the resolved active cloud provider if available.
   * Returns null if no cloud provider is active.
   */
  public async generateCompletion(
    prompt: string | Array<{ role: string; content: string }>,
    options: { temperature?: number; maxTokens?: number } = {},
    config?: AIConfig
  ): Promise<string | null> {
    const active = this.resolveActiveProvider(config);
    if (!active.isCloud || !active.apiKey) {
      return null;
    }

    const { temperature = 0.1, maxTokens = 800 } = options;
    const promptText = typeof prompt === 'string'
      ? prompt
      : prompt.map((m) => `${m.role === 'system' ? 'System Instruction' : 'User'}: ${m.content}`).join('\n\n');

    try {
      logger.info(`Dispatching AI reasoning via cloud provider: ${active.provider} (${active.model})`);

      if (active.provider === 'gemini') {
        return await this.callGemini(promptText, active.apiKey, active.model, temperature, maxTokens);
      }
      if (active.provider === 'openai') {
        return await this.callOpenAI(promptText, active.apiKey, active.model, temperature, maxTokens);
      }
      if (active.provider === 'anthropic') {
        return await this.callAnthropic(promptText, active.apiKey, active.model, temperature, maxTokens);
      }

      return null;
    } catch (err) {
      logger.warn(`Cloud LLM request failed for ${active.provider}:`, err);
      return null;
    }
  }

  /**
   * Dispatches a multimodal prompt with image to Google Gemini Vision.
   */
  public async callGeminiVision(
    prompt: string,
    imageInput: string,
    apiKey: string,
    model = 'gemini-2.5-flash',
    temperature = 0.1,
    maxTokens = 800
  ): Promise<string> {
    const cleanedKey = this.sanitizeApiKey(apiKey);
    const { mimeType, base64Raw } = this.parseBase64Image(imageInput);
    const candidateModels = [model];
    for (const m of [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-flash-latest',
      'gemini-3.6-flash',
    ]) {
      if (!candidateModels.includes(m)) candidateModels.push(m);
    }

    let lastError: Error | null = null;
    for (const currentModel of candidateModels) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        let url: string;

        if (cleanedKey.startsWith('ya29.')) {
          headers['Authorization'] = `Bearer ${cleanedKey}`;
          url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`;
        } else {
          headers['x-goog-api-key'] = cleanedKey;
          url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(cleanedKey)}`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Raw,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          const isModelNotFound = response.status === 404 || (response.status === 400 && /model/i.test(errText));
          if (isModelNotFound && candidateModels.indexOf(currentModel) < candidateModels.length - 1) {
            lastError = new Error(`Gemini Vision API error (${response.status}): ${errText}`);
            continue;
          }
          throw new Error(`Gemini Vision API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const candidate = parts
          .map((p: any) => p.text)
          .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
          .join('\n')
          .trim();

        if (!candidate) {
          if (data.candidates?.[0]?.finishReason === 'STOP') {
            return 'OK';
          }
          throw new Error('Gemini Vision returned empty candidate');
        }
        return candidate;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (candidateModels.indexOf(currentModel) < candidateModels.length - 1) continue;
        throw lastError;
      }
    }
    throw lastError || new Error('Gemini Vision failed across all models');
  }

  /**
   * Dispatches a multimodal prompt with image to OpenAI Vision (GPT-4o).
   */
  public async callOpenAIVision(
    prompt: string,
    imageInput: string,
    apiKey: string,
    model = 'gpt-4o-mini',
    temperature = 0.1,
    maxTokens = 800
  ): Promise<string> {
    const cleanedKey = this.sanitizeApiKey(apiKey);
    const { dataUrl } = this.parseBase64Image(imageInput);
    const url = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanedKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Vision error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI Vision returned empty content');
    return content;
  }

  /**
   * Dispatches a multimodal prompt with image to Anthropic Claude Vision.
   */
  public async callAnthropicVision(
    prompt: string,
    imageInput: string,
    apiKey: string,
    model = 'claude-3-5-haiku-20241022',
    temperature = 0.1,
    maxTokens = 800
  ): Promise<string> {
    const cleanedKey = this.sanitizeApiKey(apiKey);
    const { mimeType, base64Raw } = this.parseBase64Image(imageInput);
    const url = 'https://api.anthropic.com/v1/messages';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cleanedKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType as any,
                  data: base64Raw,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic Vision error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    if (!text) throw new Error('Anthropic Vision returned empty message');
    return text;
  }

  /**
   * Helper to parse data URL or raw base64 strings into mimeType, base64Raw, and full dataUrl.
   */
  public parseBase64Image(imageInput: string): { mimeType: string; base64Raw: string; dataUrl: string } {
    if (imageInput.startsWith('data:')) {
      const parts = imageInput.split(',');
      const match = parts[0].match(/:(.*?);/);
      const mimeType = match ? match[1] : 'image/jpeg';
      const base64Raw = parts[1] || '';
      return { mimeType, base64Raw, dataUrl: imageInput };
    }
    return {
      mimeType: 'image/jpeg',
      base64Raw: imageInput,
      dataUrl: `data:image/jpeg;base64,${imageInput}`,
    };
  }

  /**
   * High-level multimodal vision generator across active cloud providers.
   */
  public async generateVisionCompletion(
    prompt: string,
    imageInput: string,
    options: { temperature?: number; maxTokens?: number } = {},
    config?: AIConfig
  ): Promise<string | null> {
    const active = this.resolveActiveProvider(config);
    if (!active.isCloud || !active.apiKey) {
      return null;
    }

    const { temperature = 0.1, maxTokens = 800 } = options;

    try {
      logger.info(`Dispatching Jarvis Multimodal Vision reasoning via ${active.provider} (${active.model})`);

      if (active.provider === 'gemini') {
        return await this.callGeminiVision(prompt, imageInput, active.apiKey, active.model, temperature, maxTokens);
      }
      if (active.provider === 'openai') {
        return await this.callOpenAIVision(prompt, imageInput, active.apiKey, active.model, temperature, maxTokens);
      }
      if (active.provider === 'anthropic') {
        return await this.callAnthropicVision(prompt, imageInput, active.apiKey, active.model, temperature, maxTokens);
      }
      return null;
    } catch (err) {
      logger.warn(`Multimodal Vision inference failed for ${active.provider}:`, err);
      return null;
    }
  }

  /**
   * Verifies connectivity and model availability for a given provider and API key.
   */
  public async testApiKey(
    provider: 'gemini' | 'openai' | 'anthropic',
    apiKey: string,
    model?: string
  ): Promise<TestKeyResult> {
    const trimmedKey = this.sanitizeApiKey(apiKey);
    if (!trimmedKey) {
      return { success: false, message: 'API key cannot be empty' };
    }

    const startTime = Date.now();
    const testPrompt = 'Respond strictly with the single word: OK';

    try {
      let result = '';
      if (provider === 'gemini') {
        result = await this.callGemini(testPrompt, trimmedKey, model || 'gemini-2.5-flash', 0.1, 200);
      } else if (provider === 'openai') {
        result = await this.callOpenAI(testPrompt, trimmedKey, model || 'gpt-4o-mini', 0.1, 50);
      } else if (provider === 'anthropic') {
        result = await this.callAnthropic(testPrompt, trimmedKey, model || 'claude-3-5-haiku-20241022', 0.1, 50);
      } else {
        return { success: false, message: `Unsupported provider: ${provider}` };
      }

      const latencyMs = Date.now() - startTime;
      logger.info(`API Key test succeeded for ${provider} in ${latencyMs}ms. Reply: ${result.slice(0, 20)}`);

      return {
        success: true,
        latencyMs,
        message: `Connected successfully to ${model || provider} (${latencyMs}ms)`,
      };
    } catch (err) {
      let errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') || errMsg.includes('UNAUTHENTICATED')) {
        errMsg = `Gemini authentication error: Invalid credentials. Please verify your Google AI Studio API key (starts with AIzaSy... or AQ....). (${errMsg})`;
      }
      logger.warn(`API Key test failed for ${provider}: ${errMsg}`);
      return {
        success: false,
        message: errMsg,
      };
    }
  }
}

export const cloudLlmClient = new CloudLLMClient();
