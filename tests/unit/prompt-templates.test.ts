import { describe, it, expect } from 'vitest';
import {
  buildAmbiguousActionPrompt,
  buildAccessibilityRemediationPrompt,
  extractJsonFromResponse,
  AmbiguousActionAnalysisOutput,
} from '../../src/ai/prompt-templates';

describe('PromptTemplates', () => {
  it('builds ambiguous action prompt with complete interaction telemetry', () => {
    const messages = buildAmbiguousActionPrompt({
      selector: 'button#filter-pill',
      tagName: 'button',
      elementText: 'Active Only',
      action: 'BUTTON_CLICK',
      domMutationsCount: 0,
      urlChanged: false,
      modalAppeared: false,
      errorAlertAppeared: false,
      consoleErrors: [],
      networkFailures: [],
    });

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('button#filter-pill');
    expect(messages[1].content).toContain('Active Only');
    expect(messages[1].content).toContain('BUTTON_CLICK');
  });

  it('builds accessibility remediation prompt with element snippet and violation details', () => {
    const messages = buildAccessibilityRemediationPrompt({
      selector: 'img#avatar',
      elementSnippet: '<img src="/user.png">',
      issueType: 'MISSING_ALT',
      issueDescription: 'Image tag has no alt text attribute',
      pageTitle: 'User Profile',
    });

    expect(messages.length).toBe(2);
    expect(messages[0].content).toContain('WCAG 2.1 AA');
    expect(messages[1].content).toContain('<img src="/user.png">');
    expect(messages[1].content).toContain('MISSING_ALT');
  });

  describe('extractJsonFromResponse', () => {
    const fallback: AmbiguousActionAnalysisOutput = {
      isDefect: false,
      confidence: 0.5,
      defectType: 'EXPECTED_INERT',
      rationale: 'Fallback default',
    };

    it('parses raw JSON text directly', () => {
      const raw = '{"isDefect":true,"confidence":0.95,"defectType":"DEAD_BUTTON","rationale":"Button has no handler","suggestedFix":"Add onClick"}';
      const parsed = extractJsonFromResponse<AmbiguousActionAnalysisOutput>(raw, fallback);

      expect(parsed.isDefect).toBe(true);
      expect(parsed.confidence).toBe(0.95);
      expect(parsed.defectType).toBe('DEAD_BUTTON');
      expect(parsed.suggestedFix).toBe('Add onClick');
    });

    it('parses JSON enclosed in markdown code fences', () => {
      const raw = '```json\n{\n  "isDefect": false,\n  "confidence": 0.88,\n  "defectType": "EXPECTED_INERT",\n  "rationale": "Static badge"\n}\n```';
      const parsed = extractJsonFromResponse<AmbiguousActionAnalysisOutput>(raw, fallback);

      expect(parsed.isDefect).toBe(false);
      expect(parsed.confidence).toBe(0.88);
      expect(parsed.defectType).toBe('EXPECTED_INERT');
    });

    it('extracts JSON surrounded by chat commentary', () => {
      const raw = 'Here is the analysis:\n\n{"isDefect":true,"confidence":0.9,"defectType":"UNHANDLED_EXCEPTION","rationale":"Threw error"}\n\nHope this helps!';
      const parsed = extractJsonFromResponse<AmbiguousActionAnalysisOutput>(raw, fallback);

      expect(parsed.isDefect).toBe(true);
      expect(parsed.defectType).toBe('UNHANDLED_EXCEPTION');
    });

    it('returns fallback on invalid JSON text without throwing', () => {
      const raw = 'Sorry, as an AI model I cannot answer this.';
      const parsed = extractJsonFromResponse<AmbiguousActionAnalysisOutput>(raw, fallback);

      expect(parsed).toEqual(fallback);
    });
  });
});
