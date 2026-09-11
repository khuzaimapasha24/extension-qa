import { dbClient } from './indexed-db';
import { QASession } from '../shared/types/session';
import { Finding } from '../shared/types/qa';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('SessionStore');

export class SessionStore {
  public async saveSession(session: QASession): Promise<void> {
    try {
      await dbClient.put('sessions', session);
    } catch (err) {
      logger.error('Failed to save session', err);
      throw err;
    }
  }

  public async getSession(sessionId: string): Promise<QASession | null> {
    try {
      return await dbClient.get('sessions', sessionId);
    } catch (err) {
      logger.error(`Failed to get session ${sessionId}`, err);
      return null;
    }
  }

  public async getAllSessions(): Promise<QASession[]> {
    try {
      const sessions = await dbClient.getAll('sessions');
      return sessions.sort((a, b) => b.startTime - a.startTime);
    } catch (err) {
      logger.error('Failed to retrieve all sessions', err);
      return [];
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    try {
      await dbClient.delete('sessions', sessionId);
      // Delete associated findings as well
      const findings = await this.getFindingsBySession(sessionId);
      for (const finding of findings) {
        await dbClient.delete('findings', finding.id);
      }
    } catch (err) {
      logger.error(`Failed to delete session ${sessionId}`, err);
      throw err;
    }
  }

  public async saveFinding(finding: Finding): Promise<void> {
    try {
      await dbClient.put('findings', finding);
    } catch (err) {
      logger.error('Failed to save finding', err);
      throw err;
    }
  }

  public async getFindingsBySession(sessionId: string): Promise<Finding[]> {
    try {
      return await dbClient.getAllByIndex('findings', 'sessionId', sessionId);
    } catch (err) {
      logger.error(`Failed to retrieve findings for session ${sessionId}`, err);
      return [];
    }
  }
}

export const sessionStore = new SessionStore();
