import { cloudLlmClient } from './cloud-llm-client';
import { AIConfig } from '../shared/types/session';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('VisionAnalyzer');

export interface JarvisVisionAnalysis {
  screenOverview: string;
  identifiedLayout: string;
  keyInteractiveElements: string[];
  suggestedPrimaryAction?: {
    label: string;
    actionType: 'CLICK_BUTTON' | 'FILL_FORM' | 'SWITCH_TAB';
    targetDescription: string;
  };
  visualAnomalies: string[];
  rawVisionReply: string;
}

export interface VisionContext {
  url: string;
  title: string;
  currentGoal?: string;
  tabs?: string[];
  interactiveCount?: number;
}

export class VisionAnalyzer {
  /**
   * Performs real-time multimodal visual perception of the browser tab like Jarvis / Nova.
   */
  public async inspectScreen(
    screenshotDataUrl: string,
    context: VisionContext,
    aiConfig?: AIConfig
  ): Promise<JarvisVisionAnalysis> {
    const prompt = `You are Jarvis/Nova, an advanced autonomous QA AI agent viewing a live screenshot of a web application.
Application Context:
- URL: ${context.url}
- Title: ${context.title}
- Active Goal: ${context.currentGoal || 'Inspect view, discover workflows, verify UI rendering and interactive data entry'}
${context.tabs && context.tabs.length > 0 ? `- Visible Tabs/Sections: ${context.tabs.join(', ')}` : ''}

Analyze the screenshot visually:
1. What kind of interface is this? (e.g. Admin dashboard, candidate table, settings form, modal dialog, landing page)
2. What are the prominent interactive buttons or call-to-actions visible? (e.g. "Nouveau Candidat", "Ajouter", "Enregistrer", "Recherche")
3. Are there active input fields, tables, or modals on screen?
4. What is the most logical next human QA action to test functional business logic (e.g. clicking create/add button to create a real record, or filling a form)?
5. Are there any visual defects or rendering anomalies visible? (overlapping text, cut-off content, broken images, misaligned buttons)

Provide your response in structured JSON format with this exact schema:
{
  "screenOverview": "Concise summary of what is visually visible on screen",
  "identifiedLayout": "Layout classification (e.g. 'Dashboard with Sidebar and Candidate Table')",
  "keyInteractiveElements": ["Button: Nouveau", "Tab: Répertoire des étudiants", "Input: Recherche"],
  "suggestedPrimaryAction": {
    "label": "Action title",
    "actionType": "CLICK_BUTTON",
    "targetDescription": "Detailed visual description of element to interact with"
  },
  "visualAnomalies": []
}`;

    try {
      const visionResponse = await cloudLlmClient.generateVisionCompletion(
        prompt,
        screenshotDataUrl,
        { temperature: 0.1, maxTokens: 600 },
        aiConfig
      );

      if (visionResponse) {
        try {
          const jsonMatch = visionResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              screenOverview: parsed.screenOverview || 'Visual view inspected',
              identifiedLayout: parsed.identifiedLayout || 'Standard Web Application View',
              keyInteractiveElements: Array.isArray(parsed.keyInteractiveElements) ? parsed.keyInteractiveElements : [],
              suggestedPrimaryAction: parsed.suggestedPrimaryAction,
              visualAnomalies: Array.isArray(parsed.visualAnomalies) ? parsed.visualAnomalies : [],
              rawVisionReply: visionResponse,
            };
          }
        } catch {}

        return {
          screenOverview: visionResponse.slice(0, 200),
          identifiedLayout: 'Web Application Interface',
          keyInteractiveElements: [],
          visualAnomalies: [],
          rawVisionReply: visionResponse,
        };
      }
    } catch (err) {
      logger.warn('Cloud multimodal vision request failed, using heuristic visual synthesis', err);
    }

    // Heuristic fallback when cloud vision is offline
    const isDashboard = context.title.toLowerCase().includes('admin') ||
      context.url.includes('dashboard') ||
      (context.tabs && context.tabs.length > 0);

    return {
      screenOverview: `Active viewport on ${context.title || context.url}. Detected ${context.interactiveCount || 'multiple'} interactive elements${context.tabs?.length ? ` across ${context.tabs.length} tabs` : ''}.`,
      identifiedLayout: isDashboard ? 'Administrative Workspace / Dashboard' : 'Interactive Web Application',
      keyInteractiveElements: context.tabs ? context.tabs.map((t) => `Tab: ${t}`) : ['Primary Interactive Controls'],
      suggestedPrimaryAction: {
        label: 'Test Primary Interactive Journey',
        actionType: 'CLICK_BUTTON',
        targetDescription: 'Target add/create buttons or input forms for deep verification',
      },
      visualAnomalies: [],
      rawVisionReply: 'Heuristic visual perception active.',
    };
  }
}

export const visionAnalyzer = new VisionAnalyzer();
