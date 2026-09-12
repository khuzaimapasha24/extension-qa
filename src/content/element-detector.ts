import {
  DiscoveredLink,
  DiscoveredButton,
  DiscoveredForm,
  DiscoveredFormField,
  DiscoveredNavigation,
  DiscoveredTab,
} from '../shared/types/discovery';
import { classifyActionRisk } from '../shared/constants/risk-levels';

/**
 * Detects whether an ID string is dynamic, framework-generated, or ephemeral.
 */
export function isDynamicOrFrameworkId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return true;
  const trimmed = id.trim();
  if (!trimmed) return true;
  return (
    /radix|headlessui|chakra|mui|temp|_r_|_R_|react-|next|content-|modal-|dialog-/i.test(trimmed) ||
    trimmed.includes(':r') ||
    trimmed.includes('::') ||
    /^[-_0-9]/.test(trimmed) ||
    (trimmed.length > 18 && /[0-9]{4,}/.test(trimmed))
  );
}

/**
 * Generates a stable and deterministic CSS selector for any DOM element.
 */
export function generateUniqueSelector(el: Element, doc?: Document): string {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
  const ownerDoc = doc || el.ownerDocument || (typeof document !== 'undefined' ? document : null);

  const isUnique = (sel: string): boolean => {
    if (!ownerDoc) return true;
    try {
      return ownerDoc.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  };

  // 1. Stable, non-dynamic ID
  const id = el.getAttribute('id');
  if (id && !isDynamicOrFrameworkId(id)) {
    const escaped = typeof CSS !== 'undefined' && CSS.escape ? `#${CSS.escape(id)}` : `#${id}`;
    if (isUnique(escaped)) {
      return escaped;
    }
  }

  // 2. data-testid / data-test / data-cy / data-qa
  for (const attr of ['data-testid', 'data-test', 'data-cy', 'data-qa']) {
    const testId = el.getAttribute(attr);
    if (testId) {
      const sel = `[${attr}="${testId}"]`;
      if (isUnique(sel)) return sel;
    }
  }

  // 3. Form input names
  const name = el.getAttribute('name');
  if (name && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'FORM'].includes(el.tagName)) {
    const sel = `${el.tagName.toLowerCase()}[name="${name}"]`;
    if (isUnique(sel)) return sel;
  }

  // 4. Anchor tag with href
  if (el.tagName === 'A') {
    const href = el.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        const cleanHref = href.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const sel = `a[href="${cleanHref}"]`;
        if (isUnique(sel)) return sel;
      } catch {}
    }
  }

  // 5. Button or Link with aria-label or title
  const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title');
  if (ariaLabel && ariaLabel.trim().length > 0) {
    try {
      const cleanAria = ariaLabel.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const tag = el.tagName.toLowerCase();
      const sel = `${tag}[aria-label="${cleanAria}"]`;
      if (isUnique(sel)) return sel;
    } catch {}
  }

  // 5.5 Form controls with placeholder or autocomplete
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
    const placeholder = el.getAttribute('placeholder');
    if (placeholder && placeholder.trim().length > 0) {
      try {
        const cleanPh = placeholder.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const sel = `${el.tagName.toLowerCase()}[placeholder="${cleanPh}"]`;
        if (isUnique(sel)) return sel;
      } catch {}
    }

    const autocomplete = el.getAttribute('autocomplete');
    if (autocomplete && autocomplete !== 'off') {
      try {
        const sel = `${el.tagName.toLowerCase()}[autocomplete="${autocomplete.trim()}"]`;
        if (isUnique(sel)) return sel;
      } catch {}
    }
  }

  // 6. Anchored hierarchical path (walking up until anchored to a landmark or body)
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE && (!ownerDoc || current !== ownerDoc.documentElement)) {
    const currentTag = current.tagName.toLowerCase();
    let selector = currentTag;
    const parentNode: Element | null = current.parentElement;

    // Check if ancestor has a stable, unique ID
    const ancestorId = current.getAttribute('id');
    if (ancestorId && !isDynamicOrFrameworkId(ancestorId)) {
      const escapedId = typeof CSS !== 'undefined' && CSS.escape ? `#${CSS.escape(ancestorId)}` : `#${ancestorId}`;
      if (isUnique(escapedId)) {
        path.unshift(escapedId);
        break; // Anchored to a guaranteed unique ancestor!
      }
    }

    if (parentNode) {
      const siblings = Array.from(parentNode.children).filter((c: Element) => c.tagName === currentTag.toUpperCase());
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);

    // Stop once we hit a distinctive landmark or body container
    const isLandmark = ['main', 'nav', 'header', 'footer', 'aside', 'form', 'table', 'dialog', 'body'].includes(currentTag);
    if (isLandmark) {
      break;
    }

    current = parentNode;
  }

  // Check if a concise container + target selector is already unique
  if (path.length > 2) {
    const first = path[0];
    const last = path[path.length - 1];
    const conciseDescendant = `${first} ${last}`;
    if (isUnique(conciseDescendant)) {
      return conciseDescendant;
    }
  }

  return path.join(' > ');
}

