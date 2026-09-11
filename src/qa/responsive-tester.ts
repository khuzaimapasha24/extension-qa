import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';

export interface ViewportProfile {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORT_PROFILES: ViewportProfile[] = [
  { name: 'Mobile (iPhone SE)', width: 375, height: 667 },
  { name: 'Mobile (iPhone 14)', width: 390, height: 844 },
  { name: 'Tablet (iPad Mini)', width: 768, height: 1024 },
  { name: 'Small Laptop', width: 1024, height: 768 },
  { name: 'Standard Desktop', width: 1366, height: 768 },
  { name: 'Full HD Monitor', width: 1920, height: 1080 },
];

export function testResponsive(snapshot: PageSnapshot, sessionId: string): Finding[] {
  const findings: Finding[] = [];
  const meta = snapshot.metadata;

  // 1. Missing viewport meta tag
  if (!meta.viewport) {
    findings.push({
      id: `resp_no_viewport_${Date.now()}`,
      sessionId,
      category: 'RESPONSIVE',
      title: 'Missing mobile viewport meta tag',
      description: 'Document does not define a meta name="viewport", causing mobile browsers to render at desktop 980px zoom.',
      status: 'FAIL',
      severity: 'CRITICAL',
      confidence: 1.0,
      page: snapshot.pathname,
      evidence: [],
      steps: ['Inspect <head> for meta[name="viewport"]'],
      expected: '<meta name="viewport" content="width=device-width, initial-scale=1.0"> must be present.',
      actual: 'No viewport meta tag found.',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> to <head>.',
      retestCount: 0,
      timestamp: Date.now(),
    });
  } else if (!meta.viewport.includes('width=device-width')) {
    findings.push({
      id: `resp_bad_viewport_${Date.now()}`,
      sessionId,
      category: 'RESPONSIVE',
      title: 'Suboptimal viewport configuration',
      description: `Viewport content "${meta.viewport}" does not include width=device-width, which may cause layout scaling issues.`,
      status: 'WARNING',
      severity: 'MEDIUM',
      confidence: 0.9,
      page: snapshot.pathname,
      evidence: [{ type: 'dom_snippet', description: 'Viewport meta tag', data: meta.viewport, timestamp: Date.now() }],
      steps: ['Inspect meta[name="viewport"] content attribute'],
      expected: 'Viewport should contain "width=device-width, initial-scale=1.0".',
      actual: meta.viewport,
      recommendation: 'Update viewport meta tag to standard responsive definition.',
      retestCount: 0,
      timestamp: Date.now(),
    });
  }

  return findings;
}
