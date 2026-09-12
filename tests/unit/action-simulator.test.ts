import { describe, it, expect, beforeEach } from 'vitest';
import { simulateClick, simulateFill, simulateFormSubmit, findDOMElement } from '../../src/content/action-simulator';

describe('ActionSimulator', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  describe('simulateClick', () => {
    it('dispatches full pointerdown -> mousedown -> click sequence', async () => {
      const button = document.createElement('button');
      button.id = 'test-btn';
      button.textContent = 'Click Me';
      container.appendChild(button);

      const eventsFired: string[] = [];
      button.addEventListener('pointerdown', () => eventsFired.push('pointerdown'));
      button.addEventListener('mousedown', () => eventsFired.push('mousedown'));
      button.addEventListener('mouseup', () => eventsFired.push('mouseup'));
      button.addEventListener('click', () => eventsFired.push('click'));

      await simulateClick(button, { scroll: false });

      expect(eventsFired).toContain('click');
      expect(eventsFired.length).toBeGreaterThanOrEqual(2);
    });

    it('resolves selector string correctly', async () => {
      const button = document.createElement('button');
      button.className = 'custom-action-btn';
      container.appendChild(button);

      let clicked = false;
      button.addEventListener('click', () => {
        clicked = true;
      });

      await simulateClick('.custom-action-btn', { scroll: false });
      expect(clicked).toBe(true);
    });

    it('throws when target element is disabled', async () => {
      const button = document.createElement('button');
      button.id = 'disabled-btn';
      button.disabled = true;
      container.appendChild(button);

      await expect(simulateClick(button)).rejects.toThrow(/disabled/i);
    });

    it('bypasses error when target element is disabled and allowDisabled is true', async () => {
      const button = document.createElement('button');
      button.id = 'disabled-btn';
      button.disabled = true;
      container.appendChild(button);

      await expect(simulateClick(button, { allowDisabled: true })).resolves.not.toThrow();
    });

    it('throws when selector is not found', async () => {
      await expect(simulateClick('#non-existent-selector')).rejects.toThrow(/not found/i);
    });
  });

  describe('simulateFill', () => {
    it('populates text input and triggers input and change events', async () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'username-input';
      container.appendChild(input);

      let inputDispatched = false;
      let changeDispatched = false;

      input.addEventListener('input', () => {
        inputDispatched = true;
      });
      input.addEventListener('change', () => {
        changeDispatched = true;
      });

      await simulateFill(input, 'test-user-value', { scroll: false });

      expect(input.value).toBe('test-user-value');
      expect(inputDispatched).toBe(true);
      expect(changeDispatched).toBe(true);
    });

    it('populates textarea element', async () => {
      const textarea = document.createElement('textarea');
      textarea.id = 'comment-area';
      container.appendChild(textarea);

      await simulateFill(textarea, 'Multiline test content', { scroll: false });
      expect(textarea.value).toBe('Multiline test content');
    });

    it('throws error when input is disabled or read-only', async () => {
      const disabledInput = document.createElement('input');
      disabledInput.disabled = true;
      container.appendChild(disabledInput);

      await expect(simulateFill(disabledInput, 'val')).rejects.toThrow(/disabled/i);

      const readOnlyInput = document.createElement('input');
      readOnlyInput.readOnly = true;
      container.appendChild(readOnlyInput);

      await expect(simulateFill(readOnlyInput, 'val')).rejects.toThrow(/read-only/i);
    });

    it('handles file inputs cleanly with DataTransfer and change event without throwing DOMException', async () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'document-upload';
      container.appendChild(fileInput);

      let changeFired = false;
      fileInput.addEventListener('change', () => {
        changeFired = true;
      });

      await expect(simulateFill(fileInput, 'evidence.pdf', { scroll: false })).resolves.not.toThrow();
      expect(changeFired).toBe(true);
    });
  });

  describe('simulateFormSubmit', () => {
    it('dispatches submit event on form', async () => {
      const form = document.createElement('form');
      form.id = 'login-form';
      const submitBtn = document.createElement('button');
      submitBtn.type = 'submit';
      form.appendChild(submitBtn);
      container.appendChild(form);

      let submitted = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitted = true;
      });

      await simulateFormSubmit(form, { scroll: false });
      expect(submitted).toBe(true);
    });

    it('submits form when given a submit button inside the form', async () => {
      const form = document.createElement('form');
      const submitBtn = document.createElement('button');
      submitBtn.id = 'inner-submit-btn';
      form.appendChild(submitBtn);
      container.appendChild(form);

      let submitted = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitted = true;
      });

      await simulateFormSubmit(submitBtn, { scroll: false });
      expect(submitted).toBe(true);
    });
  });

  describe('Resilient findDOMElement', () => {
    it('resolves links by slug or relative path when exact href attribute differs', () => {
      const link = document.createElement('a');
      link.setAttribute('href', '/portal/admin/exam-simulators');
      link.textContent = 'Exam Simulators';
      container.appendChild(link);

      const found = findDOMElement('a[href="/portal/admin/exam-simulators"]', {}, document);
      expect(found).toBe(link);

      // Relative slug resolution
      const foundSlug = findDOMElement('a[href="exam-simulators"]', {}, document);
      expect(foundSlug).toBe(link);
    });

    it('resolves relaxed hierarchical select selectors when intermediate wrappers shift', () => {
      const main = document.createElement('main');
      const div1 = document.createElement('div');
      const div2 = document.createElement('div');
      const select1 = document.createElement('select');
      select1.name = 'status';
      const select2 = document.createElement('select');
      select2.name = 'trainer';

      div1.appendChild(select1);
      div2.appendChild(select2);
      main.appendChild(div1);
      main.appendChild(div2);
      container.appendChild(main);

      // Selector with deep rigid nth-of-type path that shifted
      const resolved = findDOMElement('main > div > div:nth-of-type(2) > select:nth-of-type(2)', {}, document);
      expect(resolved).toBe(select2);
    });

    it('resolves fallback action button in container when button[type="submit"] is queried but absent', () => {
      const main = document.createElement('main');
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Enregistrer';
      main.appendChild(saveBtn);
      container.appendChild(main);

      const resolved = findDOMElement('main button[type="submit"], main input[type="submit"]', {}, document);
      expect(resolved).toBe(saveBtn);
    });
  });
});
