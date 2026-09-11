import { describe, it, expect } from 'vitest';
import { AgentPlanner } from '../../src/agent/planner';
import { PageSnapshot } from '../../src/shared/types/discovery';

describe('AgentPlanner', () => {
  const planner = new AgentPlanner();

  describe('assessRisk', () => {
    it('identifies HIGH risk actions for checkout and destructive operations', () => {
      expect(planner.assessRisk({ text: 'Delete Account' })).toBe('HIGH');
      expect(planner.assessRisk({ text: 'Proceed to Checkout' })).toBe('HIGH');
      expect(planner.assessRisk({ name: 'stripe_payment_btn' })).toBe('HIGH');
      expect(planner.assessRisk({ id: 'reset-password-btn' })).toBe('HIGH');
    });

    it('identifies MEDIUM risk actions for state submissions', () => {
      expect(planner.assessRisk({ text: 'Submit Feedback' })).toBe('MEDIUM');
      expect(planner.assessRisk({ text: 'Update Profile' })).toBe('MEDIUM');
      expect(planner.assessRisk({ action: '/api/order' })).toBe('MEDIUM');
    });

    it('classifies standard UI buttons and navigation as LOW risk', () => {
      expect(planner.assessRisk({ text: 'Learn More' })).toBe('LOW');
      expect(planner.assessRisk({ text: 'Toggle Dark Mode' })).toBe('LOW');
      expect(planner.assessRisk({ selector: '.tab-item' })).toBe('LOW');
    });
  });

  describe('planTasks', () => {
    const mockSnapshot: PageSnapshot = {
      url: 'https://example.com/app',
      origin: 'https://example.com',
      pathname: '/app',
      title: 'App Home',
      metadata: {
        title: 'App Home',
        description: 'App',
        h1Count: 1,
        h1Texts: ['App'],
        headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      },
      links: [
        {
          href: 'https://example.com/dashboard',
          normalizedUrl: 'https://example.com/dashboard',
          text: 'Dashboard',
          selector: 'a[href="/dashboard"]',
          isInternal: true,
          isAnchor: false,
          isMailtoOrTel: false,
        },
      ],
      buttons: [
        {
          text: 'Open Settings',
          type: 'button',
          selector: 'button#settings-btn',
          isVisible: true,
          isDisabled: false,
          riskLevel: 'LOW',
        },
        {
          text: 'Delete Project',
          type: 'button',
          selector: 'button#delete-project',
          isVisible: true,
          isDisabled: false,
          riskLevel: 'HIGH',
        },
      ],
      forms: [
        {
          selector: 'form#contact-form',
          id: 'contact-form',
          action: '/api/contact',
          method: 'POST',
          riskLevel: 'LOW',
          fields: [
            {
              selector: 'input#email',
              type: 'email',
              name: 'email',
              required: true,
            },
            {
              selector: 'input#name',
              type: 'text',
              name: 'full_name',
              required: false,
            },
          ],
          submitButtonSelector: 'button[type="submit"]',
        },
      ],
      images: [],
      navigations: [],
      totalInteractiveCount: 4,
      timestamp: Date.now(),
    };

    it('generates an ordered TestPlan with forms, buttons, and links', () => {
      const plan = planner.planTasks(mockSnapshot, 'session_123');

      expect(plan).toBeDefined();
      expect(plan.tasks.length).toBe(5); // 2 form tasks + 2 button tasks + 1 link task
      expect(plan.sessionId).toBe('session_123');

      // Form fill & submit
      const formFill = plan.tasks.find((t) => t.type === 'FORM_FILL');
      expect(formFill).toBeDefined();
      expect(formFill?.inputData?.['input#email']).toBe('qa-test@example.invalid');

      const formSubmit = plan.tasks.find((t) => t.type === 'FORM_SUBMIT');
      expect(formSubmit).toBeDefined();

      // High risk button
      const deleteBtnTask = plan.tasks.find((t) => t.title.includes('Delete Project'));
      expect(deleteBtnTask?.riskLevel).toBe('HIGH');

      // Low risk button
      const settingsBtnTask = plan.tasks.find((t) => t.title.includes('Open Settings'));
      expect(settingsBtnTask?.riskLevel).toBe('LOW');

      // Link task
      const linkTask = plan.tasks.find((t) => t.type === 'LINK_CLICK');
      expect(linkTask).toBeDefined();
      expect(linkTask?.riskLevel).toBe('LOW');
    });

    it('plans TAB_CLICK tasks when navigation tabs are present in snapshot', () => {
      const snapshotWithTabs: PageSnapshot = {
        ...mockSnapshot,
        tabs: [
          { text: "Vue d'ensemble", role: 'tab', selector: 'button#tab-1', isActive: true },
          { text: 'Mon profil et paramètres', role: 'tab', selector: 'button#tab-2', isActive: false },
        ],
      };

      const plan = planner.planTasks(snapshotWithTabs, 'session_tabs');

      const tabTasks = plan.tasks.filter((t) => t.type === 'TAB_CLICK');
      expect(tabTasks.length).toBe(2);
      expect(tabTasks[0].title).toContain("Vue d'ensemble");
      expect(tabTasks[1].title).toContain('Mon profil et paramètres');
      expect(tabTasks[0].targetSelector).toBe('button#tab-1');
    });
  });
});
