import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reportEngine } from '../../src/reporting/report-engine';
import { dbClient } from '../../src/storage/indexed-db';
import { QASession } from '../../src/shared/types/session';
import { Finding } from '../../src/shared/types/qa';
import { DEFAULT_SESSION_CONFIG } from '../../src/shared/constants/defaults';

describe('ReportEngine', () => {
  beforeEach(async () => {
    await dbClient.clear('reports');
  });

  const mockSession: QASession = {
    id: 'sess_engine_test',
    tabId: 101,
    url: 'https://example.com/shop',
    origin: 'https://example.com',
    title: 'Acme SuperStore',
    startTime: 1720000000000,
    endTime: 1720000060000,
    state: 'COMPLETED',
    progress: 100,
    currentAction: 'Audit complete',
    config: DEFAULT_SESSION_CONFIG,
    stats: {
      pagesDiscovered: 4,
      pagesCrawled: 4,
      elementsDiscovered: 50,
      testsExecuted: 32,
      passedCount: 29,
      failedCount: 2,
      warningsCount: 1,
      criticalBugsCount: 1,
    },
  };

  const mockFindings: Finding[] = [
    {
      id: 'f_crit_1',
      sessionId: 'sess_engine_test',
      category: 'FUNCTIONAL',
      severity: 'CRITICAL',
      title: 'Checkout button crashes page',
      description: 'Unhandled TypeError on submit',
      page: 'https://example.com/shop',
      selector: 'button#pay',
      steps: ['Click pay'],
      expected: 'Confirmation modal',
      actual: 'White screen crash',
      confidence: 1.0,
      timestamp: 1720000001000,
      retestCount: 1,
      status: 'FAIL',
      evidence: [],
      recommendation: 'Catch unhandled exception',
    },
    {
      id: 'f_high_1',
      sessionId: 'sess_engine_test',
      category: 'NETWORK',
      severity: 'HIGH',
      title: 'Failed API call /api/cart',
      description: 'Endpoint returns HTTP 500',
      page: 'https://example.com/shop',
      steps: ['Add item to cart'],
      expected: 'HTTP 200',
      actual: 'HTTP 500 Internal Server Error',
      confidence: 0.95,
      timestamp: 1720000002000,
      retestCount: 0,
      status: 'FAIL',
      evidence: [],
      recommendation: 'Fix 500 internal server error',
    },
    {
      id: 'f_low_1',
      sessionId: 'sess_engine_test',
      category: 'SEO',
      severity: 'LOW',
      title: 'Meta description slightly short',
      description: 'Length is 45 chars; recommended >= 50',
      page: 'https://example.com/shop',
      steps: ['Inspect meta description tag'],
      expected: '50-160 characters',
      actual: '45 characters',
      confidence: 0.9,
      timestamp: 1720000003000,
      retestCount: 0,
      status: 'WARNING',
      evidence: [],
      recommendation: 'Add longer meta description',
    },
  ];

  it('compiles comprehensive report data with correct summary counts and rating', () => {
    const reportData = reportEngine.buildReportData(mockSession, mockFindings);

    expect(reportData.metadata.reportId).toBe('report_sess_engine_test');
    expect(reportData.metadata.sessionId).toBe('sess_engine_test');
    expect(reportData.metadata.durationMs).toBe(60000);
    expect(reportData.metadata.url).toBe('https://example.com/shop');

    expect(reportData.summary.totalFindings).toBe(3);
    expect(reportData.summary.criticalCount).toBe(1);
    expect(reportData.summary.highCount).toBe(1);
    expect(reportData.summary.lowCount).toBe(1);
    expect(reportData.summary.mediumCount).toBe(0);

    // Defect penalties calculated across category weights (35 penalty in 25% weighted category + 20 in 10% + 4 in 10%)
    expect(reportData.summary.overallScore).toBe(89);
    expect(reportData.summary.rating).toBe('GOOD');
  });

  it('formats report data across JSON, Markdown, and HTML formats', () => {
    const reportData = reportEngine.buildReportData(mockSession, mockFindings);

    const json = reportEngine.formatReport(reportData, 'JSON');
    expect(json).toContain('"generator"');
    expect(JSON.parse(json).findings).toHaveLength(3);

    const md = reportEngine.formatReport(reportData, 'MARKDOWN');
    expect(md).toContain('# 🛡️ QA Audit Report: Acme SuperStore');
    expect(md).toContain('Checkout button crashes page');

    const html = reportEngine.formatReport(reportData, 'HTML');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Checkout button crashes page');

    const pdfHtml = reportEngine.formatReport(reportData, 'PDF');
    expect(pdfHtml).toContain('@media print');

    const playwrightCode = reportEngine.formatReport(reportData, 'PLAYWRIGHT');
    expect(playwrightCode).toContain("import { test, expect } from '@playwright/test';");
    expect(playwrightCode).toContain('Acme SuperStore');

    const cypressCode = reportEngine.formatReport(reportData, 'CYPRESS');
    expect(cypressCode).toContain('/// <reference types="cypress" />');
    expect(cypressCode).toContain('Acme SuperStore');

    const githubActionsYaml = reportEngine.formatReport(reportData, 'GITHUB_ACTIONS');
    expect(githubActionsYaml).toContain('name: AI QA Autonomous E2E Pipeline');

    const githubPrBody = reportEngine.formatReport(reportData, 'GITHUB_PR');
    expect(githubPrBody).toContain('Autonomous QA Agent: Automated Fix Proposal');
    expect(githubPrBody).toContain('**Total Defects Addressed** | 3');

    const unifiedPatch = reportEngine.formatReport(reportData, 'UNIFIED_PATCH');
    expect(unifiedPatch).toContain('# Autonomous QA Engineering Patch Bundle');
    expect(unifiedPatch).toContain('--- a/');
  });

  it('saves report record to IndexedDB and retrieves it', async () => {
    const reportData = reportEngine.buildReportData(mockSession, mockFindings);

    const savedRecord = await reportEngine.saveReport(reportData);
    expect(savedRecord.id).toBe('report_sess_engine_test');
    expect(savedRecord.sessionId).toBe('sess_engine_test');
    expect(savedRecord.htmlContent).toContain('<!DOCTYPE html>');
    expect(savedRecord.markdownData).toContain('# 🛡️ QA Audit Report');

    const retrieved = await dbClient.get('reports', 'report_sess_engine_test');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('report_sess_engine_test');
  });

  it('safely handles browser download trigger', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    reportEngine.downloadFile('{"test":true}', 'test-report.json', 'application/json');

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
