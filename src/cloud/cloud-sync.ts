import { SupabaseConfig } from '../shared/types/session';
import { QAReportData } from '../reporting/report-types';
import { generateHtmlReport } from '../reporting/html-generator';
import { generateJsonReport } from '../reporting/json-generator';
import { supabaseClient, CloudReportPayload } from './supabase-client';
import { ScreenshotEvidence } from '../shared/types/qa';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('CloudSyncEngine');

export interface CloudSyncResult {
  success: boolean;
  shareUrl?: string;
  htmlUrl?: string;
  jsonUrl?: string;
  reportId?: string;
  error?: string;
}

export class CloudSyncEngine {
  /**
   * Helper to convert Base64 data URL to a binary Blob.
   */
  public dataUrlToBlob(dataUrl: string): Blob | null {
    try {
      const parts = dataUrl.split(',');
      if (parts.length !== 2) return null;
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (err) {
      logger.error('Failed to convert data URL to Blob', err);
      return null;
    }
  }

  /**
   * Synchronizes an entire QA report and its evidence assets to Supabase Cloud.
   */
  public async syncReportToCloud(
    reportData: QAReportData,
    config: SupabaseConfig
  ): Promise<CloudSyncResult> {
    if (!config || !config.enabled) {
      return { success: false, error: 'Cloud sync is disabled in settings.' };
    }
    if (!config.url || !config.anonKey) {
      return { success: false, error: 'Supabase credentials not configured in settings.' };
    }

    const reportId = reportData.metadata.reportId;
    logger.info(`Initiating cloud sync for report: ${reportId}`);

    try {
      // 1. Upload screenshot evidence if present
      for (const finding of reportData.findings) {
        for (const evidence of finding.evidence) {
          if (evidence.type === 'screenshot' && typeof evidence.data === 'object') {
            const shotData = evidence.data as ScreenshotEvidence;
            if (shotData.dataUrl && shotData.dataUrl.startsWith('data:')) {
              const blob = this.dataUrlToBlob(shotData.dataUrl);
              if (blob) {
                const assetPath = `evidence/${reportId}/${finding.id}.png`;
                const uploadRes = await supabaseClient.uploadStorageAsset(
                  config,
                  assetPath,
                  blob,
                  'image/png'
                );
                if (uploadRes.publicUrl) {
                  // Replace base64 dataUrl with lightweight public cloud URL
                  shotData.dataUrl = uploadRes.publicUrl;
                }
              }
            }
          }
        }
      }

      // 2. Generate HTML and JSON documents
      const htmlContent = generateHtmlReport(reportData);
      const jsonContent = generateJsonReport(reportData);

      // 3. Upload standalone HTML report to Supabase Storage
      const htmlPath = `reports/${reportId}.html`;
      const htmlUpload = await supabaseClient.uploadStorageAsset(
        config,
        htmlPath,
        htmlContent,
        'text/html; charset=utf-8'
      );

      if (htmlUpload.error) {
        return { success: false, error: `Failed to upload HTML report: ${htmlUpload.error}` };
      }

      // 4. Upload machine-readable JSON report to Supabase Storage
      const jsonPath = `reports/${reportId}.json`;
      const jsonUpload = await supabaseClient.uploadStorageAsset(
        config,
        jsonPath,
        jsonContent,
        'application/json'
      );

      // 5. Insert structured report row in qa_reports table
      const cloudPayload: CloudReportPayload = {
        id: reportId,
        session_id: reportData.metadata.sessionId,
        url: reportData.metadata.url,
        title: reportData.metadata.title,
        overall_score: reportData.summary.overallScore,
        quality_rating: reportData.summary.rating,
        tests_executed: reportData.summary.testsExecuted,
        pages_scanned: reportData.summary.pagesScanned,
        total_findings: reportData.summary.totalFindings,
        critical_count: reportData.summary.criticalCount,
        high_count: reportData.summary.highCount,
        medium_count: reportData.summary.mediumCount,
        low_count: reportData.summary.lowCount,
        category_scores: reportData.scores.categoryScores as unknown as Record<string, unknown>,
        findings_summary: reportData.findings.map((f) => ({
          id: f.id,
          category: f.category,
          severity: f.severity,
          title: f.title,
          selector: f.selector,
          recommendation: f.recommendation,
        })),
        html_report_url: htmlUpload.publicUrl,
        json_report_url: jsonUpload.publicUrl,
        created_at: new Date(reportData.metadata.timestamp).toISOString(),
      };

      const tableRes = await supabaseClient.insertReportRecord(config, cloudPayload);
      if (!tableRes.success) {
        logger.warn(`Table insert failed, but storage assets were uploaded: ${tableRes.error}`);
      }

      // 6. Compute shareable URL
      let shareUrl = htmlUpload.publicUrl;
      if (config.shareableUrlPrefix) {
        const prefix = config.shareableUrlPrefix.replace(/\/+$/, '');
        shareUrl = `${prefix}/${reportId}`;
      }

      logger.info(`Cloud sync completed successfully. Share URL: ${shareUrl}`);
      return {
        success: true,
        shareUrl,
        htmlUrl: htmlUpload.publicUrl,
        jsonUrl: jsonUpload.publicUrl,
        reportId,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Cloud synchronization failed', err);
      return { success: false, error: `Cloud sync error: ${msg}` };
    }
  }
}

export const cloudSyncEngine = new CloudSyncEngine();
