import { TestTask, ObservationResult, ReasoningVerdict } from '../shared/types/agent';
import { ExecutionResult } from '../agent/executor';
import { ModelManager, modelManager } from './model-manager';
import { cloudLlmClient } from './cloud-llm-client';
import { AIConfig } from '../shared/types/session';
import {
  buildAmbiguousActionPrompt,
  AmbiguousActionAnalysisOutput,
  extractJsonFromResponse,
  buildAccessibilityRemediationPrompt,
  AccessibilityRemediationOutput,
} from './prompt-templates';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('AIReasoner');

export class AIReasoner {
  constructor(private manager: ModelManager = modelManager) {}

  /**
   * Evaluates an ambiguous interaction by combining deterministic telemetry with Cloud or Local LLM reasoning.
   */
  public async arbitrateVerdict(
    task: TestTask,
    _execResult: ExecutionResult,
    obsResult: ObservationResult,
    deterministicVerdict: ReasoningVerdict,
    aiConfig?: AIConfig
  ): Promise<ReasoningVerdict> {
    // 1. If deterministic confidence is already high and requires no verification, return directly
    if (deterministicVerdict.confidence >= 0.9 && !deterministicVerdict.requiresVerification) {
      return deterministicVerdict;
    }

    const activeProvider = cloudLlmClient.resolveActiveProvider(aiConfig);
    const hasCloudLLM = activeProvider.isCloud && Boolean(activeProvider.apiKey);
    const hasLocalLLM = this.manager.isReady();

    // 2. If neither cloud nor local model is ready, return deterministic verdict
    if (!hasCloudLLM && !hasLocalLLM) {
      logger.debug('No Cloud or Local AI model ready; relying strictly on deterministic rule verdict.');
      return deterministicVerdict;
    }

    try {
      // 3. Build structured prompt
      const prompt = buildAmbiguousActionPrompt({
        selector: task.targetSelector,
        tagName: task.targetElementInfo?.tag || 'element',
        elementText: task.targetElementInfo?.text,
        action: task.type,
        domMutationsCount: obsResult.domMutationsCount,
        urlChanged: obsResult.urlChanged,
        modalAppeared: obsResult.modalAppeared,
        errorAlertAppeared: obsResult.errorAlertAppeared,
        alertMessage: obsResult.alertMessage,
        consoleErrors: obsResult.consoleErrors.map((e) => e.message),
        networkFailures: obsResult.networkFailures.map((n) => `${n.url} (${n.status})`),
      });

      // 4. Generate inference via Cloud or Local
      let rawResponse: string | null = null;
      let providerTag = 'Local AI';

      if (hasCloudLLM) {
        providerTag = `${activeProvider.provider.toUpperCase()} AI`;
        rawResponse = await cloudLlmClient.generateCompletion(prompt, { maxTokens: 400, temperature: 0.1 }, aiConfig);
      }

      if (!rawResponse && hasLocalLLM) {
        providerTag = 'Local AI';
        rawResponse = await this.manager.generateChatCompletion(prompt, {
          maxTokens: 350,
          temperature: 0.1,
        });
      }

      if (!rawResponse) {
        return deterministicVerdict;
      }

      // 5. Parse JSON output
      const fallbackOutput: AmbiguousActionAnalysisOutput = {
        isDefect: !deterministicVerdict.passed,
        confidence: deterministicVerdict.confidence,
        defectType: deterministicVerdict.passed ? 'INFORMATIVE_ONLY' : 'DEAD_BUTTON',
        rationale: deterministicVerdict.rationale,
      };

      const aiDecision = extractJsonFromResponse<AmbiguousActionAnalysisOutput>(rawResponse, fallbackOutput);

      logger.info(`AI Arbitration for task ${task.id}: isDefect=${aiDecision.isDefect}, confidence=${aiDecision.confidence}`);

      // If AI determined this element is intentionally inert or decorative, suppress false positive
      if (!aiDecision.isDefect) {
        return {
          taskId: task.id,
          passed: true,
          confidence: Math.max(0.85, aiDecision.confidence),
          rationale: `[${providerTag} Evaluated] ${aiDecision.rationale}`,
          category: deterministicVerdict.category,
          severity: deterministicVerdict.severity,
          requiresVerification: false,
        };
      }

      // If AI confirmed defect
      return {
        taskId: task.id,
        passed: false,
        confidence: Math.max(0.9, aiDecision.confidence),
        rationale: `[${providerTag} Confirmed] ${aiDecision.rationale}`,
        category: deterministicVerdict.category,
        severity: deterministicVerdict.severity,
        suggestedRemediation: aiDecision.suggestedFix || deterministicVerdict.suggestedRemediation,
        requiresVerification: deterministicVerdict.requiresVerification,
      };
    } catch (err) {
      logger.warn('AI reasoning failed or timed out. Falling back to deterministic rule verdict.', err);
      return deterministicVerdict;
    }
  }

  /**
   * Generates tailored accessibility code remediation using Cloud or Local LLM.
   */
  public async generateAccessibilityFix(
    selector: string,
    elementSnippet: string,
    issueType: string,
    issueDescription: string,
    pageTitle: string,
    aiConfig?: AIConfig
  ): Promise<AccessibilityRemediationOutput | null> {
    const activeProvider = cloudLlmClient.resolveActiveProvider(aiConfig);
    const hasCloudLLM = activeProvider.isCloud && Boolean(activeProvider.apiKey);
    const hasLocalLLM = this.manager.isReady();

    if (!hasCloudLLM && !hasLocalLLM) {
      return null;
    }

    try {
      const prompt = buildAccessibilityRemediationPrompt({
        selector,
        elementSnippet,
        issueType,
        issueDescription,
        pageTitle,
      });

      let raw: string | null = null;
      if (hasCloudLLM) {
        raw = await cloudLlmClient.generateCompletion(prompt, { maxTokens: 400, temperature: 0.1 }, aiConfig);
      }
      if (!raw && hasLocalLLM) {
        raw = await this.manager.generateChatCompletion(prompt, {
          maxTokens: 300,
          temperature: 0.1,
        });
      }

      if (!raw) return null;

      const parsed = extractJsonFromResponse<AccessibilityRemediationOutput | null>(raw, null);
      return parsed;
    } catch (err) {
      logger.warn('Failed to generate accessibility fix via AI', err);
      return null;
    }
  }
}

export const aiReasoner = new AIReasoner();

