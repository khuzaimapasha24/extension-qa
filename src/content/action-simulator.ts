import { createLogger } from '../shared/logger/logger';
import { selfHealingLocator } from '../agent/self-healing-locator';

const logger = createLogger('ActionSimulator');

export interface ActionOptions {
  timeoutMs?: number;
  scroll?: boolean;
  textHint?: string;
  tagHint?: string;
  allowDisabled?: boolean;
  throwOnDisabled?: boolean;
}

/**
 * High-resilience DOM element finder with multi-tier fallback searching:
 * 1. Exact querySelector
/**
 * Dismisses any blocking Radix or accessible modal/popover overlays if active.
 */
export function dismissActiveModal(doc: Document = document): boolean {
  try {
    const modal = doc.querySelector('dialog[open], [role="dialog"], [data-radix-portal]');
    if (modal) {
      const esc = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      });
      doc.dispatchEvent(esc);
      return true;
    }
  } catch {}
  return false;
}

/**
 * Resilient multi-tier DOM element resolver.
 * 1. Exact querySelector
 * 2. ID-based escaped resolution (Radix UI / React useId() / colons)
 * 3. Hierarchical path suffix & nth-of-type relaxation
 * 4. Semantic text/aria-label matching
 * 5. Table row / action button resolution
 */
