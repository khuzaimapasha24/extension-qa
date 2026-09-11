import { PageSnapshot, DiscoveredForm } from '../shared/types/discovery';
import { ActionRiskLevel, TestPlan, TestTask } from '../shared/types/agent';
import { SessionConfig } from '../shared/types/session';
import { generateSyntheticValue } from '../shared/constants/synthetic-data';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('AgentPlanner');

const HIGH_RISK_PATTERNS = [
  /delete/i,
  /remove/i,
  /destroy/i,
  /terminate/i,
  /checkout/i,
  /pay(?:ment)?/i,
  /purchase/i,
  /buy\s+now/i,
  /credit\s*card/i,
  /stripe/i,
  /billing/i,
  /password/i,
  /reset\s*password/i,
  /change\s*password/i,
  /danger/i,
];

const MEDIUM_RISK_PATTERNS = [
  /submit/i,
  /save/i,
  /update/i,
  /confirm/i,
  /apply/i,
  /send/i,
  /order/i,
];

export class AgentPlanner {
  /**
   * Assesses risk level of an interaction based on element attributes and context.
   */
  public assessRisk(info: {
    text?: string;
    name?: string;
    id?: string;
    selector?: string;
    action?: string;
  }): ActionRiskLevel {
    const combined = `${info.text || ''} ${info.name || ''} ${info.id || ''} ${info.selector || ''} ${info.action || ''}`;

    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.test(combined)) {
        return 'HIGH';
      }
    }

    for (const pattern of MEDIUM_RISK_PATTERNS) {
      if (pattern.test(combined)) {
        return 'MEDIUM';
      }
    }

    return 'LOW';
  }

  /**
   * Generates safe RFC 2606 and multi-lingual synthetic values for form inputs.
   */
  public generateSyntheticValuesForForm(form: DiscoveredForm): Record<string, string> {
    const values: Record<string, string> = {};

    for (const field of form.fields) {
      values[field.selector] = generateSyntheticValue({
        name: field.name,
        type: field.type,
        placeholder: field.placeholder,
        label: field.label,
        selector: field.selector,
      });
    }

    return values;
  }

  /**
   * Plans an ordered sequence of test tasks from the discovered page snapshot.
   */
  public planTasks(
    snapshot: PageSnapshot,
    sessionId: string,
    _config?: Partial<SessionConfig>
  ): TestPlan {
    const tasks: TestTask[] = [];
    let taskCounter = 0;

    // 1. Plan Sidebar & Navigation Tabs (Crucial for Dashboards & SPAs)
    if (snapshot.tabs && snapshot.tabs.length > 0) {
      const maxTabs = 15;
      const prioritizedTabs = snapshot.tabs.slice(0, maxTabs);

      for (const tab of prioritizedTabs) {
        taskCounter++;
        tasks.push({
          id: `task_${sessionId}_${taskCounter}`,
          type: 'TAB_CLICK',
          title: `Explore Tab: "${tab.text.substring(0, 30)}"`,
          description: `Navigate to dashboard tab/view "${tab.text}" and inspect newly rendered content`,
          targetSelector: tab.selector,
          targetElementInfo: {
            tag: tab.role,
            text: tab.text,
            role: tab.role,
          },
          riskLevel: 'LOW',
          expectedOutcome: 'Clicking tab changes view state, displays tab panel, and loads section without JavaScript errors.',
          status: 'PENDING',
        });
      }
    }

    // 2. Plan Form & Standalone Panel Tasks (Fill and Submit)
    for (const form of snapshot.forms) {
      if (form.fields.length === 0) continue;

      const risk = this.assessRisk({
        id: form.id,
        name: form.name,
        action: form.action,
        selector: form.selector,
      });

      const syntheticValues = this.generateSyntheticValuesForForm(form);

      // Task 2a: Fill form fields
      taskCounter++;
      const formTitle = form.name || form.id || 'unnamed';
      tasks.push({
        id: `task_${sessionId}_${taskCounter}`,
        type: 'FORM_FILL',
        title: form.isStandalone
          ? `Populate Data: ${formTitle} (${form.fields.length} inputs)`
          : `Populate Form (${form.fields.length} fields)`,
        description: `Fill form inputs safely using multi-lingual synthetic test data`,
        targetSelector: form.selector,
        targetElementInfo: {
          tag: form.containerTag || 'form',
          name: formTitle,
        },
        riskLevel: risk,
        expectedOutcome: 'All form inputs receive valid synthetic values without throwing client-side validation errors.',
        inputData: syntheticValues,
        status: 'PENDING',
      });

      // Task 2b: Submit form (if submit button exists and is not disabled, or if traditional form is present)
      if (form.submitButtonSelector || !form.isStandalone) {
        const isKnownDisabled = Boolean(
          form.submitButtonSelector &&
          snapshot.buttons.some((b) => b.selector === form.submitButtonSelector && b.isDisabled)
        );

        if (!isKnownDisabled) {
          taskCounter++;
          tasks.push({
            id: `task_${sessionId}_${taskCounter}`,
            type: 'FORM_SUBMIT',
            title: form.isStandalone
              ? `Trigger Action: ${formTitle}`
              : `Submit Form (${formTitle})`,
            description: `Trigger form submission/save and observe validation/API response`,
            targetSelector: form.submitButtonSelector || form.selector,
            targetElementInfo: {
              tag: form.submitButtonSelector ? 'button' : 'form',
              text: formTitle,
            },
            riskLevel: risk,
            expectedOutcome: 'Form submission dispatches without unhandled JavaScript exceptions or broken HTTP 5xx responses.',
            status: 'PENDING',
          });
        }
      }
    }

    // 2. Plan Button Click Tasks
    const maxButtons = 15;
    const prioritizedButtons = snapshot.buttons
      .filter((b) => !b.isDisabled && b.isVisible)
      .slice(0, maxButtons);

    for (const button of prioritizedButtons) {
      const risk = this.assessRisk({
        text: button.text,
        selector: button.selector,
      });

      const buttonLabel = button.text || button.ariaLabel || '';
      taskCounter++;
      tasks.push({
        id: `task_${sessionId}_${taskCounter}`,
        type: 'BUTTON_CLICK',
        title: `Click Button: "${buttonLabel.substring(0, 30) || button.selector}"`,
        description: `Verify interactive response, DOM state change, or modal opening on click`,
        targetSelector: button.selector,
        targetElementInfo: {
          tag: 'button',
          text: buttonLabel,
          ariaLabel: button.ariaLabel,
          role: button.role,
        },
        riskLevel: risk,
        expectedOutcome: 'Clicking button produces DOM state change, opens modal, or triggers network action without runtime error.',
        status: 'PENDING',
      });
    }

    // 3. Plan Link Navigation Tasks
    const maxLinks = 8;
    const internalLinks = snapshot.links
      .filter((l) => l.isInternal && !l.isAnchor && !l.isMailtoOrTel)
      .slice(0, maxLinks);

    for (const link of internalLinks) {
      taskCounter++;
      tasks.push({
        id: `task_${sessionId}_${taskCounter}`,
        type: 'LINK_CLICK',
        title: `Navigate Route: "${link.text.substring(0, 25) || link.href}"`,
        description: `Verify navigation to internal route: ${link.href}`,
        targetSelector: link.selector,
        targetElementInfo: {
          tag: 'a',
          text: link.text,
        },
        riskLevel: 'LOW',
        expectedOutcome: 'Internal route loads without 404/500 or broken page state.',
        status: 'PENDING',
      });
    }

    const plan: TestPlan = {
      id: `plan_${sessionId}_${Date.now()}`,
      sessionId,
      pageUrl: snapshot.url,
      tasks,
      createdAt: Date.now(),
      status: 'PENDING',
    };

    logger.info(`Planned ${tasks.length} tasks for session ${sessionId} on ${snapshot.url}`);
    return plan;
  }
}

export const agentPlanner = new AgentPlanner();
