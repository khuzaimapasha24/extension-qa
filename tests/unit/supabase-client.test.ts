import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabaseClient } from '../../src/cloud/supabase-client';
import { SupabaseConfig } from '../../src/shared/types/session';

describe('SupabaseClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const validConfig: SupabaseConfig = {
    enabled: true,
    url: 'https://testproject.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.mockSignatureValue123456789',
    storageBucket: 'qa-reports',
  };

  it('normalizes URLs and validates protocols', () => {
    expect(supabaseClient.normalizeUrl('  https://xyz.supabase.co///  ')).toBe('https://xyz.supabase.co');
    expect(supabaseClient.isValidUrl('https://xyz.supabase.co')).toBe(true);
    expect(supabaseClient.isValidUrl('ftp://invalid-url')).toBe(false);
    expect(supabaseClient.isValidUrl('not a url')).toBe(false);
  });

  it('validates testConnection inputs before initiating network calls', async () => {
    const invalidUrlRes = await supabaseClient.testConnection('invalid-url', 'short-key');
    expect(invalidUrlRes.success).toBe(false);
    expect(invalidUrlRes.error).toContain('Invalid Supabase URL');

    const shortKeyRes = await supabaseClient.testConnection('https://xyz.supabase.co', 'short');
    expect(shortKeyRes.success).toBe(false);
    expect(shortKeyRes.error).toContain('Invalid Supabase Anon Key');
  });

  it('verifies connection when endpoint returns HTTP 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const res = await supabaseClient.testConnection(validConfig.url, validConfig.anonKey);
    expect(res.success).toBe(true);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://testproject.supabase.co/rest/v1/',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: validConfig.anonKey,
          Authorization: `Bearer ${validConfig.anonKey}`,
        }),
      })
    );
  });

  it('handles HTTP 401 unauthorized gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const res = await supabaseClient.testConnection(validConfig.url, validConfig.anonKey);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid Anon Key');
  });

  it('computes correct public storage URLs', () => {
    const pubUrl = supabaseClient.getPublicStorageUrl(validConfig, 'reports/report_123.html');
    expect(pubUrl).toBe(
      'https://testproject.supabase.co/storage/v1/object/public/qa-reports/reports/report_123.html'
    );
  });

  it('uploads storage asset with proper headers and returns public URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{"Key":"qa-reports/reports/test.html"}'),
    } as Response);

    const uploadRes = await supabaseClient.uploadStorageAsset(
      validConfig,
      'reports/test.html',
      '<html>Test</html>',
      'text/html; charset=utf-8'
    );

    expect(uploadRes.error).toBeUndefined();
    expect(uploadRes.publicUrl).toContain(
      '/storage/v1/object/public/qa-reports/reports/test.html'
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://testproject.supabase.co/storage/v1/object/qa-reports/reports/test.html',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-upsert': 'true',
          'Content-Type': 'text/html; charset=utf-8',
        }),
      })
    );
  });

  it('inserts report record into qa_reports table', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve([{ id: 'rep_123' }]),
    } as Response);

    const insertRes = await supabaseClient.insertReportRecord(validConfig, {
      id: 'rep_123',
      session_id: 'sess_123',
      url: 'https://example.com',
      title: 'Test',
      overall_score: 95,
      quality_rating: 'EXCELLENT',
      tests_executed: 10,
      pages_scanned: 1,
      total_findings: 0,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      category_scores: {},
      findings_summary: [],
    });

    expect(insertRes.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://testproject.supabase.co/rest/v1/qa_reports',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Prefer: 'return=representation,resolution=merge-duplicates',
        }),
      })
    );
  });
});
