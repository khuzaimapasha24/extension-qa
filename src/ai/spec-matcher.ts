import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';
import { AIConfig } from '../shared/types/session';
import { cloudLlmClient } from './cloud-llm-client';
import { extractJsonFromResponse } from './prompt-templates';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('SpecMatcher');

export type RequirementStatus = 'VERIFIED_PASS' | 'MISSING_FAIL' | 'PARTIAL_WARNING';

export interface RequirementEvaluation {
  id: string;
  requirementText: string;
  status: RequirementStatus;
  confidence: number;
  matchedElementSelector?: string;
  evidence: string;
  remediationSuggestion?: string;
}

export interface SpecComplianceReport {
  overallComplianceScore: number; // 0 to 100
  totalRequirements: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  evaluations: RequirementEvaluation[];
  findings: Finding[];
}

/**
 * Design & PRD Requirement Matcher.
 * Audits live web pages against natural language acceptance criteria, user stories, and Figma design specs.
 */
export class SpecMatcher {
  /**
   * Parses free-form PRD text, user stories, or bullet points into distinct requirement strings.
   */
  public parseRequirements(specText: string): string[] {
    if (!specText || typeof specText !== 'string') return [];

    return specText
      .split(/\r?\n/)
      .map((line) => line.replace(/^[\s*-]+(\[[ xX]\])?\s*/, '').trim())
      .filter((line) => line.length > 5 && !line.startsWith('#'));
  }

  /**
   * Deterministically evaluates a single requirement against page snapshot elements.
   */
  public evaluateHeuristic(requirement: string, snapshot: PageSnapshot): RequirementEvaluation {
    const reqLower = requirement.toLowerCase();
    const reqId = `req_${Math.random().toString(36).substring(2, 8)}`;

    // 1. Check Buttons
    if (/button|cta|action|submit|click/i.test(reqLower)) {
      const allButtons = snapshot.buttons || [];
      const matchedBtn = allButtons.find((b) => {
        const text = (b.text || '').toLowerCase();
        const aria = (b.ariaLabel || '').toLowerCase();
        // Check if any keyword in requirement matches button
        const keywords = reqLower.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
        return keywords.some((k) => text.includes(k) || aria.includes(k));
      });

      if (matchedBtn) {
        return {
          id: reqId,
          requirementText: requirement,
          status: 'VERIFIED_PASS',
          confidence: 0.9,
          matchedElementSelector: matchedBtn.selector,
          evidence: `Found interactive button "${matchedBtn.text || matchedBtn.ariaLabel}" matching requirement.`,
        };
      }
    }

    // 2. Check Headings & Titles
    if (/heading|title|header|hero/i.test(reqLower)) {
      const allHeadings = snapshot.headings || [];
      const matchedHeading = allHeadings.find((h) => {
        const text = (h.text || '').toLowerCase();
        const keywords = reqLower.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
        return keywords.some((k) => text.includes(k));
      });

      if (matchedHeading) {
        return {
          id: reqId,
          requirementText: requirement,
          status: 'VERIFIED_PASS',
          confidence: 0.92,
          matchedElementSelector: matchedHeading.selector,
          evidence: `Verified heading tag <${matchedHeading.level}> "${matchedHeading.text}" is rendered.`,
        };
      }
    }

    // 3. Check Form Inputs
    if (/input|field|form|enter|email|password|search/i.test(reqLower)) {
      const allForms = snapshot.forms || [];
      for (const form of allForms) {
        const matchedField = (form.fields || []).find((f) => {
          const name = (f.name || '').toLowerCase();
          const placeholder = (f.placeholder || '').toLowerCase();
          const label = (f.label || '').toLowerCase();
          return reqLower.includes(name) || (placeholder && reqLower.includes(placeholder)) || (label && reqLower.includes(label));
        });

        if (matchedField) {
          return {
            id: reqId,
            requirementText: requirement,
            status: 'VERIFIED_PASS',
            confidence: 0.88,
            matchedElementSelector: matchedField.selector,
            evidence: `Discovered matching form input field: ${matchedField.selector} (type: ${matchedField.type || 'text'}).`,
          };
        }
      }
    }

    // 4. Check Navigation & Links
    if (/link|navigation|nav|footer|menu/i.test(reqLower)) {
      const allLinks = snapshot.links || [];
      const matchedLink = allLinks.find((l) => {
        const text = (l.text || '').toLowerCase();
        const href = (l.url || '').toLowerCase();
        const keywords = reqLower.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
        return keywords.some((k) => text.includes(k) || href.includes(k));
      });

      if (matchedLink) {
        return {
          id: reqId,
          requirementText: requirement,
          status: 'VERIFIED_PASS',
          confidence: 0.86,
          matchedElementSelector: matchedLink.selector,
          evidence: `Located navigation link "${matchedLink.text}" pointing to "${matchedLink.url}".`,
        };
      }
    }

    // Fallback if not verified
    return {
      id: reqId,
      requirementText: requirement,
      status: 'MISSING_FAIL',
      confidence: 0.85,
      evidence: 'No matching interactive element, text heading, or navigation link found in current page snapshot.',
      remediationSuggestion: `Implement the requested element or content specified in acceptance criteria: "${requirement}".`,
    };
  }

