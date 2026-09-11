import { SupabaseConfig } from '../shared/types/session';
import { Finding } from '../shared/types/qa';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('BackendVerifier');

export interface BackendQueryTarget {
  table: string;
  matchColumn: string;
  matchValue: string | number;
  timeWindowMs?: number;
}

export interface BackendVerificationResult {
  verified: boolean;
  table: string;
  queryFilter: string;
  matchedRecordCount: number;
  records?: Record<string, unknown>[];
  latencyMs: number;
  error?: string;
}

export class BackendVerifier {
  /**
   * Queries a Supabase PostgREST table to verify record insertion after frontend mutations.
   */
  public async verifySupabaseRecord(
    config: SupabaseConfig,
    target: BackendQueryTarget
  ): Promise<BackendVerificationResult> {
    const start = Date.now();
    const cleanUrl = config.url ? config.url.trim().replace(/\/+$/, '') : '';

    if (!cleanUrl || !config.anonKey) {
      return {
        verified: false,
        table: target.table,
        queryFilter: `${target.matchColumn}=eq.${target.matchValue}`,
        matchedRecordCount: 0,
        latencyMs: 0,
        error: 'Supabase URL or Anon Key is missing in session configuration.',
      };
    }

    const filter = `${encodeURIComponent(target.matchColumn)}=eq.${encodeURIComponent(String(target.matchValue))}`;
    const endpoint = `${cleanUrl}/rest/v1/${encodeURIComponent(target.table)}?${filter}&select=*`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: config.anonKey.trim(),
          Authorization: `Bearer ${config.anonKey.trim()}`,
          Accept: 'application/json',
        },
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(`Supabase query failed with status ${response.status}: ${errorText}`);
        return {
          verified: false,
          table: target.table,
          queryFilter: filter,
          matchedRecordCount: 0,
          latencyMs,
          error: `Database HTTP ${response.status}: ${errorText || response.statusText}`,
        };
      }

      const data = await response.json();
      const records = Array.isArray(data) ? data : [];
      const verified = records.length > 0;

      logger.info(
        `Backend check on table "${target.table}" returned ${records.length} records in ${latencyMs}ms.`
      );

      return {
        verified,
        table: target.table,
        queryFilter: filter,
        matchedRecordCount: records.length,
        records,
        latencyMs,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to query Supabase backend', err);
      return {
        verified: false,
        table: target.table,
        queryFilter: filter,
        matchedRecordCount: 0,
        latencyMs: Date.now() - start,
        error: `Network error querying backend: ${msg}`,
      };
    }
  }

  /**
   * Queries an arbitrary REST API endpoint to verify record persistence.
   */
  public async verifyRestEndpoint(
    endpointUrl: string,
    headers: Record<string, string>,
    target: BackendQueryTarget
  ): Promise<BackendVerificationResult> {
    const start = Date.now();
    try {
      const url = new URL(endpointUrl);
      url.searchParams.set(target.matchColumn, String(target.matchValue));

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...headers,
        },
      });

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return {
          verified: false,
          table: target.table,
          queryFilter: `${target.matchColumn}=${target.matchValue}`,
          matchedRecordCount: 0,
          latencyMs,
          error: `REST HTTP ${res.status}: ${res.statusText}`,
        };
      }

      const body = await res.json();
      let records: Record<string, unknown>[] = [];
      if (Array.isArray(body)) {
        records = body;
      } else if (body && typeof body === 'object') {
        records = Array.isArray(body.data) ? body.data : [body];
      }

      return {
        verified: records.length > 0,
        table: target.table,
        queryFilter: `${target.matchColumn}=${target.matchValue}`,
        matchedRecordCount: records.length,
        records,
        latencyMs,
      };
    } catch (err) {
      return {
        verified: false,
        table: target.table,
        queryFilter: `${target.matchColumn}=${target.matchValue}`,
        matchedRecordCount: 0,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Produces critical findings if expected backend records are absent after a successful UI operation.
   */
  public generateFindings(
    result: BackendVerificationResult,
    sessionId: string,
    pageUrl: string,
    actionName: string
  ): Finding[] {
    if (result.verified) {
      return [];
    }

    const findingId = `finding_backend_${sessionId}_${result.table}_${Date.now()}`;
    const desc = result.error
      ? `Backend verification query on table "${result.table}" failed: ${result.error}. Could not confirm database write for ${actionName}.`
      : `Frontend action "${actionName}" succeeded in the UI, but 0 matching records were found in backend table "${result.table}" for filter (${result.queryFilter}). This indicates a silent database failure, dropped webhook, or mock-only frontend state.`;

    return [
      {
        id: findingId,
        sessionId,
        category: 'FUNCTIONAL',
        severity: 'CRITICAL',
        status: 'WARNING',
        confidence: 0.95,
        title: `[Backend Data Integrity] Missing Database Record in "${result.table}" after ${actionName}`,
        description: desc,
        page: pageUrl,
        steps: [
          `Navigate to ${pageUrl}`,
          `Execute mutation action: ${actionName}`,
          `Observe UI indicates success`,
          `Query backend table "${result.table}" with filter: ${result.queryFilter}`,
        ],
        expected: `Target record must be persisted in table "${result.table}" within normal latency thresholds.`,
        actual: `No matching record found in backend table "${result.table}" (matched: 0 records).`,
        recommendation: `Inspect backend API controller for table "${result.table}", ensure database transactions commit properly, and verify error handling alerts user when DB insertion fails.`,
        evidence: [
          {
            type: 'network_error',
            description: 'Backend verification query result',
            data: result as unknown as Record<string, unknown>,
            timestamp: Date.now(),
          },
        ],
        retestCount: 0,
        timestamp: Date.now(),
      },
    ];
  }
}

export const backendVerifier = new BackendVerifier();
