import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BackendVerifier } from '../../src/qa/backend-verifier';
import { SupabaseConfig } from '../../src/shared/types/session';

describe('BackendVerifier', () => {
  let verifier: BackendVerifier;
  const mockConfig: SupabaseConfig = {
    enabled: true,
    url: 'https://xyz123.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key-1234567890',
    storageBucket: 'qa-reports',
  };

  beforeEach(() => {
    verifier = new BackendVerifier();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies existing Supabase record matching query target', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: 1, email: 'user@example.com', created_at: '2026-09-10T12:00:00Z' },
      ],
    });
    global.fetch = mockFetch;

    const result = await verifier.verifySupabaseRecord(mockConfig, {
      table: 'users',
      matchColumn: 'email',
      matchValue: 'user@example.com',
    });

    expect(result.verified).toBe(true);
    expect(result.matchedRecordCount).toBe(1);
    expect(result.records?.[0].email).toBe('user@example.com');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://xyz123.supabase.co/rest/v1/users?email=eq.user%40example.com&select=*',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          apikey: mockConfig.anonKey,
        }),
      })
    );
  });

  it('detects missing Supabase record when 0 rows match filter', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const result = await verifier.verifySupabaseRecord(mockConfig, {
      table: 'orders',
      matchColumn: 'order_id',
      matchValue: 'ORD-999',
    });

    expect(result.verified).toBe(false);
    expect(result.matchedRecordCount).toBe(0);
  });

  it('handles backend HTTP errors gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Table not found',
    });

    const result = await verifier.verifySupabaseRecord(mockConfig, {
      table: 'non_existent_table',
      matchColumn: 'id',
      matchValue: '1',
    });

    expect(result.verified).toBe(false);
    expect(result.error).toContain('Database HTTP 404');
  });

  it('generates a CRITICAL finding when expected backend record is missing', () => {
    const findings = verifier.generateFindings(
      {
        verified: false,
        table: 'orders',
        queryFilter: 'email=eq.test%40example.com',
        matchedRecordCount: 0,
        latencyMs: 120,
      },
      'sess-test-123',
      'https://store.example.com/checkout',
      'Checkout Form Submission'
    );

    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('CRITICAL');
    expect(findings[0].title).toContain('[Backend Data Integrity] Missing Database Record in "orders"');
    expect(findings[0].description).toContain('silent database failure');
  });

  it('returns no findings when record is successfully verified', () => {
    const findings = verifier.generateFindings(
      {
        verified: true,
        table: 'users',
        queryFilter: 'email=eq.test%40example.com',
        matchedRecordCount: 1,
        latencyMs: 85,
      },
      'sess-test-123',
      'https://store.example.com/signup',
      'User Registration'
    );

    expect(findings.length).toBe(0);
  });
});