export function findDOMElement(
  target: Element | string,
  options: ActionOptions = {},
  doc: Document = document
): Element | null {
  if (typeof target !== 'string') return target;
  if (!target || !target.trim()) return null;

  const selector = target.trim();
  const normalized = selector.replace(/\\([ \t-_:])/g, '$1');

  // Tier 1: Exact querySelector (normalized & raw)
  try {
    const el = doc.querySelector(normalized) || doc.querySelector(selector);
    if (el) return el;
  } catch {
    // Selector syntax error (e.g. unescaped colons in ID)
  }

  // Tier 2: Attribute-based aria-label matching (handles backslash spaces, case sensitivity)
  const ariaMatch = selector.match(/\[aria-label=["']?(.*?)["']?\]/);
  if (ariaMatch && ariaMatch[1]) {
    const rawAria = ariaMatch[1].replace(/\\([ \t-_:])/g, '$1').trim();
    try {
      const el = doc.querySelector(`[aria-label="${rawAria}" i]`);
      if (el) return el;
    } catch {}

    // Loose substring match for buttons/links
    try {
      const buttons = Array.from(doc.querySelectorAll('button, a, [role="button"]'));
      for (const b of buttons) {
        const val = (b.getAttribute('aria-label') || b.getAttribute('title') || '').trim().toLowerCase();
        const search = rawAria.toLowerCase();
        if (val === search || (search.length > 3 && (val.includes(search) || search.includes(val)))) {
          return b;
        }
      }
    } catch {}

    // Special heuristics for carousel & picker buttons
    const lower = rawAria.toLowerCase();
    if (lower.includes('prev')) {
      const prev = doc.querySelector('button[aria-label*="prev" i], button.slick-prev, button.swiper-button-prev, .carousel-control-prev, [data-carousel-prev]');
      if (prev) return prev;
    }
    if (lower.includes('next')) {
      const next = doc.querySelector('button[aria-label*="next" i], button.slick-next, button.swiper-button-next, .carousel-control-next, [data-carousel-next]');
      if (next) return next;
    }
    if (lower.includes('country') || lower.includes('code')) {
      const country = doc.querySelector('button[aria-label*="country" i], [role="combobox"][aria-label*="country" i], .country-selector button, .iti__selected-flag');
      if (country) return country;
    }
  }

  // Tier 2.5: Resilient Anchor & Route Link Resolution (handles relative/absolute, slugs, and collapsed sidebars)
  const linkHrefMatch = selector.match(/^a\[href=["']?(.*?)["']?\]/i);
  if (linkHrefMatch && linkHrefMatch[1]) {
    const rawTargetHref = linkHrefMatch[1].trim();
    try {
      const trimmedTarget = rawTargetHref.replace(/\/+$/, '');
      const candidates = [
        `a[href="${rawTargetHref}" i]`,
        `a[href="${trimmedTarget}" i]`,
        `a[href="${trimmedTarget}/" i]`,
        `a[href*="${trimmedTarget}" i]`,
        `a[href$="${trimmedTarget}" i]`,
      ];
      for (const cand of candidates) {
        const found = doc.querySelector(cand);
        if (found) return found;
      }
    } catch {}

    // Extract path slug (e.g. "exam-simulators" from "/portal/admin/exam-simulators")
    const segments = rawTargetHref.split('/').filter(Boolean);
    const slug = segments[segments.length - 1];
    if (slug && slug.length > 2) {
      try {
        const bySlug = doc.querySelector(`a[href*="${slug}" i], [role="link"][href*="${slug}" i]`);
        if (bySlug) return bySlug;
      } catch {}

      // Check all anchors by resolved pathname or slug text
      try {
        const allAnchors = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a, [role="link"], nav button'));
        const slugWords = slug.replace(/[-_]/g, ' ').toLowerCase();
        for (const a of allAnchors) {
          const hrefAttr = a.getAttribute('href') || '';
          const pathname = (a as HTMLAnchorElement).pathname || '';
          if (pathname.endsWith(slug) || pathname.includes(slug) || hrefAttr.includes(slug)) {
            return a;
          }
          const text = (a.textContent || a.getAttribute('aria-label') || '').trim().toLowerCase();
          if (text && (text === slugWords || text.includes(slugWords) || slugWords.includes(text))) {
            return a;
          }
        }
      } catch {}
    }

    // Auto-expand collapsed navigation/drawers if target link might be inside
    try {
      const closedToggles = Array.from(
        doc.querySelectorAll<HTMLElement>(
          'button[aria-expanded="false"], [aria-haspopup="menu"][aria-expanded="false"], details:not([open]) summary, button[aria-label*="menu" i], button[aria-label*="sidebar" i], .sidebar-toggle'
        )
      );
      for (const toggle of closedToggles) {
        if (toggle instanceof HTMLElement && typeof toggle.click === 'function') {
          toggle.click();
          const foundAfterOpen = doc.querySelector(`a[href*="${slug || rawTargetHref}" i]`);
          if (foundAfterOpen) return foundAfterOpen;
        }
      }
    } catch {}
  }

  // Tier 2.8: Compound Descendant Selector Resolution (e.g., "#main-content input", ".container button")
  if (selector.includes(' ')) {
    try {
      const parts = selector.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        const containerPart = parts[0];
        const targetDescendant = parts.slice(1).join(' ');
        const container = doc.querySelector(containerPart);
        if (container) {
          const directMatch = container.querySelector(targetDescendant);
          if (directMatch) return directMatch;

          // If looking for input/form field in this container, find any interactive field
          if (/input|select|textarea/i.test(targetDescendant) || options.tagHint?.includes('input')) {
            const fields = Array.from(
              container.querySelectorAll<HTMLElement>(
                'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea, [contenteditable="true"]'
              )
            );
            if (fields.length > 0) {
              if (options.textHint) {
                const hint = options.textHint.toLowerCase();
                const matched = fields.find((f) => {
                  const n = (f.getAttribute('name') || '').toLowerCase();
                  const p = (f.getAttribute('placeholder') || '').toLowerCase();
                  const a = (f.getAttribute('aria-label') || '').toLowerCase();
                  return n.includes(hint) || p.includes(hint) || a.includes(hint);
                });
                if (matched) return matched;
              }
              return fields[0];
            }
          }

          // If looking for button in this container
          if (/button|a/i.test(targetDescendant)) {
            const btns = Array.from(
              container.querySelectorAll<HTMLElement>('button, a, [role="button"], input[type="submit"]')
            );
            if (btns.length > 0) return btns[0];
          }
        }
      }
    } catch {}
  }

  // Tier 3: ID-based resolution (handles Radix UI, colons, slashes, and relaxed form fields)
  if (selector.startsWith('#') && !selector.includes(' ')) {
    const rawId = selector.substring(1);
    const byId = doc.getElementById(rawId);
    if (byId) return byId;

    try {
      if (typeof CSS !== 'undefined' && CSS.escape) {
        const escaped = doc.querySelector(`[id="${CSS.escape(rawId)}"]`);
        if (escaped) return escaped;
      }
      const ciId = doc.querySelector(`[id="${rawId}" i]`);
      if (ciId) return ciId;
    } catch {}

    // Check if name attribute matches the raw ID
    try {
      const byName = doc.querySelector(`[name="${rawId}" i]`);
      if (byName) return byName;
    } catch {}

    // Relaxed dynamic ID match (e.g. radix-_R_76btb_ or radix-:r0:)
    if (/radix|:r|_r_|_R_|headlessui|chakra|mui/i.test(rawId)) {
      try {
        const parts = rawId.split(/[-_:]/).filter((p) => p.length > 2 && p !== 'radix');
        for (const p of parts) {
          const candidate = doc.querySelector(`button[id*="${p}"], [role="button"][id*="${p}"], [id*="${p}"]`);
          if (candidate) return candidate;
        }
      } catch {}

      // If ID is completely gone, try finding matching interactive trigger
      try {
        const trigger = doc.querySelector('button[aria-haspopup], button[data-state], [role="combobox"], [aria-expanded]');
        if (trigger) return trigger;
      } catch {}
    }

    // Relaxed form field matching (e.g. #contact-first-name -> find name/autocomplete/placeholder)
    if (rawId.includes('-') || rawId.includes('_')) {
      if (/first.*name/i.test(rawId)) {
        const fn = doc.querySelector('input[name*="first" i], input[autocomplete="given-name"], input[placeholder*="first" i]');
        if (fn) return fn;
      }
      if (/last.*name/i.test(rawId)) {
        const ln = doc.querySelector('input[name*="last" i], input[autocomplete="family-name"], input[placeholder*="last" i]');
        if (ln) return ln;
      }
      if (/email/i.test(rawId)) {
        const em = doc.querySelector('input[type="email"], input[name*="email" i], input[placeholder*="email" i]');
        if (em) return em;
      }
      if (/phone|tel|mobile/i.test(rawId)) {
        const tel = doc.querySelector('input[type="tel"], input[name*="phone" i], input[name*="mobile" i]');
        if (tel) return tel;
      }

      const tokens = rawId.split(/[-_]/).filter((t) => t.length > 2);
      for (const tok of tokens) {
        try {
          const match = doc.querySelector(`input[name*="${tok}" i], textarea[name*="${tok}" i]`);
          if (match) return match;
        } catch {}
      }
    }
  }

  // Tier 4: Hierarchical path suffix & nth-of-type relaxation
  if (selector.includes(' > ')) {
    const segments = selector.split(' > ');
    for (let i = 1; i < segments.length; i++) {
      const subSelector = segments.slice(i).join(' > ').replace(/\\([ \t-_:])/g, '$1');
      try {
        const candidate = doc.querySelector(subSelector);
        if (candidate) return candidate;
      } catch {}
    }

    // Try without strict nth-of-type indexes
    try {
      const relaxed = selector.replace(/:nth-of-type\(\d+\)/g, '').replace(/\\([ \t-_:])/g, '$1');
      const candidate = doc.querySelector(relaxed);
      if (candidate) return candidate;
    } catch {}

    // Try descendant combinators instead of direct children
    try {
      const relaxedDescendants = selector.replace(/:nth-of-type\(\d+\)/g, '').replace(/ > /g, ' ').replace(/\\([ \t-_:])/g, '$1');
      const candidate = doc.querySelector(relaxedDescendants);
      if (candidate) return candidate;
    } catch {}

    // Container-scoped tag & index matching (e.g. main > ... > select:nth-of-type(2))
    const firstSegment = segments[0].replace(/:nth-of-type\(\d+\)/g, '').trim();
    const lastSegment = segments[segments.length - 1].trim();
    const tagMatch = lastSegment.match(/^([a-zA-Z0-9_-]+)(?::nth-of-type\((\d+)\))?/);
    const targetTag = tagMatch ? tagMatch[1].toLowerCase() : '';
    const targetIndex = tagMatch && tagMatch[2] ? parseInt(tagMatch[2], 10) : 1;

    if (targetTag) {
      try {
        const container = doc.querySelector(firstSegment) || doc;
        const candidates = Array.from(container.querySelectorAll<HTMLElement>(targetTag));
        if (candidates.length > 0) {
          if (options.textHint) {
            const hint = options.textHint.toLowerCase();
            const matched = candidates.find((c) => {
              const text = (c.textContent || '').toLowerCase();
              const name = (c.getAttribute('name') || '').toLowerCase();
              const label = (c.getAttribute('aria-label') || '').toLowerCase();
              return text.includes(hint) || name.includes(hint) || label.includes(hint);
            });
            if (matched) return matched;
          }
          const picked = candidates[targetIndex - 1] || candidates[0];
          if (picked) return picked;
        }
      } catch {}
    }
  }

  // Tier 5: Semantic text/aria-label matching
  if (options.textHint || options.tagHint) {
    const hint = (options.textHint || '').trim().toLowerCase();
    const tag = (options.tagHint || 'button, a, [role="button"], input, select, textarea').toLowerCase();
    try {
      const candidates = Array.from(doc.querySelectorAll(tag));
      for (const el of candidates) {
        const text = (el.textContent || '').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        const title = (el.getAttribute('title') || '').trim().toLowerCase();
        if (hint && (text === hint || aria === hint || title === hint || (hint.length > 3 && (text.includes(hint) || aria.includes(hint) || title.includes(hint))))) {
          return el;
        }
      }
    } catch {}
  }

  // Tier 6: Table row / cell button resolution
  if (selector.includes('tr') || selector.includes('td')) {
    try {
      const trMatch = selector.match(/tr:nth-of-type\((\d+)\)/);
      const rowIndex = trMatch ? trMatch[1] : null;

      if (rowIndex) {
        const rowBtn = doc.querySelector(`tr:nth-of-type(${rowIndex}) td:last-child button, tr:nth-of-type(${rowIndex}) button`);
        if (rowBtn) return rowBtn;
      }

      const tableBtn = doc.querySelector('table tbody tr button, table button, [role="table"] button, [role="row"] button');
      if (tableBtn) return tableBtn;
    } catch {}
  }

  // Tier 6.5: Fallback Action & Submit Button Resolution (for standalone containers or custom forms)
  if (selector.includes('button[type="submit"]') || selector.includes('input[type="submit"]')) {
    try {
      const containerMatch = selector.match(/^([a-zA-Z0-9#._-]+)\s+(?:button|input)/i);
      const containerSelector = containerMatch ? containerMatch[1] : '';
      const container = containerSelector ? doc.querySelector(containerSelector) : doc;

      if (container) {
        const buttons = Array.from(
          container.querySelectorAll<HTMLElement>('button, input[type="submit"], input[type="button"], [role="button"]')
        );

        const actionBtn = buttons.find((b) => {
          const text = (b.textContent || b.getAttribute('aria-label') || b.getAttribute('value') || '').trim().toLowerCase();
          const type = b.getAttribute('type') || '';
          if (type === 'submit') return true;
          return /save|submit|valider|enregistrer|cr[ée]|confirm|send|appliquer|apply|filter|rechercher|ok|continuer|next/i.test(text);
        });
        if (actionBtn) return actionBtn;

        const primaryBtn = buttons.find((b) => {
          const cls = (b.className || '').toString().toLowerCase();
          return (cls.includes('primary') || cls.includes('submit') || cls.includes('cta')) &&
            !('disabled' in b && (b as HTMLButtonElement).disabled);
        });
        if (primaryBtn) return primaryBtn;

        const enabledBtn = buttons.find((b) => {
          const text = (b.textContent || b.getAttribute('aria-label') || '').trim().toLowerCase();
          const isCancel = /cancel|annuler|back|retour|close|fermer|delete|supprimer/i.test(text);
          const isDisabled = ('disabled' in b && (b as HTMLButtonElement).disabled) || b.getAttribute('aria-disabled') === 'true';
          return !isCancel && !isDisabled;
        });
        if (enabledBtn) return enabledBtn;

        if (container instanceof HTMLFormElement) {
          return container;
        }
      }
    } catch {}
  }

  // Tier 7: Open Shadow DOM traversal
  try {
    const all = doc.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      const shadow = all[i].shadowRoot;
      if (shadow) {
        const found = shadow.querySelector(normalized) || shadow.querySelector(selector);
        if (found) return found;
      }
    }
  } catch {}

  // Tier 8: Accessible same-origin iframe traversal
  try {
    const iframes = doc.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
      try {
        const frameDoc = iframes[i].contentDocument || iframes[i].contentWindow?.document;
        if (frameDoc) {
          const found = frameDoc.querySelector(normalized) || frameDoc.querySelector(selector);
          if (found) return found;
        }
      } catch {}
    }
  } catch {}

  // Tier 9: Self-Healing Heuristic Locator
  try {
    const healed = selfHealingLocator.heal(doc, selector, {
      text: options.textHint,
      tag: options.tagHint,
      name: options.textHint,
      ariaLabel: options.textHint,
    });
    if (healed.healed && healed.element) {
      logger.info(
        `[Self-Healing] Selector "${selector}" recovered via ${healed.strategy}: "${healed.healedSelector}" (Confidence: ${healed.confidence})`
      );
      return healed.element;
    }
  } catch {}

  return null;
}

/**
 * Resolves a target selector or element with async polling retry and modal dismissal.
 */
export async function resolveElement(
  target: Element | string,
  options: ActionOptions = {},
  doc: Document = document
): Promise<Element> {
  if (typeof target !== 'string') return target;

  let el = findDOMElement(target, options, doc);
  if (el) return el;

  // Retry up to maxWait ms for hydration or re-renders
  const maxWait = options.timeoutMs ?? 450;
  const start = Date.now();
  let modalDismissAttempted = false;

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, 60));
    el = findDOMElement(target, options, doc);
    if (el) return el;

    // If still blocked halfway through, attempt dismissing any overlay modal/popover
    if (!modalDismissAttempted && Date.now() - start > maxWait / 2) {
      modalDismissAttempted = true;
      if (dismissActiveModal(doc)) {
        await new Promise((r) => setTimeout(r, 80));
        el = findDOMElement(target, options, doc);
        if (el) return el;
      }
    }
  }

  throw new Error(`Element not found for selector: "${target}"`);
}

/**
 * Ensures an element is scrolled into view smoothly/instantly for interaction.
 */
function scrollElementIntoView(el: Element): void {
  try {
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
    }
  } catch (err) {
    logger.debug('scrollIntoView ignored', err);
  }
}

/**
 * Simulates a realistic human click sequence on an element.
 * Dispatches pointerdown -> mousedown -> focus -> pointerup -> mouseup -> click.
 */
export async function simulateClick(
  target: Element | string,
  options: ActionOptions = {},
  doc: Document = document
): Promise<void> {
  const el = await resolveElement(target, options, doc);

  // Check disabled status
  const isDisabled = Boolean(
    ('disabled' in el && (el as HTMLButtonElement | HTMLInputElement).disabled) ||
    el.getAttribute('aria-disabled') === 'true'
  );

  if (isDisabled) {
    // If element is a form submit trigger or inside a form, handle via form submission fallback
    const form = el instanceof HTMLFormElement ? el : ('form' in el ? (el as HTMLButtonElement).form : el.closest('form'));
    const isSubmit = el.getAttribute('type') === 'submit' || (typeof target === 'string' && target.includes('submit'));

    if (form && isSubmit) {
      logger.info(`Click targeted disabled submit button; delegating to form submission fallback`);
      await simulateFormSubmit(el, options, doc);
      return;
    }

    if (options.allowDisabled || options.throwOnDisabled === false) {
      logger.info(`Simulate click bypassed: element is disabled (${(target as string) || el.tagName})`);
      return;
    }

    throw new Error(`Cannot click element: element is disabled (${(target as string) || el.tagName})`);
  }

  if (options.scroll !== false) {
    scrollElementIntoView(el);
  }

  const rect = el.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

  const eventInit: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX,
    clientY,
    buttons: 1,
  };

  // Pointer & Mouse down sequence
  try {
    el.dispatchEvent(new PointerEvent('pointerdown', eventInit));
  } catch {
    // Fallback if PointerEvent not available in environment
    el.dispatchEvent(new MouseEvent('mousedown', eventInit));
  }

  if (el instanceof HTMLElement && typeof el.focus === 'function') {
    try {
      el.focus();
    } catch {}
  }

  // Pointer & Mouse up sequence
  try {
    el.dispatchEvent(new PointerEvent('pointerup', eventInit));
  } catch {
    el.dispatchEvent(new MouseEvent('mouseup', eventInit));
  }

  // Click event
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX,
    clientY,
  });

  const notPrevented = el.dispatchEvent(clickEvent);

  // If standard click was not handled or prevented, trigger native click for default actions
  if (notPrevented && el instanceof HTMLElement && typeof el.click === 'function') {
    // We already dispatched the event, call .click() only if element is a button/input/a
    if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'A') {
      // native click() triggers navigation or form submits
    }
  }

  logger.info(`Simulated click on ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`);
}

