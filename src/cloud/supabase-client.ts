import { SupabaseConfig } from '../shared/types/session';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('SupabaseClient');

export interface CloudReportPayload {
  id: string;
  session_id: string;
  url: string;
  title: string;
  overall_score: number;
  quality_rating: string;
  tests_executed: number;
  pages_scanned: number;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  category_scores: Record<string, unknown>;
  findings_summary: Array<Record<string, unknown>>;
  html_report_url?: string;
  json_report_url?: string;
  created_at?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  latencyMs?: number;
}

export class SupabaseClient {
  /**
   * Normalizes a Supabase base URL by trimming trailing slashes and spaces.
   */
  public normalizeUrl(url: string): string {
    if (!url) return '';
    return url.trim().replace(/\/+$/, '');
  }

  /**
   * Validates Supabase URL format.
   */
  public isValidUrl(url: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  /**
   * Tests reachability and authentication against a Supabase project.
   */
  public async testConnection(url: string, anonKey: string): Promise<ConnectionTestResult> {
    const cleanUrl = this.normalizeUrl(url);
    if (!this.isValidUrl(cleanUrl)) {
      return { success: false, error: 'Invalid Supabase URL format. Must start with https://' };
    }
    if (!anonKey || anonKey.trim().length < 20) {
      return { success: false, error: 'Invalid Supabase Anon Key. Expected valid JWT key.' };
    }

    const start = Date.now();
    try {
      // Ping REST API root
      const response = await fetch(`${cleanUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: anonKey.trim(),
          Authorization: `Bearer ${anonKey.trim()}`,
        },
      });

      const latencyMs = Date.now() - start;

      if (response.ok || response.status === 200) {
        logger.info(`Supabase connection verified (${latencyMs}ms)`);
        return { success: true, latencyMs };
      }

      if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'Authentication failed: Invalid Anon Key', latencyMs };
      }

      return {
        success: false,
        error: `Supabase returned HTTP ${response.status}: ${response.statusText}`,
        latencyMs,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to connect to Supabase endpoint', err);
      return { success: false, error: `Connection failed: ${msg}` };
    }
  }

  /**
   * Generates public storage URL for an asset path.
   */
  public getPublicStorageUrl(config: SupabaseConfig, path: string): string {
    const cleanUrl = this.normalizeUrl(config.url);
    const bucket = config.storageBucket || 'qa-reports';
    const cleanPath = path.replace(/^\/+/, '');
    return `${cleanUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
  }

  /**
   * Uploads an asset (HTML document, JSON file, or screenshot image) to Supabase Storage.
   */
  public async uploadStorageAsset(
    config: SupabaseConfig,
    path: string,
    data: Blob | string,
    contentType: string
  ): Promise<{ publicUrl: string; error?: string }> {
    const cleanUrl = this.normalizeUrl(config.url);
    const bucket = config.storageBucket || 'qa-reports';
    const cleanPath = path.replace(/^\/+/, '');
    const endpoint = `${cleanUrl}/storage/v1/object/${bucket}/${cleanPath}`;

    const body = typeof data === 'string' ? new Blob([data], { type: contentType }) : data;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: config.anonKey.trim(),
          Authorization: `Bearer ${config.anonKey.trim()}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(`Storage upload failed [HTTP ${response.status}]: ${errorText}`);
        return {
          publicUrl: '',
          error: `Storage upload failed (HTTP ${response.status}): ${errorText || response.statusText}`,
        };
      }

      const publicUrl = this.getPublicStorageUrl(config, cleanPath);
      logger.info(`Uploaded storage asset to ${publicUrl}`);
      return { publicUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Storage upload exception', err);
      return { publicUrl: '', error: `Storage network error: ${msg}` };
    }
  }

  /**
   * Inserts or upserts a report row into the `qa_reports` table.
   */
  public async insertReportRecord(
    config: SupabaseConfig,
    payload: CloudReportPayload
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const cleanUrl = this.normalizeUrl(config.url);
    const endpoint = `${cleanUrl}/rest/v1/qa_reports`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: config.anonKey.trim(),
          Authorization: `Bearer ${config.anonKey.trim()}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(`Report table insert failed [HTTP ${response.status}]: ${errorText}`);
        return {
          success: false,
          error: `Database insert failed (HTTP ${response.status}): ${errorText || response.statusText}`,
        };
      }

      const responseData = await response.json().catch(() => ({}));
      logger.info(`Report record inserted successfully into Supabase qa_reports table`);
      return { success: true, data: responseData };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Report table insert exception', err);
      return { success: false, error: `Database network error: ${msg}` };
    }
  }
}

export const supabaseClient = new SupabaseClient();