/**
 * Extracts all links and classifies them into same-origin, external, and anchor destinations.
 */
export function extractLinks(doc: Document = document, currentOrigin: string = window.location.origin): DiscoveredLink[] {
  const anchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'));
  const seenUrls = new Set<string>();
  const links: DiscoveredLink[] = [];

  for (const a of anchors) {
    const rawHref = a.getAttribute('href') || '';
    const trimmedHref = rawHref.trim();

    if (!trimmedHref) {
      const dedupKey = `empty_${generateUniqueSelector(a)}`;
      if (!seenUrls.has(dedupKey)) {
        seenUrls.add(dedupKey);
        links.push({
          href: rawHref,
          normalizedUrl: '',
          text: a.textContent?.trim() || a.getAttribute('aria-label') || '',
          isInternal: false,
          isAnchor: false,
          isMailtoOrTel: false,
          rel: a.getAttribute('rel') || undefined,
          target: a.getAttribute('target') || undefined,
          selector: generateUniqueSelector(a),
        });
      }
      continue;
    }

    const isAnchor = trimmedHref.startsWith('#');
    const isMailtoOrTel = trimmedHref.startsWith('mailto:') || trimmedHref.startsWith('tel:') || trimmedHref.startsWith('javascript:');

    let normalizedUrl = trimmedHref;
    let isInternal = false;

    if (!isAnchor && !isMailtoOrTel) {
      try {
        const base = currentOrigin.startsWith('http') ? currentOrigin : (typeof window !== 'undefined' ? window.location.href : 'http://localhost');
        const resolved = new URL(trimmedHref, base);
        normalizedUrl = resolved.origin + resolved.pathname + (resolved.search ? resolved.search : '');
        // Strip trailing slash for consistency
        if (normalizedUrl.endsWith('/') && normalizedUrl.length > resolved.origin.length + 1) {
          normalizedUrl = normalizedUrl.slice(0, -1);
        }
        isInternal = resolved.origin.toLowerCase() === currentOrigin.toLowerCase();
      } catch {
        // Unparseable URL
      }
    }

    // Deduplicate identical links on the same page
    const dedupKey = `${normalizedUrl}_${a.textContent?.trim()}`;
    if (seenUrls.has(dedupKey)) continue;
    seenUrls.add(dedupKey);

    links.push({
      href: rawHref,
      normalizedUrl,
      text: a.textContent?.trim() || a.getAttribute('aria-label') || '',
      isInternal,
      isAnchor,
      isMailtoOrTel,
      rel: a.getAttribute('rel') || undefined,
      target: a.getAttribute('target') || undefined,
      selector: generateUniqueSelector(a),
    });
  }

  return links;
}

/**
 * Detects whether an element is visible in layout.
 */
export function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;
  if (el.hidden) return false;

  // In standard browser environment:
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
    } catch {
      // Ignore in mock/jsdom environments where getComputedStyle may partially fail
    }
  }

  if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
    // In JSDOM offsetParent is always null, so check display style as fallback
    return el.style.display !== 'none';
  }

  return true;
}

