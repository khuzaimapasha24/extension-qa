import { PageSnapshot } from '../shared/types/discovery';
import { Finding } from '../shared/types/qa';
import { AIConfig } from '../shared/types/session';
import { WebsiteFlowAnalysis, FlowFrictionPoint, FlowRecommendation } from '../reporting/report-types';
import { cloudLlmClient } from './cloud-llm-client';
import { extractJsonFromResponse } from './prompt-templates';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('FlowAnalyzer');

const CTA_PATTERNS = /buy|order|cart|checkout|sign\s*up|register|get\s*started|start|free\s*trial|join|book|subscribe|demo|contact/i;
const ECOMMERCE_PATTERNS = /cart|shop|store|product|item|price|checkout|buy/i;
const SAAS_PATTERNS = /app|dashboard|features|pricing|platform|solution|api|login|signup/i;
const LEAD_PATTERNS = /contact|inquire|quote|schedule|call|consultation|talk/i;

export interface FlowAnalysisResult {
  flowAnalysis: WebsiteFlowAnalysis;
  findings: Finding[];
}

export class FlowAnalyzer {
  /**
   * Evaluates the website's complete user flow, navigation journey, and conversion path.
   * Generates actionable recommendations on how to improve the website flow and UX.
   */
  public async analyzeFlow(
    snapshot: PageSnapshot,
    sessionId: string,
    aiConfig?: AIConfig
  ): Promise<FlowAnalysisResult> {
    logger.info(`Auditing user flow and UX journey for ${snapshot.url}...`);

    // 1. Determine Page Intent and safe text extractions
    const h1List: string[] = snapshot.metadata?.h1Texts || (snapshot as any).headings?.h1 || [];
    const metaDesc: string = snapshot.metadata?.description || (snapshot as any).meta?.description || '';
    const h2Count: number = snapshot.metadata?.headingCounts?.h2 ?? (snapshot as any).headings?.h2Count ?? 0;
    const pageTitle = snapshot.title || snapshot.metadata?.title || '';
    const pageText = `${pageTitle} ${h1List.join(' ')} ${metaDesc} ${snapshot.url || ''}`;
    let pageIntent = 'General Web Presence';
    if (ECOMMERCE_PATTERNS.test(pageText)) {
      pageIntent = 'E-Commerce / Product Transaction Flow';
    } else if (SAAS_PATTERNS.test(pageText)) {
      pageIntent = 'SaaS / Web Application Conversion Flow';
    } else if (LEAD_PATTERNS.test(pageText)) {
      pageIntent = 'Lead Generation & Customer Inquiry Flow';
    }

    // 2. Identify CTAs and Interactive Flow Inventory
    const allButtons = snapshot.buttons || [];
    const allLinks = snapshot.links || [];
    const allForms = snapshot.forms || [];

    const ctaButtons = allButtons.filter((b) => CTA_PATTERNS.test(b.text));
    const ctaLinks = allLinks.filter((l) => CTA_PATTERNS.test(l.text));
    const totalCTAs = ctaButtons.length + ctaLinks.length;

    const frictionPoints: FlowFrictionPoint[] = [];
    const recommendations: FlowRecommendation[] = [];
    const strengths: string[] = [];
    let flowScore = 100;

    // Check A: Primary Conversion CTA Presence
    if (totalCTAs === 0) {
      flowScore -= 25;
      frictionPoints.push({
        id: 'fric_no_primary_cta',
        severity: 'HIGH',
        area: 'HERO_CTA',
        title: 'Missing Primary Call-To-Action (CTA)',
        description: 'The page lacks a distinct, conversion-focused Call-To-Action button (e.g. "Get Started", "Order Now", or "Book Demo"). Visitors may struggle to discern the intended next step.',
      });
      recommendations.push({
        id: 'rec_add_hero_cta',
        priority: 'HIGH',
        title: 'Introduce Prominent Hero & Sticky Conversion CTA',
        currentFlowIssue: 'Users reach the page without a clear, immediate action path, increasing bounce probability.',
        suggestedImprovement: 'Place a high-contrast primary CTA button in the hero section above the fold, and replicate a compact version in the sticky navigation header.',
        expectedImpact: 'Estimated +15-30% boost in user progression to signup, catalog, or lead capture.',
      });
    } else {
      strengths.push(`Identified ${totalCTAs} clear conversion Call-To-Action controls (${ctaButtons.slice(0, 2).map((b) => `"${b.text}"`).join(', ') || 'links'}).`);
    }

    // Check B: Navigation Structure & Return Paths
    const internalNavLinks = allLinks.filter((l) => l.isInternal && !l.isAnchor && !l.isMailtoOrTel);
    if (internalNavLinks.length < 2 && allLinks.length < 5) {
      flowScore -= 15;
      frictionPoints.push({
        id: 'fric_isolated_navigation',
        severity: 'MEDIUM',
        area: 'NAVIGATION',
        title: 'Sparse Navigation & Return Pathways',
        description: 'The page provides fewer than 2 internal navigational links, creating a dead-end experience if the user does not immediately convert.',
      });
      recommendations.push({
        id: 'rec_expand_navigation',
        priority: 'MEDIUM',
        title: 'Add Global Header & Footer Return Routes',
        currentFlowIssue: 'Users who wish to explore other products, pricing, or support have no obvious navigation routes.',
        suggestedImprovement: 'Provide a structured header with Home, Features, About, and Contact links, plus an accessible footer with terms and support.',
        expectedImpact: 'Significantly improves session duration and reduces single-page bounce rates.',
      });
    } else {
      strengths.push(`Rich internal navigation options available (${internalNavLinks.length} internal routes cataloged).`);
    }

    // Check C: Dead Links or Inert Anchors masquerading as Actions
    const deadAnchorLinks = allLinks.filter((l) => l.isAnchor && (l.href === '#' || l.href.endsWith('/#') || l.href.startsWith('javascript:')));
    if (deadAnchorLinks.length > 0) {
      flowScore -= Math.min(20, deadAnchorLinks.length * 5);
      frictionPoints.push({
        id: 'fric_dead_anchor_clicks',
        severity: 'HIGH',
        area: 'CONVERSION',
        title: `Broken / Inert Navigation Anchors (${deadAnchorLinks.length} found)`,
        description: `Found ${deadAnchorLinks.length} links with href="#" or empty pseudo-protocols. When users click these expecting navigation or modals, nothing happens.`,
        elementSelector: deadAnchorLinks[0]?.selector,
      });
      recommendations.push({
        id: 'rec_resolve_dead_anchors',
        priority: 'HIGH',
        title: 'Wire or Replace Inert Anchor Placeholders',
        currentFlowIssue: 'Users clicking links encounter silent failures, giving the impression that the website is broken or unfinished.',
        suggestedImprovement: 'Replace placeholder href="#" with genuine destination routes or bind them explicitly to modal drawer state triggers.',
        expectedImpact: 'Eliminates friction and builds user trust.',
      });
    }

    // Check D: Form Flow & Input Friction
    for (const form of allForms) {
      if (form.fields.length > 6) {
        flowScore -= 10;
        frictionPoints.push({
          id: `fric_long_form_${form.id || 'unnamed'}`,
          severity: 'MEDIUM',
          area: 'FORMS',
          title: `High Cognitive Friction in Form (${form.fields.length} inputs)`,
          description: `Form contains ${form.fields.length} input fields in a single view, creating visual fatigue and higher form abandonment.`,
          elementSelector: form.selector,
        });
        recommendations.push({
          id: `rec_split_form_${form.id || 'unnamed'}`,
          priority: 'MEDIUM',
          title: 'Implement Multi-Step Progressive Disclosure for Forms',
          currentFlowIssue: 'Overwhelming number of fields displayed upfront leads to high drop-off.',
          suggestedImprovement: 'Split the form into 2 digestible steps (e.g. Basic Contact Details -> Specific Requirements) with a progress bar and inline validation.',
          expectedImpact: 'Typically increases form completion rates by 20-35%.',
        });
      }

      if (!form.submitButtonSelector) {
        flowScore -= 15;
        frictionPoints.push({
          id: `fric_missing_submit_${form.id || 'unnamed'}`,
          severity: 'HIGH',
          area: 'FORMS',
          title: 'Form Missing Visible Submit Button',
          description: 'A data collection form has no explicit submit button, forcing users to guess that pressing Enter is required.',
          elementSelector: form.selector,
        });
        recommendations.push({
          id: 'rec_add_submit_button',
          priority: 'HIGH',
          title: 'Add Explicit Submit Action Button',
          currentFlowIssue: 'Users on mobile or assistive devices cannot intuitively submit the form.',
          suggestedImprovement: 'Add an unmistakable, full-width or primary styled submit button (e.g. "Send Message" or "Submit Request").',
          expectedImpact: 'Guarantees accessibility and clear interaction closure.',
        });
      }
    }

    // Check E: Heading & Value Proposition Clarity
    if (!h1List || h1List.length === 0) {
      flowScore -= 10;
      frictionPoints.push({
        id: 'fric_missing_h1_value_prop',
        severity: 'MEDIUM',
        area: 'CONTENT_HIERARCHY',
        title: 'Missing Clear Page Value Proposition (H1)',
        description: 'The page lacks a primary H1 heading to immediately orient users within the first 3 seconds of arrival.',
      });
      recommendations.push({
        id: 'rec_add_h1_value_prop',
        priority: 'MEDIUM',
        title: 'Formulate a 3-Second Value Proposition Headline',
        currentFlowIssue: 'Visitors cannot quickly verify if they have arrived at the right destination for their intent.',
        suggestedImprovement: 'Add a clear H1 headline communicating the core benefit, followed by a 1-2 sentence supporting subheadline.',
        expectedImpact: 'Reduces immediate bounce rate and clarifies brand intent.',
      });
    } else {
      strengths.push(`Clear primary heading identified: "${h1List[0]?.substring(0, 60)}"`);
    }

    flowScore = Math.max(20, Math.min(100, flowScore));

    let flowRating: WebsiteFlowAnalysis['flowRating'] = 'EXCELLENT';
    if (flowScore >= 90) flowRating = 'EXCELLENT';
    else if (flowScore >= 75) flowRating = 'GOOD';
    else if (flowScore >= 60) flowRating = 'FAIR';
    else if (flowScore >= 40) flowRating = 'NEEDS_OPTIMIZATION';
    else flowRating = 'CRITICAL_FRICTION';

    let evaluatedBy = 'Deterministic UX Flow Engine';

    // 3. AI Cloud / WebGPU Enrichment if available
    const activeProvider = cloudLlmClient.resolveActiveProvider(aiConfig);
    if (activeProvider.isCloud && activeProvider.apiKey) {
      try {
        const aiPrompt = `You are a Principal Product UX & Conversion Optimization (CRO) Agent auditing a live website.
Audited URL: ${snapshot.url}
Page Title: ${pageTitle}
Page Intent: ${pageIntent}
Headings: H1=${JSON.stringify(h1List)}, H2 count=${h2Count}
Interactive Inventory: ${allButtons.length} buttons, ${allLinks.length} links, ${allForms.length} forms
Discovered Friction Points: ${frictionPoints.map((f) => f.title).join('; ')}

Analyze whether the website's user journey and conversion flow operates as it should, or where user friction and broken flows occur.
Provide concrete, actionable recommendations on how to improve the website flow and user experience.
Respond STRICTLY with valid JSON matching this schema:
{
  "summary": "2-3 sentence executive UX assessment of the website flow",
  "strengths": ["string", "string"],
  "additionalRecommendations": [
    {
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "title": "Short title",
      "currentFlowIssue": "What is broken or suboptimal",
      "suggestedImprovement": "How to make the flow better step-by-step",
      "expectedImpact": "Business or user impact"
    }
  ]
}`;

        const aiResponse = await cloudLlmClient.generateCompletion(aiPrompt, { maxTokens: 600, temperature: 0.1 }, aiConfig);
        if (aiResponse) {
          const parsed = extractJsonFromResponse<{
            summary?: string;
            strengths?: string[];
            additionalRecommendations?: FlowRecommendation[];
          }>(aiResponse, {});

          if (parsed.summary) {
            evaluatedBy = `${activeProvider.provider.toUpperCase()} Pro Agent (${activeProvider.model})`;
            if (parsed.strengths && Array.isArray(parsed.strengths)) {
              strengths.push(...parsed.strengths);
            }
            if (parsed.additionalRecommendations && Array.isArray(parsed.additionalRecommendations)) {
              for (const rec of parsed.additionalRecommendations) {
                recommendations.push({
                  id: `rec_ai_${Math.random().toString(36).substring(2, 6)}`,
                  priority: rec.priority || 'MEDIUM',
                  title: rec.title,
                  currentFlowIssue: rec.currentFlowIssue,
                  suggestedImprovement: rec.suggestedImprovement,
                  expectedImpact: rec.expectedImpact,
                });
              }
            }
          }
        }
      } catch (err) {
        logger.warn('AI Flow enhancement failed; continuing with deterministic heuristics', err);
      }
    }

    const summary = frictionPoints.length === 0
      ? `The website flow on ${snapshot.url} is structured intuitively with clear conversion pathways and low user friction.`
      : `The website flow has ${frictionPoints.length} notable friction points impacting conversion and navigation flow. Remediation is recommended to improve user retention.`;

    const flowAnalysis: WebsiteFlowAnalysis = {
      pageIntent,
      flowScore,
      flowRating,
      summary,
      strengths: [...new Set(strengths)],
      frictionPoints,
      recommendations,
      evaluatedBy,
    };

    // 4. Transform friction points into high-value UX Findings
    const findings: Finding[] = frictionPoints.map((f, idx) => {
      const relatedRec = recommendations.find((r) => r.title.toLowerCase().includes(f.title.toLowerCase())) || recommendations[idx];
      const recText = relatedRec ? relatedRec.suggestedImprovement : 'Optimize layout hierarchy for smoother user journey.';
      return {
        id: `finding_ux_${sessionId}_${idx + 1}`,
        sessionId,
        category: 'UX',
        severity: f.severity,
        status: f.severity === 'CRITICAL' || f.severity === 'HIGH' ? 'FAIL' : 'WARNING',
        confidence: 0.95,
        title: `[Website Flow] ${f.title}`,
        description: `${f.description}\n\nFlow Recommendation: ${recText}`,
        page: snapshot.url,
        selector: f.elementSelector,
        evidence: [],
        steps: [
          `Navigate to ${snapshot.url}`,
          'Observe user journey and conversion pathways',
          `Identify friction point: ${f.title}`,
        ],
        expected: 'Smooth, intuitive user navigation and clear conversion path',
        actual: f.description,
        recommendation: recText,
        retestCount: 0,
        timestamp: Date.now(),
      };
    });

    return {
      flowAnalysis,
      findings,
    };
  }
}

export const flowAnalyzer = new FlowAnalyzer();
