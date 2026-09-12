import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowLearner } from '../../src/agent/workflow-learner';
import { dbClient } from '../../src/storage/indexed-db';
import { TestPlan } from '../../src/shared/types/agent';
import { PageSnapshot } from '../../src/shared/types/discovery';
import { QASession } from '../../src/shared/types/session';

describe('WorkflowLearner (Autonomous Agent Memory Engine)', () => {
  let learner: WorkflowLearner;

  beforeEach(async () => {
    learner = new WorkflowLearner();
    try {
      await dbClient.clear('learned_workflows');
    } catch {}
  });

  it('generates consistent workflow keys from URLs', () => {
    const key1 = learner.generateWorkflowKey('https://example.com/dashboard/complaints?filter=active#section');
    expect(key1.origin).toBe('https://example.com');
    expect(key1.path).toBe('/dashboard/complaints');
    expect(key1.id).toBe('https://example.com#/dashboard/complaints');
  });

  it('learns and persists working selectors and form presets from completed session', async () => {
    const session: QASession = {
      id: 'sess_learn_1',
      tabId: 10,
      url: 'https://app.example.com/tickets',
      origin: 'https://app.example.com',
      title: 'Ticket Portal',
      progress: 100,
      currentAction: 'Done',
      state: 'COMPLETED',
      startTime: Date.now() - 5000,
      stats: {
        pagesDiscovered: 1,
        pagesCrawled: 1,
        elementsDiscovered: 3,
        testsExecuted: 3,
        passedCount: 3,
        failedCount: 0,
        warningsCount: 0,
        criticalBugsCount: 0,
      },
      config: {
        crawlDepth: 1,
        maxPages: 1,
        privacyMode: false,
        requireApprovalForHighRisk: false,
        enabledCategories: ['FUNCTIONAL'],
        supabase: { enabled: false, url: '', anonKey: '', storageBucket: '' },
        ai: { provider: 'auto', geminiApiKey: '', geminiModel: '', openaiApiKey: '', openaiModel: '', anthropicApiKey: '', anthropicModel: '' },
        advanced: { businessLogicVerification: false, virtualMailboxEnabled: false, chaosTestingEnabled: false, backendVerificationEnabled: false },
      },
    };

    const plan: TestPlan = {
      id: 'plan_learn_1',
      pageUrl: 'https://app.example.com/tickets',
      sessionId: 'sess_learn_1',
      status: 'COMPLETED',
      createdAt: Date.now(),
      tasks: [
        {
          id: 'task_1',
          type: 'TAB_CLICK',
          title: 'Navigate to Complaints Tab',
          description: 'Navigates to complaints',
          targetSelector: 'a[href="/dashboard/complaints"]',
          riskLevel: 'LOW',
          expectedOutcome: 'Loads section',
          status: 'PASSED',
        },
        {
          id: 'task_2',
          type: 'FORM_FILL',
          title: 'Fill Complaint Form',
          description: 'Fills complaint form',
          targetSelector: '#complaint-form',
          riskLevel: 'LOW',
          expectedOutcome: 'Fills inputs',
          inputData: {
            '#subject': 'Service Issue',
            '#attachment': 'doc.pdf',
          },
          status: 'PASSED',
        },
        {
          id: 'task_3',
          type: 'FORM_SUBMIT',
          title: 'Submit Complaint Form',
          description: 'Submits complaint form',
          targetSelector: '#submit-btn',
          riskLevel: 'LOW',
          expectedOutcome: 'Submits form',
          status: 'PASSED',
        },
      ],
    };

    const snapshot: PageSnapshot = {
      url: 'https://app.example.com/tickets',
      origin: 'https://app.example.com',
      pathname: '/tickets',
      title: 'Ticket Portal',
      timestamp: Date.now(),
      links: [],
      buttons: [],
      forms: [],
      images: [],
      navigations: [],
      totalInteractiveCount: 3,
      metadata: {
        title: 'Ticket Portal',
        h1Count: 1,
        h1Texts: ['Portal'],
        headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      },
    };

    const learned = await learner.learnFromSession(session, plan, snapshot);
    expect(learned).not.toBeNull();
    expect(learned?.actionSteps.length).toBe(3);
    expect(learned?.formPresets['#complaint-form']).toBeDefined();
    expect(learned?.formPresets['#complaint-form']['#subject']).toBe('Service Issue');

    // Retrieve from storage
    const retrieved = await learner.getLearnedWorkflow('https://app.example.com/tickets');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('https://app.example.com#/tickets');
  });

  it('generates an autonomous Zero-AI TestPlan from learned workflow memory', async () => {
    const workflow = {
      id: 'https://test.com#/login',
      origin: 'https://test.com',
      url: 'https://test.com/login',
      path: '/login',
      title: 'Login Page',
      learnedSelectors: {},
      formPresets: {
        '#login-form': { '#user': 'qa-user@example.invalid' },
      },
      actionSteps: [
        { type: 'FORM_FILL' as const, selector: '#login-form', label: 'Enter Credentials' },
        { type: 'FORM_SUBMIT' as const, selector: '#login-submit', label: 'Submit Login' },
      ],
      executionCount: 5,
      autonomousSuccessCount: 5,
      lastVerified: Date.now(),
      selfRelianceRatio: 1.0,
    };

    const autonomousPlan = learner.generateAutonomousPlan(workflow, 'sess_auto_1');
    expect(autonomousPlan.tasks.length).toBe(2);
    expect(autonomousPlan.tasks[0].type).toBe('FORM_FILL');
    expect(autonomousPlan.tasks[0].inputData).toEqual({ '#user': 'qa-user@example.invalid' });
    expect(autonomousPlan.tasks[1].targetSelector).toBe('#login-submit');
    expect(autonomousPlan.tasks[0].description).toContain('Zero AI API Call');
  });

  it('updates autonomous success count and self-reliance ratio', async () => {
    const workflow = {
      id: 'https://portal.org#/home',
      origin: 'https://portal.org',
      url: 'https://portal.org/home',
      path: '/home',
      title: 'Home Page',
      learnedSelectors: {},
      formPresets: {},
      actionSteps: [{ type: 'BUTTON_CLICK' as const, selector: '#start' }],
      executionCount: 1,
      autonomousSuccessCount: 1,
      lastVerified: Date.now(),
      selfRelianceRatio: 1.0,
    };

    await dbClient.put('learned_workflows', workflow);
    await learner.recordAutonomousSuccess(workflow.id);

    const updated = await learner.getLearnedWorkflow(workflow.url);
    expect(updated?.executionCount).toBe(2);
    expect(updated?.autonomousSuccessCount).toBe(2);
    expect(updated?.selfRelianceRatio).toBe(1.0);
  });
});
