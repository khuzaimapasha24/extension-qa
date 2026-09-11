import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';

export function testButtons(snapshot: PageSnapshot, sessionId: string): Finding[] {
  const findings: Finding[] = [];

  for (const btn of snapshot.buttons) {
    // 1. Button has zero accessible text (no text, no aria-label)
    if (!btn.text && !btn.ariaLabel) {
      findings.push({
        id: `btn_no_name_${findings.length + 1}_${Date.now()}`,
        sessionId,
        category: 'FUNCTIONAL',
        title: 'Button missing accessible text label',
        description: 'An interactive button or control has no readable text content, aria-label, or title.',
        status: 'FAIL',
        severity: 'HIGH',
        confidence: 0.99,
        page: snapshot.pathname,
        element: btn.selector,
        selector: btn.selector,
        evidence: [{
          type: 'dom_snippet',
          description: 'Button without accessible label',
          data: btn.selector,
          timestamp: Date.now(),
        }],
        steps: [`Locate element ${btn.selector}`, 'Examine inner text and aria-label attributes'],
        expected: 'All interactive buttons must have a visible label or aria-label for screen readers.',
        actual: 'Button element is completely unlabeled.',
        recommendation: 'Add visible text, an aria-label, or title attribute describing the button action.',
        retestCount: 0,
        timestamp: Date.now(),
      });
      continue;
    }

    // 2. High-risk button detected (checkout, delete, remove account)
    if (btn.riskLevel === 'HIGH') {
      findings.push({
        id: `btn_high_risk_${findings.length + 1}_${Date.now()}`,
        sessionId,
        category: 'FUNCTIONAL',
        title: `High-risk action button detected: "${btn.text}"`,
        description: `Button performs a sensitive or irreversible action (payment, purchase, deletion). Automated submission was safely gated.`,
        status: 'NEEDS_REVIEW',
        severity: 'INFO',
        confidence: 0.95,
        page: snapshot.pathname,
        element: btn.text,
        selector: btn.selector,
        evidence: [{
          type: 'dom_snippet',
          description: 'High-risk action button identified',
          data: `${btn.text} (${btn.selector})`,
          timestamp: Date.now(),
        }],
        steps: [`Identify button ${btn.selector}`, `Risk classification marked as HIGH`],
        expected: 'High-risk action requires confirmation before automated execution.',
        actual: 'Action gated successfully according to safety rules.',
        recommendation: 'Review flow manually or approve action execution in Side Panel.',
        retestCount: 0,
        timestamp: Date.now(),
      });
    }
  }

  return findings;
}
