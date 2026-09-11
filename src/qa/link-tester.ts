import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';

export function testLinks(snapshot: PageSnapshot, sessionId: string): Finding[] {
  const findings: Finding[] = [];

  for (const link of snapshot.links) {
    const rawHref = link.href.trim();

    // 1. Empty or whitespace href
    if (!rawHref) {
      findings.push({
        id: `link_empty_${findings.length + 1}_${Date.now()}`,
        sessionId,
        category: 'FUNCTIONAL',
        title: 'Empty link href attribute',
        description: `An anchor tag has an empty or whitespace href attribute, preventing keyboard navigation.`,
        status: 'FAIL',
        severity: 'MEDIUM',
        confidence: 0.98,
        page: snapshot.pathname,
        element: link.text || link.selector,
        selector: link.selector,
        evidence: [{
          type: 'dom_snippet',
          description: 'Anchor element with empty href',
          data: link.selector,
          timestamp: Date.now(),
        }],
        steps: [`Inspect anchor tag matching selector ${link.selector}`, `Verify href attribute is empty`],
        expected: 'All anchor elements should have a valid destination URL or appropriate button role.',
        actual: 'Anchor tag has empty href.',
        recommendation: 'Specify a valid URL destination or convert element to a <button> if used for JavaScript actions.',
        retestCount: 0,
        timestamp: Date.now(),
      });
      continue;
    }

    // 2. javascript: pseudo-protocol
    if (rawHref.toLowerCase().startsWith('javascript:')) {
      findings.push({
        id: `link_js_proto_${findings.length + 1}_${Date.now()}`,
        sessionId,
        category: 'FUNCTIONAL',
        title: 'javascript: pseudo-protocol in anchor link',
        description: `Link uses "${rawHref}" which creates accessibility issues and breaks standard browser navigation.`,
        status: 'WARNING',
        severity: 'LOW',
        confidence: 0.95,
        page: snapshot.pathname,
        element: link.text || link.selector,
        selector: link.selector,
        evidence: [{
          type: 'dom_snippet',
          description: 'Anchor with javascript: href',
          data: rawHref,
          timestamp: Date.now(),
        }],
        steps: [`Inspect link ${link.selector}`, `Check href attribute "${rawHref}"`],
        expected: 'Anchors should navigate to real routes; actions should use <button type="button">.',
        actual: `Anchor uses ${rawHref}`,
        recommendation: 'Replace javascript: pseudo-protocol with standard button event handlers.',
        retestCount: 0,
        timestamp: Date.now(),
      });
      continue;
    }

    // 3. Raw hash links href="#" without accessible label or role="button"
    if (rawHref === '#' && (!link.text || link.text.length === 0)) {
      findings.push({
        id: `link_empty_hash_${findings.length + 1}_${Date.now()}`,
        sessionId,
        category: 'FUNCTIONAL',
        title: 'Empty hash anchor without accessible text',
        description: 'An anchor link points to "#" and contains no accessible text content or label.',
        status: 'FAIL',
        severity: 'HIGH',
        confidence: 0.96,
        page: snapshot.pathname,
        element: link.selector,
        selector: link.selector,
        evidence: [{
          type: 'dom_snippet',
          description: 'Empty anchor pointing to "#"',
          data: link.selector,
          timestamp: Date.now(),
        }],
        steps: [`Inspect element ${link.selector}`, 'Verify destination is "#" with no inner text'],
        expected: 'Interactive elements must provide accessible text describing their destination or purpose.',
        actual: 'Empty hash link found.',
        recommendation: 'Provide meaningful text or convert to a semantic button.',
        retestCount: 0,
        timestamp: Date.now(),
      });
    }
  }

  return findings;
}