  /**
   * Compares a complete PRD spec against a page snapshot, enriched with Cloud LLM if configured.
   */
  public async evaluateCompliance(
    specText: string,
    snapshot: PageSnapshot,
    sessionId: string,
    aiConfig?: AIConfig
  ): Promise<SpecComplianceReport> {
    const requirements = this.parseRequirements(specText);
    logger.info(`Evaluating ${requirements.length} PRD requirements against ${snapshot.url}...`);

    const evaluations: RequirementEvaluation[] = [];
    const findings: Finding[] = [];

    // Run deterministic heuristic matching
    for (const req of requirements) {
      evaluations.push(this.evaluateHeuristic(req, snapshot));
    }

    // Optional Cloud LLM semantic enrichment
    const activeProvider = cloudLlmClient.resolveActiveProvider(aiConfig);
    if (activeProvider.isCloud && activeProvider.apiKey && requirements.length > 0) {
      try {
        const prompt = `You are a Principal QA Engineer verifying whether a live web application complies with a PRD/Design Specification.
Audited URL: ${snapshot.url}
Page Title: ${snapshot.title}
Requirements to Validate:
${requirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Discovered Headings: ${JSON.stringify(snapshot.headings?.map((h) => h.text) || [])}
Discovered Buttons: ${JSON.stringify(snapshot.buttons?.map((b) => b.text) || [])}
Discovered Forms Count: ${snapshot.forms?.length || 0}

Evaluate each requirement rigorously. Respond in valid JSON with this schema:
{
  "evaluations": [
    {
      "index": number,
      "status": "VERIFIED_PASS" | "MISSING_FAIL" | "PARTIAL_WARNING",
      "evidence": string,
      "remediation": string
    }
  ]
}`;

        const aiResponse = await cloudLlmClient.generateCompletion(prompt, { maxTokens: 800, temperature: 0.1 }, aiConfig);
        if (aiResponse) {
          const parsed = extractJsonFromResponse<{
            evaluations?: Array<{
              index: number;
              status: RequirementStatus;
              evidence: string;
              remediation?: string;
            }>;
          }>(aiResponse, { evaluations: [] });

          if (Array.isArray(parsed.evaluations) && parsed.evaluations.length > 0) {
            for (const item of parsed.evaluations) {
              const targetIdx = (item.index || 1) - 1;
              if (evaluations[targetIdx]) {
                evaluations[targetIdx].status = item.status || evaluations[targetIdx].status;
                evaluations[targetIdx].evidence = item.evidence || evaluations[targetIdx].evidence;
                evaluations[targetIdx].remediationSuggestion = item.remediation || evaluations[targetIdx].remediationSuggestion;
              }
            }
          }
        }
      } catch (err) {
        logger.warn('Cloud LLM spec verification request failed, keeping heuristic results', err);
      }
    }

    // Convert failed requirements into structured QA findings
    let passedCount = 0;
    let failedCount = 0;
    let warningCount = 0;

    for (const ev of evaluations) {
      if (ev.status === 'VERIFIED_PASS') {
        passedCount++;
      } else if (ev.status === 'MISSING_FAIL') {
        failedCount++;
        findings.push({
          id: `finding_spec_fail_${sessionId}_${ev.id}`,
          sessionId,
          page: snapshot.url,
          category: 'FUNCTIONAL',
          severity: 'HIGH',
          status: 'FAIL',
          confidence: ev.confidence,
          title: `[PRD Spec Mismatch] Missing Requirement: ${ev.requirementText.slice(0, 50)}`,
          description: `The live application fails to satisfy the specified PRD acceptance criteria: "${ev.requirementText}". ${ev.evidence}`,
          elementSelector: ev.matchedElementSelector,
          steps: [
            `Navigate to ${snapshot.url}`,
            `Check for requirement: "${ev.requirementText}"`,
            'Verify element presence and visual rendering',
          ],
          expected: `Page must satisfy specification: "${ev.requirementText}"`,
          actual: ev.evidence,
          recommendation: ev.remediationSuggestion || 'Update web application to include the required design components and user flow.',
          timestamp: Date.now(),
          retestCount: 0,
        });
      } else {
        warningCount++;
      }
    }

    const total = requirements.length;
    const overallComplianceScore = total > 0 ? Math.round((passedCount / total) * 100) : 100;

    return {
      overallComplianceScore,
      totalRequirements: total,
      passedCount,
      failedCount,
      warningCount,
      evaluations,
      findings,
    };
  }
}

export const specMatcher = new SpecMatcher();
