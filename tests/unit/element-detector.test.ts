import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateUniqueSelector,
  extractLinks,
  extractButtons,
  extractForms,
  extractNavigations,
  extractTabsAndNavigationItems,
} from '../../src/content/element-detector';

describe('Element Detector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('generateUniqueSelector', () => {
    it('generates ID selector when available', () => {
      document.body.innerHTML = '<button id="checkout-btn">Checkout</button>';
      const btn = document.querySelector('#checkout-btn')!;
      expect(generateUniqueSelector(btn)).toBe('#checkout-btn');
    });

    it('generates data-testid selector when available', () => {
      document.body.innerHTML = '<div data-testid="search-bar">Search</div>';
      const el = document.querySelector('[data-testid="search-bar"]')!;
      expect(generateUniqueSelector(el)).toBe('[data-testid="search-bar"]');
    });

    it('generates name selector for form inputs', () => {
      document.body.innerHTML = '<input name="email_address" type="email" />';
      const input = document.querySelector('input')!;
      expect(generateUniqueSelector(input)).toBe('input[name="email_address"]');
    });

    it('rejects dynamic Radix UI and React useId IDs and uses landmark path instead', () => {
      document.body.innerHTML = `
        <main>
          <div>
            <button id="radix-_R_76btb_">Options</button>
          </div>
        </main>
      `;
      const btn = document.querySelector('#radix-_R_76btb_')!;
      const sel = generateUniqueSelector(btn);
      expect(sel).not.toContain('radix-_R_76btb_');
      expect(sel).toContain('main');
      expect(sel).toContain('button');
    });
  });

  describe('extractLinks', () => {
    it('differentiates internal, external, anchor, and mailto links', () => {
      const origin = 'https://example.com';
      document.body.innerHTML = `
        <a href="/about">About Us</a>
        <a href="https://example.com/pricing">Pricing</a>
        <a href="https://twitter.com/example" target="_blank" rel="noopener">Twitter</a>
        <a href="#section-faq">FAQ</a>
        <a href="mailto:support@example.com">Support Email</a>
      `;

      const links = extractLinks(document, origin);

      expect(links.length).toBe(5);

      // Relative internal
      expect(links[0].text).toBe('About Us');
      expect(links[0].isInternal).toBe(true);
      expect(links[0].isAnchor).toBe(false);

      // Absolute same-origin
      expect(links[1].text).toBe('Pricing');
      expect(links[1].isInternal).toBe(true);

      // External
      expect(links[2].text).toBe('Twitter');
      expect(links[2].isInternal).toBe(false);
      expect(links[2].target).toBe('_blank');

      // Anchor
      expect(links[3].text).toBe('FAQ');
      expect(links[3].isAnchor).toBe(true);

      // Mailto
      expect(links[4].isMailtoOrTel).toBe(true);
    });
  });

  describe('extractButtons', () => {
    it('extracts buttons and classifies action risk', () => {
      document.body.innerHTML = `
        <button id="nav-toggle">Toggle Menu</button>
        <button id="pay-now">Pay Now $49.00</button>
        <button id="delete-item">Delete Record</button>
        <input type="submit" value="Search Catalog" />
      `;

      const buttons = extractButtons(document);

      expect(buttons.length).toBe(4);

      // Nav toggle -> LOW risk
      expect(buttons[0].text).toBe('Toggle Menu');
      expect(buttons[0].riskLevel).toBe('LOW');

      // Pay now -> HIGH risk
      expect(buttons[1].text).toBe('Pay Now $49.00');
      expect(buttons[1].riskLevel).toBe('HIGH');

      // Delete item -> HIGH risk
      expect(buttons[2].text).toBe('Delete Record');
      expect(buttons[2].riskLevel).toBe('HIGH');

      // Search submit -> LOW risk
      expect(buttons[3].text).toBe('Search Catalog');
      expect(buttons[3].riskLevel).toBe('LOW');
    });
  });

  describe('extractForms', () => {
    it('extracts form structure, associated labels, and required flags', () => {
      document.body.innerHTML = `
        <form id="contact-form" action="/api/contact" method="POST">
          <label for="username">Your Name</label>
          <input id="username" name="name" type="text" required />
          
          <label>
            Your Email
            <input name="email" type="email" placeholder="you@example.com" />
          </label>

          <textarea name="message" placeholder="Your message..."></textarea>
          <button type="submit">Send Message</button>
        </form>
      `;

      const forms = extractForms(document);

      expect(forms.length).toBe(1);
      const form = forms[0];
      expect(form.id).toBe('contact-form');
      expect(form.method).toBe('POST');
      expect(form.fields.length).toBe(3);

      // Field 1: label for id
      expect(form.fields[0].name).toBe('name');
      expect(form.fields[0].label).toBe('Your Name');
      expect(form.fields[0].required).toBe(true);

      // Field 2: wrapping label
      expect(form.fields[1].name).toBe('email');
      expect(form.fields[1].label).toContain('Your Email');
      expect(form.fields[1].placeholder).toBe('you@example.com');

      // Submit button selector
      expect(form.submitButtonSelector).toBeDefined();
    });

    it('detects headless/standalone input groups without <form> elements and links save button', () => {
      document.body.innerHTML = `
        <div id="profile-panel" class="settings-card">
          <h2>Mon profil et paramètres</h2>
          <label for="user-prenom">Prénom</label>
          <input id="user-prenom" name="prenom" type="text" />

          <label for="user-email">Courriel</label>
          <input id="user-email" name="courriel" type="email" />

          <button id="save-btn" type="button">Enregistrer</button>
        </div>
      `;

      const forms = extractForms(document);

      expect(forms.length).toBe(1);
      const form = forms[0];
      expect(form.isStandalone).toBe(true);
      expect(form.name).toContain('Mon profil et paramètres');
      expect(form.fields.length).toBe(2);
      expect(form.fields[0].name).toBe('prenom');
      expect(form.fields[0].label).toBe('Prénom');
      expect(form.fields[1].name).toBe('courriel');
      expect(form.submitButtonSelector).toBe('#save-btn');
    });
  });

  describe('extractTabsAndNavigationItems', () => {
    it('extracts sidebar navigation tabs and active state', () => {
      document.body.innerHTML = `
        <aside class="sidebar">
          <button role="tab" aria-selected="false">Vue d'ensemble</button>
          <button role="tab" aria-selected="false">Examens et certifications</button>
          <button role="tab" class="active" aria-selected="true">Mon profil et paramètres</button>
        </aside>
      `;

      const tabs = extractTabsAndNavigationItems(document);

      expect(tabs.length).toBe(3);
      expect(tabs[0].text).toBe("Vue d'ensemble");
      expect(tabs[0].isActive).toBe(false);
      expect(tabs[1].text).toBe('Examens et certifications');
      expect(tabs[2].text).toBe('Mon profil et paramètres');
      expect(tabs[2].isActive).toBe(true);
    });
  });

  describe('extractNavigations', () => {
    it('detects navigation containers and counts links', () => {
      document.body.innerHTML = `
        <nav aria-label="Main Navigation">
          <a href="/">Home</a>
          <a href="/products">Products</a>
          <a href="/contact">Contact</a>
        </nav>
      `;

      const navs = extractNavigations(document);

      expect(navs.length).toBe(1);
      expect(navs[0].role).toBe('nav');
      expect(navs[0].label).toBe('Main Navigation');
      expect(navs[0].linksCount).toBe(3);
    });
  });
});
