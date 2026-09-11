import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloudSyncEngine } from '../../src/cloud/cloud-sync';
import { supabaseClient } from '../../src/cloud/supabase-client';
import { QAReportData } from '../../src/reporting/report-types';
import { SupabaseConfig } from '../../src/shared/types/session';

describe('CloudSyncEngine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validConfig: SupabaseConfig = {
    enabled: true,
    url: 'https://testproject.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.mockSignatureValue123456789',
    storageBucket: 'qa-reports',
  };

  const sampleReportData: QAReportData = {
    metadata: {
      reportId: 'rep_cloud_123',
      sessionId: 'sess_cloud_123',
      url: 'https://example.com',
      title: 'Sample Site',
      timestamp: 1720000000000,
      formattedDate: 'Sep 10, 2026, 03:00',
      durationMs: 35000,
      engineVersion: '0.8.0',
    },
    summary: {
      overallScore: 94,
      rating: 'EXCELLENT',
      totalFindings: 1,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
      testsExecuted: 20,
      pagesScanned: 2,
      elementsScanned: 40,
    },
    scores: {
      overallScore: 94,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
      categoryScores: {
        ACCESSIBILITY: {
          category: 'ACCESSIBILITY',
          testsCount: 10,
          score: 90,
          weight: 15,
          passedCount: 9,
          failedCount: 1,
          warningsCount: 0,
        },
      } as any,
    },
    findings: [
      {
        id: 'f_img_1',
        sessionId: 'sess_cloud_123',
        category: 'ACCESSIBILITY',
        severity: 'MEDIUM',
        title: 'Missing image alt attribute',
        description: 'Image missing descriptive alt attribute',
        page: 'https://example.com',
        selector: 'img.logo',
        steps: ['Inspect logo'],
        expected: 'alt attribute defined',
        actual: 'alt attribute missing',
        confidence: 1.0,
        timestamp: 1720000001000,
        retestCount: 0,
        status: 'WARNING',
        evidence: [
          {
            type: 'screenshot',
            description: 'Screenshot of uncaptioned logo',
            timestamp: 1720000001000,
            data: {
              dataUrl:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              width: 1,
              height: 1,
              isElementCrop: true,
            },
          },
        ],
        recommendation: 'Add alt="Company Logo"',
      },
    ],
  };

  it('converts valid base64 data URLs to Blobs correctly', () => {
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = cloudSyncEngine.dataUrlToBlob(dataUrl);

    expect(blob).toBeDefined();
    expect(blob?.type).toBe('image/png');
    expect(blob?.size).toBeGreaterThan(0);
  });

  it('handles invalid or corrupt data URLs safely', () => {
    expect(cloudSyncEngine.dataUrlToBlob('invalid-data-url')).toBeNull();
    expect(cloudSyncEngine.dataUrlToBlob('data:image/png;base64,!!!corrupt')).toBeNull();
  });

  it('rejects cloud sync when config is disabled or incomplete', async () => {
    const disabledRes = await cloudSyncEngine.syncReportToCloud(sampleReportData, {
      ...validConfig,
      enabled: false,
    });
    expect(disabledRes.success).toBe(false);
    expect(disabledRes.error).toContain('disabled');

    const noCredsRes = await cloudSyncEngine.syncReportToCloud(sampleReportData, {
      enabled: true,
      url: '',
      anonKey: '',
    });
    expect(noCredsRes.success).toBe(false);
    expect(noCredsRes.error).toContain('credentials not configured');
  });

  it('orchestrates complete cloud sync workflow and returns shareable URL', async () => {
    vi.spyOn(supabaseClient, 'uploadStorageAsset').mockImplementation(
      async (_cfg, path) => ({
        publicUrl: `https://testproject.supabase.co/storage/v1/object/public/qa-reports/${path}`,
      })
    );

    vi.spyOn(supabaseClient, 'insertReportRecord').mockResolvedValue({
      success: true,
    });

    const result = await cloudSyncEngine.syncReportToCloud(sampleReportData, validConfig);

    expect(result.success).toBe(true);
    expect(result.reportId).toBe('rep_cloud_123');
    expect(result.htmlUrl).toContain('/reports/rep_cloud_123.html');
    expect(result.jsonUrl).toContain('/reports/rep_cloud_123.json');
    expect(result.shareUrl).toBe(result.htmlUrl);

    // Screenshot dataUrl was replaced by cloud public URL
    const findingShot = sampleReportData.findings[0].evidence[0].data as any;
    expect(findingShot.dataUrl).toContain('https://testproject.supabase.co/storage/v1/object/public/qa-reports/evidence/');
  });

  it('uses custom shareableUrlPrefix when configured', async () => {
    vi.spyOn(supabaseClient, 'uploadStorageAsset').mockImplementation(
      async (_cfg, path) => ({
        publicUrl: `https://testproject.supabase.co/storage/v1/object/public/qa-reports/${path}`,
      })
    );

    vi.spyOn(supabaseClient, 'insertReportRecord').mockResolvedValue({
      success: true,
    });

    const customConfig: SupabaseConfig = {
      ...validConfig,
      shareableUrlPrefix: 'https://dashboard.example.com/reports',
    };

    const result = await cloudSyncEngine.syncReportToCloud(sampleReportData, customConfig);

    expect(result.success).toBe(true);
    expect(result.shareUrl).toBe('https://dashboard.example.com/reports/rep_cloud_123');
  });
});
