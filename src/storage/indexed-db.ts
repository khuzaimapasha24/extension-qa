import { DB_NAME, DB_VERSION } from '../shared/constants/defaults';
import { DatabaseSchema } from '../shared/types/storage';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('IndexedDB');

export class IndexedDBClient {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  public async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        logger.info(`Upgrading IndexedDB database to version ${DB_VERSION}`);

        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('startTime', 'startTime', { unique: false });
        }

        // Findings store
        if (!db.objectStoreNames.contains('findings')) {
          const findingStore = db.createObjectStore('findings', { keyPath: 'id' });
          findingStore.createIndex('sessionId', 'sessionId', { unique: false });
          findingStore.createIndex('severity', 'severity', { unique: false });
          findingStore.createIndex('status', 'status', { unique: false });
        }

        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('origin', 'origin', { unique: false });
        }

        // Logs store
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('sessionId', 'sessionId', { unique: false });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Reports store
        if (!db.objectStoreNames.contains('reports')) {
          const reportStore = db.createObjectStore('reports', { keyPath: 'id' });
          reportStore.createIndex('sessionId', 'sessionId', { unique: false });
        }

        // Page snapshots store
        if (!db.objectStoreNames.contains('page_snapshots')) {
          const snapshotStore = db.createObjectStore('page_snapshots', { keyPath: 'url' });
          snapshotStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Discovery maps store
        if (!db.objectStoreNames.contains('discovery_maps')) {
          db.createObjectStore('discovery_maps', { keyPath: 'sessionId' });
        }

        // Learned workflows store for Zero-AI autonomous execution
        if (!db.objectStoreNames.contains('learned_workflows')) {
          const workflowStore = db.createObjectStore('learned_workflows', { keyPath: 'id' });
          workflowStore.createIndex('origin', 'origin', { unique: false });
          workflowStore.createIndex('lastVerified', 'lastVerified', { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event: Event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        logger.error('Failed to open IndexedDB', error);
        reject(error || new Error('Failed to open IndexedDB'));
      };
    });

    return this.initPromise;
  }

  public async get<K extends keyof DatabaseSchema>(
    storeName: K,
    key: IDBValidKey
  ): Promise<DatabaseSchema[K] | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve((request.result as DatabaseSchema[K]) || null);
      };

      request.onerror = () => {
        reject(request.error || new Error(`Error fetching key ${String(key)} from ${storeName}`));
      };
    });
  }

  public async put<K extends keyof DatabaseSchema>(
    storeName: K,
    value: DatabaseSchema[K]
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error(`Error putting into ${storeName}`));
    });
  }

  public async getAll<K extends keyof DatabaseSchema>(
    storeName: K
  ): Promise<DatabaseSchema[K][]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as DatabaseSchema[K][]) || []);
      };

      request.onerror = () => reject(request.error || new Error(`Error getting all from ${storeName}`));
    });
  }

  public async getAllByIndex<K extends keyof DatabaseSchema>(
    storeName: K,
    indexName: string,
    query: IDBValidKey | IDBKeyRange
  ): Promise<DatabaseSchema[K][]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(query);

      request.onsuccess = () => {
        resolve((request.result as DatabaseSchema[K][]) || []);
      };

      request.onerror = () => reject(request.error || new Error(`Error getting by index ${indexName} from ${storeName}`));
    });
  }

  public async delete<K extends keyof DatabaseSchema>(
    storeName: K,
    key: IDBValidKey
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error(`Error deleting key ${String(key)} from ${storeName}`));
    });
  }

  public async clear<K extends keyof DatabaseSchema>(storeName: K): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error(`Error clearing store ${storeName}`));
    });
  }
}

export const dbClient = new IndexedDBClient();
