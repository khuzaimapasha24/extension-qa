import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';

const AMBIGUOUS_LINK_TEXTS = ['click here', 'read more', 'learn more', 'more', 'link', 'go', 'here'];

export function testAccessibility(snapshot: PageSnapshot, sessionId: string): Finding[] {
  const findings: Finding[] = [];

  // 1. Missing document lang
  if (!snapshot.metadata.lang) {
    findings.push({
      id: `a11y_no_lang_${Date.now()}`,
      sessionId,
      category: 'ACCESSIBILITY',
      title: 'Missing lang attribute on <html> element',
      description: 'The root <html> element does not specify a lang attribute, preventing screen readers from choosing appropriate pronunciation.',
      status: 'FAIL',
      severity: 'HIGH',
      confidence: 1.0,
      page: snapshot.pathname,
      evidence: [],
      steps: ['Inspect <html lang="..."> attribute'],
      expected: 'Root <html> tag must specify a valid language code (e.g. <html lang="en">).',
      actual: 'No lang attribute defined.',
      recommendation: 'Add lang="en" (or the appropriate language code) to the <html> tag.',
      retestCount: 0,
      timestamp: Date.now(),
    });
  }

  // 2. Images missing alt text
  for (const img of snapshot.images) {
    if (!img.hasAltText) {
      findings.push({
        id: `a11y_no_alt_${findings.length + 1}_${Date.now()}`,
        sessionId,
        category: 'ACCESSIBILITY',
        title: 'Image missing descriptive alt attribute',
        description: `Image at "${img.src.slice(0, 50)}..." has no alt text, leaving screen reader users without context.`,
        status: 'FAIL',
        severity: 'HIGH',
        confidence: 0.98,
        page: snapshot.pathname,
        element: img.selector,
        selector: img.selector,
        evidence: [{
          type: 'dom_snippet',
          description: 'Image element missing alt text',
          data: img.selector,
          timestamp: Date.now(),
        }],
        steps: [`Locate image ${img.selector}`, 'Check alt attribute'],
        expected: 'All informative images must include a meaningful alt description.',
        actual: 'alt attribute is missing or completely blank.',
        recommendation: 'Add alt="Descriptive summary of the image" or alt="" if purely decorative.',
        retestCount: 0,
        timestamp: Date.now(),
      });
    }
  }

  // 3. Ambiguous link text
  for (const link of snapshot.links) {
    const text = link.text.toLowerCase().trim();
    if (AMBIGUOUS_LINK_TEXTS.includes(text)) {
      findings.push({
        id: `a11y_ambiguous_link_${findings.length + 1}_${Date.now()}`,
        sessionId,
        category: 'ACCESSIBILITY',
        title: `Ambiguous link text: "${link.text}"`,
        description: `Link text "${link.text}" provides no contextual meaning when read out of context by a screen reader list of links.`,
        status: 'WARNING',
        severity: 'MEDIUM',
        confidence: 0.92,
        page: snapshot.pathname,
        element: link.text,
        selector: link.selector,
        evidence: [{
          type: 'dom_snippet',
          description: 'Link with ambiguous anchor text',
          data: `${link.text} -> ${link.href}`,
          timestamp: Date.now(),
        }],
        steps: [`Inspect anchor ${link.selector}`, `Read inner text "${link.text}"`],
        expected: 'Link text should clearly describe the destination without surrounding context.',
        actual: `Ambiguous text "${link.text}" found.`,
        recommendation: 'Replace generic text with specific destination (e.g. "Read more about our pricing").',
        retestCount: 0,
        timestamp: Date.now(),
      });
    }
  }

  return findings;
}