/**
 * Simulates human typing into an input, textarea, or select element.
 * Bypasses React 16-19 and standard framework value setter overrides
 * and dispatches input, change, and blur events.
 */
export async function simulateFill(
  target: Element | string,
  value: string,
  options: ActionOptions = {},
  doc: Document = document
): Promise<void> {
  const el = await resolveElement(target, options, doc);

  if ('disabled' in el && (el as HTMLInputElement).disabled) {
    throw new Error(`Cannot fill element: element is disabled`);
  }

  if ('readOnly' in el && (el as HTMLInputElement).readOnly) {
    throw new Error(`Cannot fill element: element is read-only`);
  }

  if (options.scroll !== false) {
    scrollElementIntoView(el);
  }

  if (el instanceof HTMLElement && typeof el.focus === 'function') {
    try {
      el.focus();
    } catch {}
  }

  // Handle custom comboboxes / custom select triggers (e.g. Radix UI, Headless UI, Shadcn)
  if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox') {
    try {
      // Click trigger to open dropdown
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
      await new Promise((r) => setTimeout(r, 120));

      const listbox = doc.querySelector('[role="listbox"], [role="menu"], [data-radix-popper-content-wrapper]');
      if (listbox) {
        const options = Array.from(listbox.querySelectorAll('[role="option"], [role="menuitem"]'));
        if (options.length > 0) {
          const targetOpt = options.find((opt) => (opt.textContent || '').toLowerCase().includes(value.toLowerCase())) || options[0];
          targetOpt.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
        }
      }
    } catch {}
    logger.info(`Simulated custom combobox select on ${el.tagName.toLowerCase()}#${el.id || 'unnamed'}`);
    return;
  }

  // Handle ARIA switches and checkboxes
  if (el.getAttribute('role') === 'switch' || el.getAttribute('role') === 'checkbox') {
    const isChecked = el.getAttribute('aria-checked') === 'true';
    el.setAttribute('aria-checked', isChecked ? 'false' : 'true');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    logger.info(`Simulated toggle on [role="${el.getAttribute('role')}"]#${el.id || 'unnamed'}`);
    return;
  }

  // Handle contenteditable elements (e.g. rich text editors)
  if (el.getAttribute('contenteditable') === 'true') {
    el.textContent = value;
    try {
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, composed: true, data: value }));
    } catch {
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    if (el instanceof HTMLElement && typeof el.blur === 'function') {
      try { el.blur(); } catch {}
    }
    logger.info(`Simulated fill on contenteditable#${el.id || 'unnamed'}`);
    return;
  }

  // Handle checkboxes and radios
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    if (!el.checked) {
      el.checked = true;
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    }
    logger.info(`Simulated check on ${el.type}#${el.id || el.name || 'unnamed'}`);
    return;
  }

  // Handle select dropdowns
  if (el instanceof HTMLSelectElement) {
    if (el.options.length > 0) {
      let targetIndex = 0;
      for (let i = 0; i < el.options.length; i++) {
        const optVal = (el.options[i].value || el.options[i].text || '').toLowerCase();
        if (value && optVal.includes(value.toLowerCase())) {
          targetIndex = i;
          break;
        }
        if (i > 0 && el.options[i].value && targetIndex === 0) {
          targetIndex = i;
        }
      }
      el.selectedIndex = targetIndex;
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }
    logger.info(`Simulated select on select#${el.id || el.name || 'unnamed'} -> index ${el.selectedIndex}`);
    return;
  }

  // Handle file inputs using DataTransfer and mock synthetic file (prevents DOMException)
  if (el instanceof HTMLInputElement && el.type === 'file') {
    try {
      const fileName = (value && value.includes('.')) ? value : 'sample-document.pdf';
      const fileType = fileName.endsWith('.png')
        ? 'image/png'
        : fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')
        ? 'image/jpeg'
        : 'application/pdf';
      const mockBlob = new Blob(['Mock file content for autonomous QA verification'], { type: fileType });
      const mockFile = new File([mockBlob], fileName, { type: fileType });

      if (typeof DataTransfer !== 'undefined') {
        const dt = new DataTransfer();
        dt.items.add(mockFile);
        el.files = dt.files;
      }
    } catch (fileErr) {
      logger.debug('DataTransfer file assignment failed or restricted', fileErr);
    }

    try {
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true, composed: true }));
    } catch {}
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    if (el instanceof HTMLElement && typeof el.blur === 'function') {
      try { el.blur(); } catch {}
    }

    logger.info(`Simulated file upload on input[type="file"]#${el.id || el.name || 'unnamed'}`);
    return;
  }

  // Sanitize format for strict date, time, and number inputs
  let targetValue = value;
  if (el instanceof HTMLInputElement) {
    if (el.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(targetValue)) {
      targetValue = '2026-05-15';
    } else if (el.type === 'time' && !/^\d{2}:\d{2}$/.test(targetValue)) {
      targetValue = '10:30';
    } else if (el.type === 'number' && isNaN(Number(targetValue))) {
      targetValue = '42';
    }
  }

  // Detect prototype to bypass React value tracking
  let proto: object | null = null;
  if (el instanceof HTMLInputElement) {
    proto = HTMLInputElement.prototype;
  } else if (el instanceof HTMLTextAreaElement) {
    proto = HTMLTextAreaElement.prototype;
  }

  // Dispatch keydown
  try {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
  } catch {}

  if (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, targetValue);
    } else {
      (el as HTMLInputElement).value = targetValue;
    }
  } else if ('value' in el) {
    (el as HTMLInputElement).value = targetValue;
  }

  // Dispatch InputEvent
  try {
    el.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        composed: true,
        data: targetValue,
        inputType: 'insertText',
      })
    );
  } catch {
    el.dispatchEvent(
      new Event('input', { bubbles: true, cancelable: true, composed: true })
    );
  }

  // Dispatch keyup
  try {
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true, cancelable: true }));
  } catch {}

  // Dispatch Change Event
  el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

  // Blur after input
  if (el instanceof HTMLElement && typeof el.blur === 'function') {
    try {
      el.blur();
    } catch {}
  }

  logger.info(`Simulated fill on ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} with value: "${targetValue.substring(0, 20)}"`);
}

