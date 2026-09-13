import { describe, it, expect, beforeEach } from 'vitest';
import { selfHealingLocator } from '../../src/agent/self-healing-locator';
import { findDOMElement } from '../../src/content/action-simulator';

describe('SelfHealingLocator', () => {
  let doc: Document;

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('Self Healing Test');
  });

  it('heals broken ID selector via form control name attribute', () => {
    // Original selector was #old_email_input, but developer changed it to #new_v3_email with name="userEmail"
    const input = doc.createElement('input');
    input.id = 'new_v3_email';
    input.setAttribute('name', 'userEmail');
    doc.body.appendChild(input);

    const result = selfHealingLocator.heal(doc, '#old_email_input', {
      name: 'userEmail',
      tag: 'input',
    });

    expect(result.healed).toBe(true);
    expect(result.element).toBe(input);
    expect(result.strategy).toBe('FORM_CONTROL_MATCH');
    expect(result.healedSelector).toBe('[name="userEmail"]');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('heals broken selector via placeholder text', () => {
    const input = doc.createElement('input');
    input.setAttribute('placeholder', 'Enter billing address');
    doc.body.appendChild(input);

    const result = selfHealingLocator.heal(doc, '.billing-addr-box', {
      placeholder: 'Enter billing address',
    });

    expect(result.healed).toBe(true);
    expect(result.element).toBe(input);
    expect(result.strategy).toBe('FORM_CONTROL_MATCH');
    expect(result.healedSelector).toBe('[placeholder*="Enter billing address"]');
  });

  it('heals broken button selector via visible text similarity', () => {
    // Original selector was button#btn-checkout, developer changed to button.checkout-action-v2 with text "Complete Order"
    const btn = doc.createElement('button');
    btn.className = 'checkout-action-v2';
    btn.textContent = 'Complete Order Now';
    doc.body.appendChild(btn);

    const result = selfHealingLocator.heal(doc, 'button#btn-checkout', {
      text: 'Complete Order',
      tag: 'button',
    });

    expect(result.healed).toBe(true);
    expect(result.element).toBe(btn);
    expect(result.strategy).toBe('TEXT_SIMILARITY');
    expect(result.healedSelector).toContain('button:has-text(');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('heals broken element selector via ARIA label', () => {
    const closeBtn = doc.createElement('button');
    closeBtn.setAttribute('aria-label', 'Close shopping cart dialog');
    doc.body.appendChild(closeBtn);

    const result = selfHealingLocator.heal(doc, 'button.icon-cross', {
      ariaLabel: 'Close shopping cart dialog',
    });

    expect(result.healed).toBe(true);
    expect(result.element).toBe(closeBtn);
    expect(result.strategy).toBe('ARIA_MATCH');
    expect(result.healedSelector).toBe('[aria-label*="Close shopping cart dialog"]');
  });

  it('heals broken descendant selector via parent container proximity', () => {
    const modal = doc.createElement('div');
    modal.id = 'checkout-dialog';
    const submitBtn = doc.createElement('button');
    submitBtn.textContent = 'Submit';
    modal.appendChild(submitBtn);
    doc.body.appendChild(modal);

    const result = selfHealingLocator.heal(doc, '#checkout-dialog .btn-legacy-submit', {});

    expect(result.healed).toBe(true);
    expect(result.element).toBe(submitBtn);
    expect(result.strategy).toBe('CONTAINER_PROXIMITY');
    expect(result.healedSelector).toBe('#checkout-dialog button');
  });

  it('integrates seamlessly with findDOMElement Tier 9 self-healing', () => {
    const button = doc.createElement('button');
    button.setAttribute('aria-label', 'Submit Application');
    button.textContent = 'Submit Application';
    doc.body.appendChild(button);

    // Provide a completely broken selector, but pass textHint
    const found = findDOMElement('button#completely_nonexistent_btn_id', { textHint: 'Submit Application' }, doc);

    expect(found).not.toBeNull();
    expect(found).toBe(button);
  });
});
