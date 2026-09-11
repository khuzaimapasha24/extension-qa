import { describe, it, expect } from 'vitest';
import { generateMarkdownReport } from '../../src/reporting/markdown-generator';
import { QAReportData } from '../../src/reporting/report-types';

describe('Markdown Report Generator', () => {
  const sampleData: QAReportData = {
    metadata: {
      reportId: 'rep_001',
      sessionId: 'sess_001',
      url: 'https://mysite.com',
      title: 'My Store',
      timestamp: 1720000000000,
      formattedDate: 'Sep 10, 2026, 02:30',
      durationMs: 30000,
      engineVersion: '0.7.0',
    },
    summary: {
      overallScore: 82,
      rating: 'GOOD',
      totalFindings: 1,
      criticalCount: 0,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      testsExecuted: 18,
      pagesScanned: 2,
      elementsScanned: 30,
    },
    scores: {
      overallScore: 82,
      criticalCount: 0,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      categoryScores: {
        FUNCTIONAL: {
          category: 'FUNCTIONAL',
          testsCount: 4,
          score: 75,
          weight: 25,
          passedCount: 3,
          failedCount: 1,
          warningsCount: 0,
        },
        SEO: {
          category: 'SEO',
          testsCount: 5,
          score: 95,
          weight: 10,
          passedCount: 5,
          failedCount: 0,
          warningsCount: 0,
        },
      } as any,
    },
    findings: [
      {
        id: 'f_nav_1',
        sessionId: 'sess_001',
        category: 'FUNCTIONAL',
        severity: 'HIGH',
        title: 'Broken Navigation Link',
        description: 'Anchor points to 404 dead link',
        page: 'https://mysite.com/products',
        selector: 'nav a.featured',
        steps: ['Click featured products link'],
        expected: 'HTTP 200 OK',
        actual: 'HTTP 404 Not Found',
        confidence: 0.99,
        timestamp: 1720000000000,
        retestCount: 1,
        status: 'FAIL',
        evidence: [],
        recommendation: 'Update href to point to valid collection URL',
      },
    ],
  };

  it('generates markdown with report headers and target link', () => {
    const md = generateMarkdownReport(sampleData);

    expect(md).toContain('# 🛡️ QA Audit Report: My Store');
    expect(md).toContain('> **Target**: [https://mysite.com](https://mysite.com)');
    expect(md).toContain('**Engine**: AI QA Agent v0.7.0');
  });

  it('renders executive summary and defect breakdown', () => {
    const md = generateMarkdownReport(sampleData);

    expect(md).toContain('## 📊 Executive Summary');
    expect(md).toContain('| **82 / 100** |');
    expect(md).toContain('- **High Severity**: 1 🟠');
    expect(md).toContain('- **Total Findings**: 1');
  });

  it('renders category scores table', () => {
    const md = generateMarkdownReport(sampleData);

    expect(md).toContain('### 📈 Category Breakdown');
    expect(md).toContain('| Category | Score | Weight | Passed | Failed | Warnings |');
    expect(md).toContain('**FUNCTIONAL** | 75% | 25% | 3 | 1 | 0 |');
    expect(md).toContain('**SEO** | 95% | 10% | 5 | 0 | 0 |');
  });

  it('formats finding details with selector, steps, and recommendations', () => {
    const md = generateMarkdownReport(sampleData);

    expect(md).toContain('## 🔍 Detected Findings (1)');
    expect(md).toContain('#### [🟠 HIGH] Broken Navigation Link');
    expect(md).toContain('- **Target Element**: `nav a.featured`');
    expect(md).toContain('- **Page Route**: `https://mysite.com/products`');
    expect(md).toContain('💡 **Remediation Recommendation**:');
    expect(md).toContain('> Update href to point to valid collection URL');
  });

  it('outputs celebration message when zero findings are detected', () => {
    const cleanData: QAReportData = {
      ...sampleData,
      summary: {
        ...sampleData.summary,
        totalFindings: 0,
        highCount: 0,
      },
      findings: [],
    };

    const md = generateMarkdownReport(cleanData);
    expect(md).toContain('🎉 **Zero defects detected!');
  });
});
