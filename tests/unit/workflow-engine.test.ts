import { describe, it, expect, vi } from 'vitest';
import { workflowEngine } from '../../src/agent/workflow-engine';
import { PageSnapshot } from '../../src/shared/types/discovery';
import * as messaging from '../../src/shared/messaging/bus';

describe('WorkflowEngine', () => {
  it('executes real user creation journey with synthetic data, form submission, and network interception', async () => {
    const mockSnapshot: PageSnapshot = {
      url: 'https://app.example.com/admin/students',
      origin: 'https://app.example.com',
      pathname: '/admin/students',
      title: 'Répertoire des étudiants',
      metadata: {
        title: 'Répertoire des étudiants',
        h1Count: 1,
        h1Texts: ['Répertoire'],
        headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      },
      links: [],
      buttons: [
        {
          selector: 'button.btn-add',
          text: 'Nouveau Candidat',
          type: 'button',
          isVisible: true,
          isDisabled: false,
          riskLevel: 'LOW',
        },
      ],
      forms: [
        {
          selector: 'form#create-user-form',
          action: '/api/candidates',
          method: 'POST',
          riskLevel: 'LOW',
          fields: [
            {
              selector: 'input[name="nom"]',
              name: 'nom',
              type: 'text',
              label: 'Nom',
              required: true,
            },
            {
              selector: 'input[name="email"]',
              name: 'email',
              type: 'email',
              label: 'Courriel',
              required: true,
            },
            {
              selector: 'button[type="submit"]',
              name: 'submit',
              type: 'submit',
              label: 'Enregistrer',
              required: false,
            },
          ],
        },
      ],
      images: [],
      navigations: [],
      totalInteractiveCount: 3,
      timestamp: Date.now(),
    };

    // Spy on messaging to tab
    vi.spyOn(messaging, 'sendToTab').mockImplementation(async (_tabId: number, type: any): Promise<any> => {
      if (type === 'EXECUTE_ACTION') {
        return { executed: true, actionType: 'CLICK', selector: 'button.btn-add', durationMs: 40 };
      }
      if (type === 'SCAN_PAGE_DISCOVERY') {
        return { snapshot: mockSnapshot };
      }
      if (type === 'GET_LIVE_NETWORK_TRANSACTIONS') {
        return {
          transactions: [
            {
              id: 'tx_123',
              url: 'https://app.example.com/api/candidates',
              method: 'POST',
              status: 201,
              statusText: 'Created',
              requestPayload: { nom: 'Dupont', email: 'test@example.com' },
              responsePayload: { id: 99, success: true },
              durationMs: 145,
              timestamp: Date.now(),
              isMutation: true,
            },
          ],
          hasMutations: true,
        };
      }
      if (type === 'OBSERVE_STATE') {
        return {
          toastAlertDetected: true,
          alertType: 'success',
          alertMessage: 'Candidat créé avec succès',
        };
      }
      return {};
    });

    const progressLogs: string[] = [];
    const result = await workflowEngine.executeCreateRecordWorkflow(
      101,
      mockSnapshot,
      'test_session_1',
      (msg) => progressLogs.push(msg)
    );

    expect(result.success).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.capturedTransactions).toHaveLength(1);
    expect(result.capturedTransactions[0].method).toBe('POST');
    expect(result.capturedTransactions[0].status).toBe(201);
    expect(progressLogs.length).toBeGreaterThan(0);
  });
});