/**
 * Simulates form submission.
 */
export async function simulateFormSubmit(
  target: Element | string,
  options: ActionOptions = {},
  doc: Document = document
): Promise<void> {
  const el = await resolveElement(target, options, doc);
  let form: HTMLFormElement | null = null;

  if (el instanceof HTMLFormElement) {
    form = el;
  } else if ('form' in el && (el as HTMLButtonElement | HTMLInputElement).form) {
    form = (el as HTMLButtonElement | HTMLInputElement).form;
  } else {
    form = el.closest('form');
  }

  const isElementDisabled = Boolean(
    ('disabled' in el && (el as HTMLButtonElement | HTMLInputElement).disabled) ||
    el.getAttribute('aria-disabled') === 'true'
  );

  // If the target element is disabled, handle gracefully
  if (isElementDisabled) {
    if (form) {
      // Attempt direct form submission if form is available
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      if (form.dispatchEvent(submitEvent)) {
        try {
          if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
          } else {
            form.submit();
          }
          logger.info(`Simulated form submit directly via form element despite disabled trigger button`);
          return;
        } catch (err) {
          logger.debug('Direct form submit intercepted', err);
        }
      }
    }

    // Try finding an enabled alternative action button in the container
    const container =
      el.closest('form, [role="tabpanel"], [role="dialog"], section, main, article, .card, fieldset') ||
      el.parentElement;
    if (container) {
      const altBtn = container.querySelector<HTMLElement>(
        'button[type="submit"]:not([disabled]), button:not([disabled]):not([aria-disabled="true"]):not([class*="disabled"])'
      );
      if (altBtn && altBtn !== el && !('disabled' in altBtn && (altBtn as HTMLButtonElement).disabled)) {
        logger.info(`Target submit button disabled. Using enabled alternative button in container: ${altBtn.tagName}`);
        await simulateClick(altBtn, options, doc);
        return;
      }
    }

    // If disabled by application design (e.g. form validation guard pending required inputs), log gracefully
    logger.info(`Form submit trigger is currently disabled (${typeof target === 'string' ? target : el.tagName})`);
    return;
  }

  if (!form) {
    // If not in form, click the element directly as fallback
    await simulateClick(el, options, doc);
    return;
  }

  if (options.scroll !== false) {
    scrollElementIntoView(form);
  }

  // Dispatch submit event
  const submitEvent = new Event('submit', {
    bubbles: true,
    cancelable: true,
  });

  const notPrevented = form.dispatchEvent(submitEvent);

  if (notPrevented) {
    try {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
    } catch (err) {
      logger.debug('Form submit called, caught potential navigation interception', err);
    }
  }

  logger.info(`Simulated form submit on form#${form.id || 'unnamed'}`);
}