/**
 * Extracts interactive buttons and classifies their action risk level.
 */
export function extractButtons(doc: Document = document): DiscoveredButton[] {
  const elements = Array.from(
    doc.querySelectorAll<HTMLElement>('button, input[type="button"], input[type="submit"], [role="button"]')
  );

  return elements.map((el) => {
    const text = (
      el.textContent ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      (el as HTMLInputElement).value ||
      ''
    ).trim();

    const type = el.getAttribute('type') || (el.tagName === 'BUTTON' ? 'button' : el.getAttribute('role') || 'button');
    const ariaLabel = el.getAttribute('aria-label') || undefined;
    const role = el.getAttribute('role') || undefined;
    const isVisible = isElementVisible(el);
    const isDisabled = Boolean(
      (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true'
    );

    const riskLevel = classifyActionRisk(text, el.getAttribute('id') || '');

    return {
      text,
      type,
      ariaLabel,
      role,
      selector: generateUniqueSelector(el),
      isVisible,
      isDisabled,
      riskLevel,
    };
  });
}

/**
 * Extracts forms, input fields, labels, and submit triggers.
 * Supports both traditional <form> elements and modern SPA headless/standalone form panels (e.g. settings panels, cards).
 */
export function extractForms(doc: Document = document): DiscoveredForm[] {
  const formElements = Array.from(doc.querySelectorAll<HTMLFormElement>('form'));
  const forms: DiscoveredForm[] = [];
  const processedControls = new Set<Element>();

  // 1. Extract traditional <form> elements
  for (const form of formElements) {
    const formId = form.getAttribute('id') || undefined;
    const formName = form.getAttribute('name') || undefined;
    const action = form.getAttribute('action') || (typeof window !== 'undefined' ? window.location.pathname : '/');
    const method = (form.getAttribute('method') || 'GET').toUpperCase();

    // Find all form controls
    const controls = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
      )
    );

    for (const c of controls) {
      processedControls.add(c);
    }

    const fields: DiscoveredFormField[] = controls.map((ctrl) => {
      const name = ctrl.getAttribute('name') || ctrl.getAttribute('id') || 'unnamed_field';
      const type = ctrl.getAttribute('type') || ctrl.tagName.toLowerCase();
      const placeholder = ctrl.getAttribute('placeholder') || undefined;
      const required = ctrl.required || ctrl.getAttribute('aria-required') === 'true';

      // Find label
      let label: string | undefined = undefined;
      const ctrlId = ctrl.getAttribute('id');
      if (ctrlId) {
        const labelEl = doc.querySelector(`label[for="${ctrlId}"]`);
        if (labelEl) label = labelEl.textContent?.trim();
      }
      if (!label && ctrl.closest('label')) {
        label = ctrl.closest('label')?.textContent?.trim();
      }
      if (!label) {
        label = ctrl.getAttribute('aria-label') || placeholder || undefined;
      }

      return {
        name,
        type,
        label,
        placeholder,
        required,
        defaultValue: ctrl.value || undefined,
        selector: generateUniqueSelector(ctrl),
      };
    });

    // Find submit button (preferring enabled buttons)
    const submitButtons = Array.from(
      form.querySelectorAll<HTMLElement>('button[type="submit"], input[type="submit"], button:not([type="button"])')
    );
    const enabledSubmitBtn =
      submitButtons.find(
        (btn) => !(btn as HTMLButtonElement).disabled && btn.getAttribute('aria-disabled') !== 'true'
      ) || submitButtons[0];
    const submitButtonSelector = enabledSubmitBtn ? generateUniqueSelector(enabledSubmitBtn) : undefined;

    // Assess form risk level based on action and field names
    const fieldsText = fields.map((f) => `${f.name} ${f.label || ''}`).join(' ');
    const riskLevel = classifyActionRisk(action + ' ' + (formName || '') + ' ' + (formId || ''), fieldsText);

    forms.push({
      id: formId,
      name: formName,
      action,
      method,
      selector: generateUniqueSelector(form),
      fields,
      submitButtonSelector,
      riskLevel,
      isStandalone: false,
    });
  }

  // 2. Discover Standalone / Headless Input Groups (React / Vue / Next.js / Tailwind dashboards without <form>)
  const allControls = Array.from(
    doc.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
    )
  );

  const standaloneControls = allControls.filter((ctrl) => {
    if (processedControls.has(ctrl)) return false;
    if (ctrl.closest('form')) return false;
    return isElementVisible(ctrl as HTMLElement);
  });

  if (standaloneControls.length > 0) {
    // Group controls by their logical panel / container
    const containerMap = new Map<HTMLElement, Element[]>();

    for (const ctrl of standaloneControls) {
      const container =
        (ctrl.closest(
          '[role="tabpanel"], [role="dialog"], section, main, article, .card, [class*="settings"], [class*="profile"], [class*="form"], fieldset'
        ) as HTMLElement) ||
        ctrl.parentElement ||
        (doc.body as HTMLElement);

      const list = containerMap.get(container) || [];
      list.push(ctrl);
      containerMap.set(container, list);
    }

    let groupIndex = 0;
    for (const [container, controls] of containerMap.entries()) {
      groupIndex++;
      const fields: DiscoveredFormField[] = controls.map((ctrl) => {
        const name = ctrl.getAttribute('name') || ctrl.getAttribute('id') || `input_${groupIndex}`;
        const type = ctrl.getAttribute('type') || ctrl.tagName.toLowerCase();
        const placeholder = ctrl.getAttribute('placeholder') || undefined;
        const required =
          ('required' in ctrl && (ctrl as HTMLInputElement).required) ||
          ctrl.getAttribute('aria-required') === 'true';

        let label: string | undefined = undefined;
        const ctrlId = ctrl.getAttribute('id');
        if (ctrlId) {
          const labelEl = doc.querySelector(`label[for="${ctrlId}"]`);
          if (labelEl) label = labelEl.textContent?.trim();
        }
        if (!label && ctrl.closest('label')) {
          label = ctrl.closest('label')?.textContent?.trim();
        }
        if (!label) {
          label = ctrl.getAttribute('aria-label') || placeholder || undefined;
        }

        return {
          name,
          type,
          label,
          placeholder,
          required,
          defaultValue: (ctrl as HTMLInputElement).value || undefined,
          selector: generateUniqueSelector(ctrl),
        };
      });

      // Find candidate buttons in container that are visible
      const allContainerButtons = Array.from(
        container.querySelectorAll<HTMLElement>('button, [role="button"], input[type="submit"]')
      ).filter((btn) => isElementVisible(btn));

      const candidateButtons = allContainerButtons.filter((btn) => {
        const isDisabled = Boolean(
          (btn as HTMLButtonElement).disabled ||
          btn.getAttribute('aria-disabled') === 'true' ||
          btn.classList.contains('disabled')
        );
        return !isDisabled;
      });

      let submitBtn = candidateButtons.find((btn) => {
        if (btn.getAttribute('type') === 'submit') return true;
        const text = (btn.textContent || btn.getAttribute('aria-label') || btn.getAttribute('title') || '').trim();
        return /save|enregistrer|submit|valider|update|mettre.*jour|appliquer|envoyer|send|search|rechercher|confirm|confirmer|cr[ée]|add|ajouter|nouv/i.test(
          text
        );
      });

      // If no enabled submit button was found, check visible buttons that might be initially disabled pending input
      if (!submitBtn) {
        submitBtn = allContainerButtons.find((btn) => {
          if (btn.getAttribute('type') === 'submit') return true;
          const text = (btn.textContent || btn.getAttribute('aria-label') || btn.getAttribute('title') || '').trim();
          return /save|enregistrer|submit|valider|update|mettre.*jour|appliquer|envoyer|send|search|rechercher|confirm|confirmer|cr[ée]|add|ajouter|nouv/i.test(
            text
          );
        });
      }

      if (!submitBtn && candidateButtons.length > 0) {
        // Only pick fallback button if it's not a cancel, delete, back, or pagination control
        const nonNavBtn = candidateButtons.find((btn) => {
          const text = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
          const isCancelOrDelete = /cancel|annuler|delete|supprimer|remove|retour|back|prev|next|fermer|close|reset|réinitialiser/i.test(text);
          return !isCancelOrDelete;
        });
        if (nonNavBtn) {
          submitBtn = nonNavBtn;
        }
      }

      // Container title from heading
      const headingEl = container.querySelector('h1, h2, h3, h4, [role="heading"]');
      const containerName =
        headingEl?.textContent?.trim() ||
        container.getAttribute('aria-label') ||
        container.getAttribute('id') ||
        `Settings & Data Entry Panel ${groupIndex}`;

      const fieldsText = fields.map((f) => `${f.name} ${f.label || ''}`).join(' ');
      const riskLevel = classifyActionRisk(containerName, fieldsText);

      forms.push({
        id: container.getAttribute('id') || `standalone_panel_${groupIndex}`,
        name: containerName,
        action: typeof window !== 'undefined' ? window.location.pathname : '/',
        method: 'POST',
        selector: generateUniqueSelector(container),
        fields,
        submitButtonSelector: submitBtn ? generateUniqueSelector(submitBtn) : undefined,
        riskLevel,
        isStandalone: true,
        containerTag: container.tagName.toLowerCase(),
      });
    }
  }

  return forms;
}

