import { describe, it, expect } from 'vitest';
import { generateHtmlReport } from '../../src/reporting/html-generator';
import { QAReportData } from '../../src/reporting/report-types';

describe('HTML Report Generator', () => {
  const sampleData: QAReportData = {
    metadata: {
      reportId: 'rep_html_1',
      sessionId: 'sess_html_1',
      url: 'https://example.com/app',
      title: 'Demo Web App',
      timestamp: 1720000000000,
      formattedDate: 'Sep 10, 2026, 03:00',
      durationMs: 60000,
      engineVersion: '0.7.0',
    },
    summary: {
      overallScore: 92,
      rating: 'EXCELLENT',
      totalFindings: 1,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
      testsExecuted: 40,
      pagesScanned: 3,
      elementsScanned: 85,
    },
    scores: {
      overallScore: 92,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
      categoryScores: {
        ACCESSIBILITY: {
          category: 'ACCESSIBILITY',
          testsCount: 11,
          score: 90,
          weight: 15,
          passedCount: 10,
          failedCount: 1,
          warningsCount: 0,
        },
        PERFORMANCE: {
          category: 'PERFORMANCE',
          testsCount: 8,
          score: 95,
          weight: 15,
          passedCount: 8,
          failedCount: 0,
          warningsCount: 0,
        },
      } as any,
    },
    findings: [
      {
        id: 'f_contrast_1',
        sessionId: 'sess_html_1',
        category: 'ACCESSIBILITY',
        severity: 'MEDIUM',
        title: 'Insufficient text contrast in <button>',
        description: 'Contrast ratio 3.2:1 fails WCAG AA minimum 4.5:1',
        page: 'https://example.com/app',
        selector: 'button.secondary',
        steps: ['Inspect secondary CTA'],
        expected: 'Contrast ratio >= 4.5:1',
        actual: 'Contrast ratio 3.2:1',
        confidence: 0.98,
        timestamp: 1720000005000,
        retestCount: 0,
        status: 'FAIL',
        evidence: [
          {
            type: 'screenshot',
            description: 'Visual evidence of low contrast CTA',
            timestamp: 1720000005000,
            data: {
              dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              highlightBox: { x: 10, y: 20, width: 100, height: 40 },
              devicePixelRatio: 2,
            },
          },
        ],
        recommendation: 'Change text color to #1e293b to achieve 5.8:1 contrast',
      },
    ],
  };

  it('generates self-contained HTML with doctype, head, and styling', () => {
    const html = generateHtmlReport(sampleData);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<style>');
    expect(html).toContain('@media print');
    expect(html).toContain('Demo Web App');
    expect(html).toContain('https://example.com/app');
  });

  it('renders overall score gauge and rating badge', () => {
    const html = generateHtmlReport(sampleData);

    expect(html).toContain('92');
    expect(html).toContain('EXCELLENT');
    expect(html).toContain('Tests Executed');
    expect(html).toContain('40');
  });

  it('renders findings cards with screenshot evidence and recommendation', () => {
    const html = generateHtmlReport(sampleData);

    expect(html).toContain('badge-medium');
    expect(html).toContain('Insufficient text contrast in &lt;button&gt;');
    expect(html).toContain('button.secondary');
    expect(html).toContain('Recommended Fix:');
    expect(html).toContain('Change text color to #1e293b');
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo');
  });

  it('escapes potentially dangerous HTML characters in titles and descriptions', () => {
    const xssData: QAReportData = {
      ...sampleData,
      metadata: {
        ...sampleData.metadata,
        title: '<script>alert("xss")</script>',
      },
      findings: [
        {
          id: 'f_xss',
          category: 'SECURITY' as any,
          severity: 'HIGH',
          title: '<img src=x onerror=alert(1)>',
          description: 'Payload with "quotes" & <tags>',
          page: 'https://example.com/<script>',
          steps: ['Step 1 <tag>'],
          expected: 'Safe <output>',
          actual: 'Vulnerable <content>',
          confidence: 1,
          timestamp: 1720000000000,
          retestCount: 0,
          sessionId: 'sess_html_1',
          status: 'FAIL',
          evidence: [],
          recommendation: 'Sanitize user inputs',
        },
      ],
    };

    const html = generateHtmlReport(xssData);

    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;quotes&quot; &amp; &lt;tags&gt;');
  });

  it('shows celebratory zero defects banner when findings list is empty', () => {
    const cleanData: QAReportData = {
      ...sampleData,
      summary: {
        ...sampleData.summary,
        totalFindings: 0,
        mediumCount: 0,
      },
      findings: [],
    };

    const html = generateHtmlReport(cleanData);
    expect(html).toContain('Zero Defects Detected');
    expect(html).toContain('passed with flying colors');
  });
});
