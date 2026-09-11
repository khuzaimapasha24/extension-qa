import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudLLMClient } from '../../src/ai/cloud-llm-client';
import { AIConfig } from '../../src/shared/types/session';

describe('CloudLLMClient', () => {
  let client: CloudLLMClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new CloudLLMClient();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('resolveActiveProvider', () => {
    it('returns local_webgpu when no config or keys provided', () => {
      const active = client.resolveActiveProvider();
      expect(active.provider).toBe('local_webgpu');
      expect(active.isCloud).toBe(false);
    });

    it('auto-resolves Gemini when only geminiApiKey is provided', () => {
      const config: AIConfig = {
        provider: 'auto',
        geminiApiKey: 'AIzaSyTestGeminiKey123456789012345678',
        geminiModel: 'gemini-1.5-pro',
      };
      const active = client.resolveActiveProvider(config);
      expect(active.provider).toBe('gemini');
      expect(active.isCloud).toBe(true);
      expect(active.model).toBe('gemini-1.5-pro');
      expect(active.apiKey).toBe('AIzaSyTestGeminiKey123456789012345678');
    });

    it('auto-resolves OpenAI when only openaiApiKey is provided', () => {
      const config: AIConfig = {
        provider: 'auto',
        openaiApiKey: 'sk-proj-testOpenAiKey1234567890123456',
        openaiModel: 'gpt-4o',
      };
      const active = client.resolveActiveProvider(config);
      expect(active.provider).toBe('openai');
      expect(active.isCloud).toBe(true);
      expect(active.model).toBe('gpt-4o');
      expect(active.apiKey).toBe('sk-proj-testOpenAiKey1234567890123456');
    });

    it('auto-resolves Anthropic when only anthropicApiKey is provided', () => {
      const config: AIConfig = {
        provider: 'auto',
        anthropicApiKey: 'sk-ant-testAnthropicKey12345678901234',
        anthropicModel: 'claude-3-5-sonnet-20241022',
      };
      const active = client.resolveActiveProvider(config);
      expect(active.provider).toBe('anthropic');
      expect(active.isCloud).toBe(true);
      expect(active.model).toBe('claude-3-5-sonnet-20241022');
      expect(active.apiKey).toBe('sk-ant-testAnthropicKey12345678901234');
    });

    it('respects explicit provider selection over others when key is present', () => {
      const config: AIConfig = {
        provider: 'openai',
        geminiApiKey: 'AIzaSyGemini...',
        openaiApiKey: 'sk-proj-openaiKey...',
      };
      const active = client.resolveActiveProvider(config);
      expect(active.provider).toBe('openai');
      expect(active.isCloud).toBe(true);
    });

    it('falls back to local_webgpu if explicit provider has no key', () => {
      const config: AIConfig = {
        provider: 'local_webgpu',
        geminiApiKey: 'AIzaSyGemini...',
      };
      const active = client.resolveActiveProvider(config);
      expect(active.provider).toBe('local_webgpu');
      expect(active.isCloud).toBe(false);
    });
  });

  describe('testApiKey', () => {
    it('returns error if key is empty or too short', async () => {
      const res = await client.testApiKey('gemini', '   ');
      expect(res.success).toBe(false);
      expect(res.message).toContain('empty');
    });

    it('calls Gemini and returns success on valid HTTP 200', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'OK' }] } }],
        }),
      });

      const res = await client.testApiKey('gemini', 'AIzaSyValidTestKey');
      expect(res.success).toBe(true);
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);
      expect(res.message).toContain('Connected successfully');
    });

    it('handles Gemini responses with thinking tokens and thoughtSignatures', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [
                { text: 'OK', thoughtSignature: 'mockThoughtSignature123' }
              ],
              role: 'model'
            },
            finishReason: 'STOP',
            index: 0
          }],
          usageMetadata: {
            promptTokenCount: 3,
            candidatesTokenCount: 1,
            totalTokenCount: 70,
            thoughtsTokenCount: 66
          }
        }),
      });

      const res = await client.testApiKey('gemini', 'AIzaSyValidTestKey', 'gemini-3.6-flash');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Connected successfully to gemini-3.6-flash');
    });

    it('calls OpenAI and returns success on valid HTTP 200', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OK' } }],
        }),
      });

      const res = await client.testApiKey('openai', 'sk-validTestKey');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Connected successfully');
    });

    it('calls Anthropic and returns success on valid HTTP 200', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'OK' }],
        }),
      });

      const res = await client.testApiKey('anthropic', 'sk-ant-validKey');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Connected successfully');
    });

    it('handles HTTP error gracefully with informative error message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key provided',
      });

      const res = await client.testApiKey('gemini', 'AIzaSyBadKey');
      expect(res.success).toBe(false);
      expect(res.message).toContain('401');
    });
  });

  describe('generateCompletion', () => {
    it('returns null when no cloud provider is active', async () => {
      const res = await client.generateCompletion('test prompt', {}, { provider: 'auto' });
      expect(res).toBeNull();
    });

    it('returns text response when cloud provider succeeds', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'AI analysis generated' }] } }],
        }),
      });

      const res = await client.generateCompletion(
        'Analyze layout',
        {},
        { provider: 'gemini', geminiApiKey: 'AIzaSyValidKey' }
      );
      expect(res).toBe('AI analysis generated');
    });
  });
});
