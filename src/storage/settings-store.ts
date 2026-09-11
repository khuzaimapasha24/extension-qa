import { dbClient } from './indexed-db';
import { SessionConfig, AIConfig } from '../shared/types/session';
import { DEFAULT_SESSION_CONFIG, DEFAULT_AI_CONFIG } from '../shared/constants/defaults';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('SettingsStore');
const SETTINGS_STORAGE_KEY = 'user_session_config';

export class SettingsStore {
  public async getSettings(): Promise<SessionConfig> {
    try {
      const record = await dbClient.get('settings', SETTINGS_STORAGE_KEY);
      if (record && record.value) {
        const stored = record.value as Partial<SessionConfig>;
        const aiConfig: AIConfig = {
          ...DEFAULT_AI_CONFIG,
          ...(stored.ai || {}),
        };
        // Auto-inject default key if user hasn't set one yet
        if (!aiConfig.geminiApiKey || !aiConfig.geminiApiKey.trim()) {
          aiConfig.geminiApiKey = DEFAULT_AI_CONFIG.geminiApiKey;
        }
        if (!aiConfig.geminiModel) {
          aiConfig.geminiModel = 'gemini-2.5-flash';
        }
        if (aiConfig.geminiApiKey && (!aiConfig.provider || aiConfig.provider === 'auto')) {
          aiConfig.provider = 'gemini';
        }

        return {
          ...DEFAULT_SESSION_CONFIG,
          ...stored,
          ai: aiConfig,
        };
      }
    } catch (err) {
      logger.warn('Failed to read settings from IndexedDB, using defaults', err);
    }
    return { ...DEFAULT_SESSION_CONFIG };
  }

  public async updateSettings(settings: Partial<SessionConfig>): Promise<SessionConfig> {
    const current = await this.getSettings();
    const updated: SessionConfig = {
      ...current,
      ...settings,
    };

    try {
      await dbClient.put('settings', {
        key: SETTINGS_STORAGE_KEY,
        value: updated,
        updatedAt: Date.now(),
      });
    } catch (err) {
      logger.error('Failed to persist settings', err);
      throw err;
    }

    return updated;
  }

  public async resetSettings(): Promise<SessionConfig> {
    try {
      await dbClient.delete('settings', SETTINGS_STORAGE_KEY);
    } catch (err) {
      logger.error('Failed to reset settings', err);
    }
    return { ...DEFAULT_SESSION_CONFIG };
  }
}

export const settingsStore = new SettingsStore();
