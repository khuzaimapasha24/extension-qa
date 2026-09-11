import { createLogger } from '../shared/logger/logger';

const logger = createLogger('PromptTemplates');

export interface AmbiguousActionAnalysisInput {
  selector: string;
  tagName: string;
  elementText?: string;
  action: string;
  domMutationsCount: number;
  urlChanged: boolean;
  modalAppeared: boolean;
  errorAlertAppeared: boolean;
  alertMessage?: string;
  consoleErrors: string[];
  networkFailures: string[];
}

export interface AmbiguousActionAnalysisOutput {
  isDefect: boolean;
  confidence: number;
  defectType: 'DEAD_BUTTON' | 'EXPECTED_INERT' | 'UNHANDLED_EXCEPTION' | 'INFORMATIVE_ONLY';
  rationale: string;
  suggestedFix?: string;
}

export interface AccessibilityRemediationInput {
  selector: string;
  elementSnippet: string;
  issueType: string;
  issueDescription: string;
  pageTitle: string;
}

export interface AccessibilityRemediationOutput {
  proposedCode: string;
  explanation: string;
  wcagGuideline: string;
}

/**
 * Builds messages for analyzing whether an interactive action caused a true defect or expected inert behavior.
 */
export function buildAmbiguousActionPrompt(input: AmbiguousActionAnalysisInput): Array<{ role: 'system' | 'user'; content: string }> {
  const systemPrompt = `You are a strict, senior Web QA Automation Engineer.
Your task is to analyze an automated interaction test result and determine if a true functional bug exists or if the behavior is normal and expected.
You must return ONLY a single valid JSON object strictly matching this schema with NO markdown fences and NO additional commentary:
{
  "isDefect": boolean,
  "confidence": number (between 0.0 and 1.0),
  "defectType": "DEAD_BUTTON" | "EXPECTED_INERT" | "UNHANDLED_EXCEPTION" | "INFORMATIVE_ONLY",
  "rationale": "One concise paragraph explaining the technical verdict",
  "suggestedFix": "Precise recommendation for developers, or null if not a defect"
}`;

  const userPrompt = `Test Execution Telemetry:
- Target Element: <${input.tagName} selector="${input.selector}"> "${input.elementText || ''}"
- Action Performed: ${input.action}
- Resulting DOM Mutations: ${input.domMutationsCount}
- URL Changed: ${input.urlChanged}
- Modal Appeared: ${input.modalAppeared}
- Error Alert Appeared: ${input.errorAlertAppeared} (Message: ${input.alertMessage || 'None'})
- Console Errors: ${input.consoleErrors.length > 0 ? input.consoleErrors.join(' | ') : 'None'}
- Network Failures: ${input.networkFailures.length > 0 ? input.networkFailures.join(' | ') : 'None'}

Evaluate if this represents a genuine defect (such as an unresponsive/dead button or unhandled exception) or benign expected behavior.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

/**
 * Builds messages for generating actionable accessibility code remediations.
 */
export function buildAccessibilityRemediationPrompt(input: AccessibilityRemediationInput): Array<{ role: 'system' | 'user'; content: string }> {
  const systemPrompt = `You are a Web Accessibility (WCAG 2.1 AA) specialist.
Provide an exact, copy-pasteable HTML/JSX code remediation for the reported violation.
Return ONLY a valid JSON object matching this schema:
{
  "proposedCode": "Corrected HTML snippet",
  "explanation": "Why this remediates the violation",
  "wcagGuideline": "Specific WCAG guideline reference (e.g. WCAG 2.1 AA 1.1.1)"
}`;

  const userPrompt = `Page: ${input.pageTitle}
Element: ${input.selector}
Current Snippet: ${input.elementSnippet}
Violation: ${input.issueType} - ${input.issueDescription}

Provide the corrected accessible code.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

/**
 * Robustly parses a JSON object from raw LLM output text.
 * Strips markdown code blocks and handles surrounding text.
 */
export function extractJsonFromResponse<T>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== 'string') {
    return fallback;
  }

  let cleaned = rawText.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Find outermost curly brackets if surrounding text exists
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    return parsed as T;
  } catch (err) {
    logger.warn('Failed to parse JSON from LLM response. Using fallback.', { error: err, rawText: rawText.substring(0, 150) });
    return fallback;
  }
}
