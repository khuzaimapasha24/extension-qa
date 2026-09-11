import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';

export function testForms(snapshot: PageSnapshot, sessionId: string): Finding[] {
  const findings: Finding[] = [];

  for (const form of snapshot.forms) {
    // 1. Form has no submit button
    if (!form.submitButtonSelector && form.fields.length > 0) {
      findings.push({
        id: `form_no_submit_${findings.length + 1}_${Date.now()}`,
        sessionId,
        category: 'FUNCTIONAL',
        title: 'Form missing dedicated submit button',
        description: `Form contains input fields but has no button with type="submit" or standard submit trigger.`,
        status: 'WARNING',
        severity: 'MEDIUM',
        confidence: 0.92,
        page: snapshot.pathname,
        element: form.name || form.id || form.selector,
        selector: form.selector,
        evidence: [{
          type: 'dom_snippet',
          description: 'Form lacking submit button',
          data: form.selector,
          timestamp: Date.now(),
        }],
        steps: [`Inspect form ${form.selector}`, 'Check for button[type="submit"] or input[type="submit"]'],
        expected: 'Forms should have a visible and accessible submit button.',
        actual: 'No submit button found within form container.',
        recommendation: 'Add a semantic <button type="submit"> for screen reader users and keyboard accessibility.',
        retestCount: 0,
        timestamp: Date.now(),
      });
    }

    // 2. Unlabeled form fields
    for (const field of form.fields) {
      if (!field.label && !field.placeholder) {
        findings.push({
          id: `field_no_label_${findings.length + 1}_${Date.now()}`,
          sessionId,
          category: 'ACCESSIBILITY',
          title: `Form input "${field.name}" missing accessible label`,
          description: `Input element of type "${field.type}" has no associated <label> or aria-label attribute.`,
          status: 'FAIL',
          severity: 'HIGH',
          confidence: 0.97,
          page: snapshot.pathname,
          element: field.name,
          selector: field.selector,
          evidence: [{
            type: 'dom_snippet',
            description: 'Unlabeled form control',
            data: field.selector,
            timestamp: Date.now(),
          }],
          steps: [`Locate input ${field.selector}`, 'Verify presence of <label for="..."> or aria-label'],
          expected: 'Every form control must have a programmatic label for assistive technologies.',
          actual: 'Input has no label or placeholder.',
          recommendation: 'Associate an explicit <label for="inputId"> or provide an aria-label.',
          retestCount: 0,
          timestamp: Date.now(),
        });
      }
    }
  }

  return findings;
}
