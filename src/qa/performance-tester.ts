import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';

export function testPerformance(snapshot: PageSnapshot, sessionId: string): Finding[] {
  const findings: Finding[] = [];

  // 1. High interactive element density
  if (snapshot.totalInteractiveCount > 250) {
    findings.push({
      id: `perf_high_interactive_${Date.now()}`,
      sessionId,
      category: 'PERFORMANCE',
      title: `High interactive element density (${snapshot.totalInteractiveCount} controls)`,
      description: `Page renders ${snapshot.totalInteractiveCount} interactive controls (links, buttons, forms). Excessive controls inflate DOM size and impact INP.`,
      status: 'WARNING',
      severity: 'MEDIUM',
      confidence: 0.88,
      page: snapshot.pathname,
      evidence: [{
        type: 'metric',
        description: 'Interactive element count',
        data: snapshot.totalInteractiveCount,
        timestamp: Date.now(),
      }],
      steps: ['Count total interactive controls in snapshot'],
      expected: 'Clean UI pages typically feature under 150 interactive controls.',
      actual: `${snapshot.totalInteractiveCount} controls detected.`,
      recommendation: 'Implement virtualization or pagination to reduce initial DOM element count.',
      retestCount: 0,
      timestamp: Date.now(),
    });
  }

  // 2. Oversized / unoptimized images without lazy loading
  for (const img of snapshot.images) {
    if ((img.naturalWidth > 1800 || img.naturalHeight > 1800) && img.loading !== 'lazy') {
      findings.push({
        id: `perf_large_img_${findings.length + 1}_${Date.now()}`,
        sessionId,
        category: 'PERFORMANCE',
        title: 'Large image rendered without lazy loading',
        description: `Image natural dimensions are ${img.naturalWidth}x${img.naturalHeight}px without loading="lazy", degrading LCP.`,
        status: 'WARNING',
        severity: 'MEDIUM',
        confidence: 0.9,
        page: snapshot.pathname,
        element: img.selector,
        selector: img.selector,
        evidence: [{
          type: 'metric',
          description: 'Image dimensions',
          data: `${img.naturalWidth}x${img.naturalHeight}px`,
          timestamp: Date.now(),
        }],
        steps: [`Inspect image ${img.selector}`, 'Check naturalWidth and loading attribute'],
        expected: 'Non-critical high-resolution images should use loading="lazy" and modern formats (WebP/AVIF).',
        actual: `Eager loading with dimensions ${img.naturalWidth}x${img.naturalHeight}.`,
        recommendation: 'Add loading="lazy" and serve properly scaled responsive images using <picture> or srcset.',
        retestCount: 0,
        timestamp: Date.now(),
      });
    }
  }

  return findings;
}