/**
 * Extracts navigation tabs and sidebar menu items (e.g. role="tab", role="menuitem", aside nav items).
 * Crucial for deep multi-tab exploration in Single-Page Applications (SPAs) and dashboards.
 */
export function extractTabsAndNavigationItems(doc: Document = document): DiscoveredTab[] {
  const elements = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[role="tab"], [role="menuitem"], aside button, aside a, nav button, nav a, .sidebar-item, .nav-item, .tab, aside li, nav li'
    )
  );

  const seenSelectors = new Set<string>();
  const tabs: DiscoveredTab[] = [];

  for (const el of elements) {
    if (!isElementVisible(el)) continue;

    const text = (
      el.textContent ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      ''
    ).trim();

    // Skip empty items, pure icons without labels, or overly verbose text
    if (!text || text.length > 70) continue;

    // Skip utility buttons (logout, theme switch) from being treated as primary view tabs if labeled destructively
    if (/logout|d[eé]connexion|delete|supprimer/i.test(text)) continue;

    const selector = generateUniqueSelector(el);
    if (seenSelectors.has(selector)) continue;
    seenSelectors.add(selector);

    const role = el.getAttribute('role') || el.tagName.toLowerCase();
    const isActive = Boolean(
      el.getAttribute('aria-selected') === 'true' ||
      el.getAttribute('aria-current') === 'page' ||
      el.getAttribute('data-state') === 'active' ||
      el.classList.contains('active') ||
      el.classList.contains('selected')
    );
    const ariaControls = el.getAttribute('aria-controls') || undefined;

    tabs.push({
      text,
      role,
      selector,
      isActive,
      ariaControls,
    });
  }

  return tabs;
}

/**
 * Extracts navigation containers from the page.
 */
export function extractNavigations(doc: Document = document): DiscoveredNavigation[] {
  const navElements = Array.from(doc.querySelectorAll<HTMLElement>('nav, [role="navigation"], header, footer'));

  return navElements.map((nav) => {
    const role = nav.tagName.toLowerCase() === 'nav' ? 'nav' : nav.getAttribute('role') || nav.tagName.toLowerCase();
    const label = nav.getAttribute('aria-label') || nav.getAttribute('aria-labelledby') || undefined;
    const linksCount = nav.querySelectorAll('a').length;

    return {
      role,
      label,
      linksCount,
      selector: generateUniqueSelector(nav),
    };
  });
}
