import { describe, it, expect } from 'vitest';
import { generateJsonReport } from '../../src/reporting/json-generator';
import { QAReportData } from '../../src/reporting/report-types';
import { Finding } from '../../src/shared/types/qa';

describe('JSON Report Generator', () => {
  const mockFindings: Finding[] = [
    {
      id: 'f_btn_1',
      sessionId: 'sess_123',
      category: 'FUNCTIONAL',
      severity: 'HIGH',
      title: 'Unresponsive Submit Button',
      description: 'Clicking submit triggers no network requests or DOM mutations',
      page: 'https://example.com/checkout',
      selector: 'button#checkout-btn',
      steps: ['Navigate to checkout', 'Click button#checkout-btn'],
      expected: 'Form submission or validation errors',
      actual: 'No visual or network activity',
      confidence: 0.95,
      timestamp: 1720000001000,
      retestCount: 1,
      status: 'FAIL',
      evidence: [
        {
          type: 'dom_snippet',
          description: 'DOM snippet for checkout button',
          timestamp: 1720000001000,
          data: { html: '<button id="checkout-btn">Checkout</button>' },
        },
      ],
      recommendation: 'Add onClick handler and bind submit dispatch',
    },
    {
      id: 'f_a11y_1',
      sessionId: 'sess_123',
      category: 'ACCESSIBILITY',
      severity: 'MEDIUM',
      title: 'Image missing alt text',
      description: 'Audit discovered <img> without alt attribute',
      page: 'https://example.com/checkout',
      selector: 'img.hero',
      steps: ['Inspect hero image'],
      expected: 'Meaningful alt description',
      actual: 'Empty or missing alt attribute',
      confidence: 1.0,
      timestamp: 1720000002000,
      retestCount: 0,
      status: 'WARNING',
      evidence: [],
      recommendation: 'Add alt attribute',
    },
  ];

  const mockReportData: QAReportData = {
    metadata: {
      reportId: 'report_sess_123',
      sessionId: 'sess_123',
      url: 'https://example.com/checkout',
      title: 'Checkout Flow',
      timestamp: 1720000000000,
      formattedDate: 'Sep 10, 2026, 02:00',
      durationMs: 45000,
      engineVersion: '0.7.0',
    },
    summary: {
      overallScore: 78,
      rating: 'GOOD',
      totalFindings: 2,
      criticalCount: 0,
      highCount: 1,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
      testsExecuted: 24,
      pagesScanned: 1,
      elementsScanned: 15,
    },
    scores: {
      overallScore: 78,
      criticalCount: 0,
      highCount: 1,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
      categoryScores: {
        FUNCTIONAL: {
          category: 'FUNCTIONAL',
          testsCount: 5,
          score: 70,
          weight: 25,
          passedCount: 4,
          failedCount: 1,
          warningsCount: 0,
        },
        ACCESSIBILITY: {
          category: 'ACCESSIBILITY',
          testsCount: 7,
          score: 85,
          weight: 15,
          passedCount: 5,
          failedCount: 1,
          warningsCount: 1,
        },
      } as any,
    },
    findings: mockFindings,
  };

  it('generates valid parseable JSON', () => {
    const rawJson = generateJsonReport(mockReportData);
    expect(() => JSON.parse(rawJson)).not.toThrow();
  });

  it('includes schema, metadata, and target information', () => {
    const rawJson = generateJsonReport(mockReportData);
    const parsed = JSON.parse(rawJson);

    expect(parsed.$schema).toContain('qa-report.json');
    expect(parsed.generator.name).toBe('AI Website QA Agent');
    expect(parsed.generator.version).toBe('0.7.0');
    expect(parsed.target.url).toBe('https://example.com/checkout');
    expect(parsed.target.title).toBe('Checkout Flow');
  });

  it('correctly maps executive summary and category scores', () => {
    const rawJson = generateJsonReport(mockReportData);
    const parsed = JSON.parse(rawJson);

    expect(parsed.executiveSummary.overallScore).toBe(78);
    expect(parsed.executiveSummary.rating).toBe('GOOD');
    expect(parsed.executiveSummary.findingsBreakdown.total).toBe(2);
    expect(parsed.executiveSummary.findingsBreakdown.high).toBe(1);
    expect(parsed.executiveSummary.findingsBreakdown.medium).toBe(1);
    expect(parsed.executiveSummary.categoryScores.FUNCTIONAL.score).toBe(70);
    expect(parsed.executiveSummary.categoryScores.ACCESSIBILITY.score).toBe(85);
  });

  it('maps all findings with reproducibility, steps, and recommendations', () => {
    const rawJson = generateJsonReport(mockReportData);
    const parsed = JSON.parse(rawJson);

    expect(parsed.findings).toHaveLength(2);
    const first = parsed.findings[0];
    expect(first.id).toBe('f_btn_1');
    expect(first.category).toBe('FUNCTIONAL');
    expect(first.severity).toBe('HIGH');
    expect(first.selector).toBe('button#checkout-btn');
    expect(first.stepsToReproduce).toEqual(['Navigate to checkout', 'Click button#checkout-btn']);
    expect(first.recommendation).toBe('Add onClick handler and bind submit dispatch');
  });
});
