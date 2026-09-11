import { describe, it, expect, vi } from 'vitest';
import { visionAnalyzer } from '../../src/ai/vision-analyzer';
import { cloudLlmClient } from '../../src/ai/cloud-llm-client';

describe('VisionAnalyzer', () => {
  it('parses multimodal cloud vision output when available', async () => {
    const mockReply = JSON.stringify({
      screenOverview: 'Admin panel candidate view with 4 primary navigation tabs',
      identifiedLayout: 'Admin Dashboard with Sidebar',
      keyInteractiveElements: ['Button: Nouveau Candidat', 'Tab: Examens et certifications'],
      suggestedPrimaryAction: {
        label: 'Create New Candidate',
        actionType: 'CLICK_BUTTON',
        targetDescription: 'Click the primary Nouveau button',
      },
      visualAnomalies: [],
    });

    vi.spyOn(cloudLlmClient, 'generateVisionCompletion').mockResolvedValueOnce(mockReply);

    const result = await visionAnalyzer.inspectScreen(
      'data:image/jpeg;base64,fakeimage123',
      {
        url: 'https://app.example.com/admin',
        title: 'Tableau de bord',
        tabs: ['Vue d\'ensemble', 'Examens et certifications'],
      },
      {
        provider: 'gemini',
        geminiApiKey: 'test-key-12345678',
      }
    );

    expect(result.screenOverview).toContain('Admin panel candidate view');
    expect(result.identifiedLayout).toBe('Admin Dashboard with Sidebar');
    expect(result.keyInteractiveElements).toHaveLength(2);
    expect(result.suggestedPrimaryAction?.actionType).toBe('CLICK_BUTTON');
  });

  it('provides heuristic fallback when cloud vision is offline', async () => {
    vi.spyOn(cloudLlmClient, 'generateVisionCompletion').mockResolvedValueOnce(null);

    const result = await visionAnalyzer.inspectScreen(
      'data:image/jpeg;base64,fakeimage123',
      {
        url: 'https://app.example.com/admin/students',
        title: 'Répertoire des étudiants',
        tabs: ['Vue d\'ensemble', 'Répertoire des étudiants'],
        interactiveCount: 14,
      }
    );

    expect(result.screenOverview).toContain('Répertoire des étudiants');
    expect(result.identifiedLayout).toContain('Administrative Workspace');
    expect(result.keyInteractiveElements).toContain('Tab: Vue d\'ensemble');
  });
});
