import { PageSnapshot } from '../shared/types/discovery';
import { Finding, OverallScoreSummary, CategoryScore, QACategory } from '../shared/types/qa';
import { SessionConfig } from '../shared/types/session';
import { CATEGORY_WEIGHTS, DEFAULT_SESSION_CONFIG } from '../shared/constants/defaults';
import { sessionStore } from '../storage/session-store';
import { testLinks } from './link-tester';
import { testButtons } from './button-tester';
import { testForms } from './form-tester';
import { testConsoleErrors, ConsoleErrorItem } from './console-tester';
import { testNetworkFailures, NetworkFailureItem } from './network-tester';
import { testSEO } from './seo-tester';
import { testAccessibility } from './accessibility-tester';
import { testResponsive } from './responsive-tester';
import { testPerformance } from './performance-tester';
import { businessLogicVerifier } from './business-logic-verifier';
import { chaosTester } from './chaos-tester';
import { botShieldDetector } from './bot-shield-detector';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('QAEngine');

export interface QARunOptions {
  consoleErrors?: ConsoleErrorItem[];
  networkFailures?: NetworkFailureItem[];
}

export interface QARunResult {
  findings: Finding[];
  scores: OverallScoreSummary;
}

export class QAEngine {
  /**
   * Executes all deterministic QA modules against a page snapshot.
   */
  public async runAllTests(
    snapshot: PageSnapshot,
    sessionId: string,
    config: SessionConfig = DEFAULT_SESSION_CONFIG,
    options: QARunOptions = {}
  ): Promise<QARunResult> {
    logger.info(`Running deterministic QA modules on ${snapshot.url} for session ${sessionId}`);

    const allFindings: Finding[] = [];
    const enabledCategories = config?.enabledCategories || DEFAULT_SESSION_CONFIG.enabledCategories;
    const enabled = new Set(enabledCategories);

    // 1. Functional QA
    if (enabled.has('FUNCTIONAL')) {
      allFindings.push(...testLinks(snapshot, sessionId));
      allFindings.push(...testButtons(snapshot, sessionId));
      allFindings.push(...testForms(snapshot, sessionId));

      // Human-Grade Advanced QA Modules
      if (config?.advanced?.businessLogicVerification ?? true) {
        const blFindings = await businessLogicVerifier.auditBusinessLogic(
          snapshot,
          sessionId,
          config?.ai
        );
        allFindings.push(...blFindings);
      }

      if (config?.advanced?.chaosTestingEnabled ?? true) {
        const chaosFindings = chaosTester.runChaosAudit(snapshot, sessionId);
        allFindings.push(...chaosFindings);
      }

      const botShieldFindings = botShieldDetector.generateFindings(snapshot, sessionId);
      allFindings.push(...botShieldFindings);
    }

    // 2. Console QA
    if (enabled.has('CONSOLE') && options.consoleErrors && options.consoleErrors.length > 0) {
      allFindings.push(...testConsoleErrors(options.consoleErrors, snapshot.pathname, sessionId));
    }

    // 3. Network QA
    if (enabled.has('NETWORK') && options.networkFailures && options.networkFailures.length > 0) {
      allFindings.push(...testNetworkFailures(options.networkFailures, snapshot.pathname, sessionId));
    }

    // 4. SEO QA
    if (enabled.has('SEO')) {
      allFindings.push(...testSEO(snapshot, sessionId));
    }

    // 5. Accessibility QA
    if (enabled.has('ACCESSIBILITY')) {
      allFindings.push(...testAccessibility(snapshot, sessionId));
    }

    // 6. Responsive QA
    if (enabled.has('RESPONSIVE')) {
      allFindings.push(...testResponsive(snapshot, sessionId));
    }

    // 7. Performance QA
    if (enabled.has('PERFORMANCE')) {
      allFindings.push(...testPerformance(snapshot, sessionId));
    }

    // Persist all findings to IndexedDB
    for (const finding of allFindings) {
      await sessionStore.saveFinding(finding);
    }

    const scores = this.calculateScores(allFindings);
    logger.info(`QA execution complete: ${allFindings.length} findings, overall score: ${scores.overallScore}/100`);

    return {
      findings: allFindings,
      scores,
    };
  }

  /**
   * Calculates category scores and weighted overall QA score.
   */
  public calculateScores(findings: Finding[]): OverallScoreSummary {
    const categories: QACategory[] = [
      'FUNCTIONAL',
      'UX',
      'PERFORMANCE',
      'ACCESSIBILITY',
      'RESPONSIVE',
      'SEO',
      'CONSOLE',
      'NETWORK',
    ];

    const categoryScores: Record<QACategory, CategoryScore> = {} as Record<QACategory, CategoryScore>;

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let infoCount = 0;

    for (const cat of categories) {
      const catFindings = findings.filter((f) => f.category === cat);
      let penalties = 0;
      let failed = 0;
      let warnings = 0;

      for (const f of catFindings) {
        switch (f.severity) {
          case 'CRITICAL':
            penalties += 35;
            failed += 1;
            criticalCount += 1;
            break;
          case 'HIGH':
            penalties += 20;
            failed += 1;
            highCount += 1;
            break;
          case 'MEDIUM':
            penalties += 10;
            warnings += 1;
            mediumCount += 1;
            break;
          case 'LOW':
            penalties += 4;
            warnings += 1;
            lowCount += 1;
            break;
          case 'INFO':
            infoCount += 1;
            break;
        }
      }

      // If UX category has no direct findings, derive from general reliability
      const score = Math.max(0, 100 - penalties);

      categoryScores[cat] = {
        category: cat,
        score,
        weight: CATEGORY_WEIGHTS[cat] || 0,
        testsCount: catFindings.length + 10,
        passedCount: Math.max(0, 10 - failed - warnings),
        failedCount: failed,
        warningsCount: warnings,
      };
    }

    // UX score synthesis: 50% accessibility + 25% responsive + 25% functional
    categoryScores['UX'].score = Math.round(
      categoryScores['ACCESSIBILITY'].score * 0.4 +
      categoryScores['RESPONSIVE'].score * 0.3 +
      categoryScores['FUNCTIONAL'].score * 0.3
    );

    // Overall weighted calculation
    let weightedSum = 0;
    let totalWeight = 0;

    for (const cat of ['FUNCTIONAL', 'UX', 'PERFORMANCE', 'ACCESSIBILITY', 'RESPONSIVE', 'SEO'] as QACategory[]) {
      const weight = CATEGORY_WEIGHTS[cat];
      weightedSum += categoryScores[cat].score * weight;
      totalWeight += weight;
    }

    const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;

    return {
      overallScore,
      categoryScores,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      infoCount,
    };
  }
}

export const qaEngine = new QAEngine();
