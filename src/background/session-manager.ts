import { QASession, SessionConfig } from '../shared/types/session';
import { AgentState } from '../shared/types/agent';
import { PageSnapshot, WebsiteDiscoveryMap } from '../shared/types/discovery';
import { AgentStateMachine } from '../agent/state-machine';
import { sessionStore } from '../storage/session-store';
import { settingsStore } from '../storage/settings-store';
import { dbClient } from '../storage/indexed-db';
import { sendToTab, ensureContentScriptInjected } from '../shared/messaging/bus';
import { WebsiteCrawler } from '../qa/crawler';
import { qaEngine } from '../qa/engine';
import { enrichFindingsBatch } from '../evidence/bundler';
import { isInspectableUrl, getTabOrigin, getActiveInspectableTab } from './permissions-manager';
import { agentRunner } from '../agent/runner';
import { TestPlan } from '../shared/types/agent';
import { flowAnalyzer } from '../ai/flow-analyzer';
import { WebsiteFlowAnalysis } from '../reporting/report-types';
import { popupMonitor } from './popup-monitor';
import { captureTabScreenshot } from '../evidence/screenshot';
import { visionAnalyzer } from '../ai/vision-analyzer';
import { workflowEngine } from '../agent/workflow-engine';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('SessionManager');

export class SessionManager {
  private currentSession: QASession | null = null;
  private stateMachine: AgentStateMachine = new AgentStateMachine('IDLE');
  private isPaused: boolean = false;
  private crawler: WebsiteCrawler | null = null;
  private currentDiscoveryMap: WebsiteDiscoveryMap | null = null;
  private currentFlowAnalysis: WebsiteFlowAnalysis | null = null;
  private currentSnapshot: PageSnapshot | null = null;
  private onStateChangeListeners: Array<(session: QASession) => void> = [];

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getDiscoveryMap(): WebsiteDiscoveryMap | null {
    return this.currentDiscoveryMap;
  }

  public getFlowAnalysis(): WebsiteFlowAnalysis | null {
    return this.currentFlowAnalysis;
  }

  public addListener(listener: (session: QASession) => void) {
    this.onStateChangeListeners.push(listener);
  }

  public removeListener(listener: (session: QASession) => void) {
    this.onStateChangeListeners = this.onStateChangeListeners.filter((l) => l !== listener);
  }

  private notifyListeners() {
    if (this.currentSession) {
      for (const listener of this.onStateChangeListeners) {
        try {
          listener({ ...this.currentSession });
        } catch (e) {
          logger.error('Error in session state listener', e);
        }
      }
    }
  }

  public getCurrentSession(): QASession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  public async startSession(tabId?: number, userConfig?: Partial<SessionConfig>): Promise<QASession> {
    if (this.currentSession && this.currentSession.state !== 'IDLE' && this.currentSession.state !== 'COMPLETED' && this.currentSession.state !== 'ERROR') {
      logger.warn(`Session ${this.currentSession.id} already active. Returning current session.`);
      return this.currentSession;
    }

    let targetTabId = tabId;
    let targetUrl = '';
    let targetTitle = '';

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      if (!targetTabId) {
        const activeTab = await getActiveInspectableTab();
        if (activeTab) {
          targetTabId = activeTab.id;
          targetUrl = activeTab.url || '';
          targetTitle = activeTab.title || '';
        }
      } else {
        try {
          const tab = await chrome.tabs.get(targetTabId);
          if (tab) {
            targetUrl = tab.url || '';
            targetTitle = tab.title || '';
          }
        } catch {
          const activeTab = await getActiveInspectableTab();
          if (activeTab) {
            targetTabId = activeTab.id;
            targetUrl = activeTab.url || '';
            targetTitle = activeTab.title || '';
          }
        }
      }
    }

    if (!targetUrl) {
      targetUrl = 'https://example.com';
      targetTitle = 'Example Website';
    }

    if (!isInspectableUrl(targetUrl)) {
      throw new Error(`Cannot inspect URL: ${targetUrl}. Browser-internal and restricted schemes cannot be tested.`);
    }

    const baseSettings = await settingsStore.getSettings();
    const finalConfig: SessionConfig = {
      ...baseSettings,
      ...(userConfig || {}),
    };

    const sessionId = `qa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.stateMachine.reset();
    this.stateMachine.transitionTo('INITIALIZING');

    this.currentSession = {
      id: sessionId,
      tabId: targetTabId || 1,
      url: targetUrl,
      origin: getTabOrigin(targetUrl),
      title: targetTitle,
      state: 'INITIALIZING',
      startTime: Date.now(),
      progress: 5,
      currentAction: 'Initializing QA session and connecting to page...',
      stats: {
        pagesDiscovered: 1,
        pagesCrawled: 0,
        elementsDiscovered: 0,
        testsExecuted: 0,
        passedCount: 0,
        failedCount: 0,
        warningsCount: 0,
        criticalBugsCount: 0,
      },
      config: finalConfig,
    };

    this.isPaused = false;
    this.currentDiscoveryMap = null;
    this.currentFlowAnalysis = null;
    this.currentSnapshot = null;
    if (targetTabId) {
      popupMonitor.startMonitoring(targetTabId);
    }
    await sessionStore.saveSession(this.currentSession);
    this.notifyListeners();

    logger.info(`Session ${sessionId} started on ${targetUrl}`);
    return this.currentSession;
  }

  /**
   * Executes the autonomous discovery pipeline on the current active tab.
   */
  public async runDiscovery(): Promise<WebsiteDiscoveryMap | null> {
    if (!this.currentSession) return null;

    try {
      await this.updateState('DISCOVERING', 15, 'Scanning target DOM structure, metadata, and interactive elements...');

      this.crawler = new WebsiteCrawler(
        this.currentSession.url,
        this.currentSession.config.maxPages,
        this.currentSession.config.crawlDepth
      );

      // Proactively ensure content script is injected and ready on the target tab
      if (this.currentSession.tabId) {
        await ensureContentScriptInjected(this.currentSession.tabId);
      }

      // Request scan from content script
      const response = await sendToTab(this.currentSession.tabId, 'SCAN_PAGE_DISCOVERY', {});
      if (response && (response as { snapshot?: PageSnapshot }).snapshot) {
        const snapshot = (response as { snapshot: PageSnapshot }).snapshot;
        this.currentSnapshot = snapshot;

        // Persist page snapshot in IndexedDB
        await dbClient.put('page_snapshots', snapshot);

        // Feed to crawler
        this.crawler.addPageSnapshot(snapshot, 0);
        this.currentDiscoveryMap = this.crawler.buildDiscoveryMap(this.currentSession.id);

        // Persist discovery map in IndexedDB
        await dbClient.put('discovery_maps', this.currentDiscoveryMap);

        // Update session stats and advance to ANALYZING
        await this.updateState(
          'ANALYZING',
          35,
          `Discovery complete: ${this.currentDiscoveryMap.totalDiscoveredPages} pages, ${snapshot.buttons.length} buttons, ${snapshot.forms.length} forms, ${snapshot.links.length} links cataloged.`,
          {
            pagesDiscovered: this.currentDiscoveryMap.totalDiscoveredPages,
            elementsDiscovered: snapshot.totalInteractiveCount,
          }
        );

        // Advance to PLANNING
        await this.updateState(
          'PLANNING',
          45,
          'Synthesizing test matrix and mapping QA rules across categories...'
        );

        // Advance to EXECUTING
        await this.updateState(
          'EXECUTING',
          60,
          'Executing deterministic QA suites across functional, SEO, accessibility, responsive, and performance rules...'
        );

        // Fetch runtime console errors and network failures from tab
        let runtimeData = {
          consoleErrors: [] as import('../qa/console-tester').ConsoleErrorItem[],
          networkFailures: [] as import('../qa/network-tester').NetworkFailureItem[],
        };
        try {
          const obsRes = await sendToTab(this.currentSession.tabId, 'GET_RUNTIME_OBSERVER_DATA', {});
          if (obsRes && (obsRes as typeof runtimeData).consoleErrors) {
            runtimeData = obsRes as typeof runtimeData;
          }
        } catch {
          // Tab observer not ready, proceed with page snapshot
        }

        const qaResult = await qaEngine.runAllTests(
          snapshot,
          this.currentSession.id,
          this.currentSession.config,
          {
            consoleErrors: runtimeData.consoleErrors,
            networkFailures: runtimeData.networkFailures,
          }
        );

        // Enrich findings with visual screenshot evidence and DOM snippets
        const enrichedFindings = await enrichFindingsBatch(
          qaResult.findings,
          this.currentSession.tabId,
          { captureScreenshots: true }
        );

        // Save enriched findings back to session store
        for (const finding of enrichedFindings) {
          await sessionStore.saveFinding(finding);
        }

        const passedCount = Object.values(qaResult.scores.categoryScores).reduce((acc, c) => acc + c.passedCount, 0);
        const failedCount = qaResult.scores.criticalCount + qaResult.scores.highCount;
        const warningsCount = qaResult.scores.mediumCount + qaResult.scores.lowCount;
        const criticalBugsCount = qaResult.scores.criticalCount;
        const testsExecuted = qaResult.findings.length + passedCount;

        // Run Website Flow & UX Journey Analysis
        const flowResult = await flowAnalyzer.analyzeFlow(
          snapshot,
          this.currentSession.id,
          this.currentSession.config.ai
        );
        this.currentFlowAnalysis = flowResult.flowAnalysis;

        // Persist UX flow findings
        for (const finding of flowResult.findings) {
          await sessionStore.saveFinding(finding);
        }

        const totalFindingsCount = qaResult.findings.length + flowResult.findings.length;

        // Advance to OBSERVING
        await this.updateState(
          'OBSERVING',
          80,
          `QA & Flow Audit complete: ${totalFindingsCount} findings detected (Overall Score: ${qaResult.scores.overallScore}/100, Flow Rating: ${flowResult.flowAnalysis.flowRating}).`,
          {
            testsExecuted: testsExecuted + flowResult.findings.length,
            passedCount,
            failedCount,
            warningsCount: warningsCount + flowResult.findings.length,
            criticalBugsCount,
          }
        );

        return this.currentDiscoveryMap;
      }
    } catch (err) {
      logger.error(`Discovery scan failed: ${err instanceof Error ? err.message : String(err)}`);
      await this.updateState('ERROR', undefined, `Discovery error: ${err instanceof Error ? err.message : String(err)}`);
    }

    return null;
  }

  /**
   * Executes the Phase 5 Autonomous Agent feedback loop:
   * PLANNING -> EXECUTING -> OBSERVING -> REASONING -> VERIFYING -> REPORTING -> COMPLETED
   */
  public async runAgentLoop(snapshotOverride?: PageSnapshot): Promise<{ plan: TestPlan; findings: import('../shared/types/qa').Finding[] } | null> {
    if (!this.currentSession) return null;

    try {
      let snapshot = snapshotOverride || this.currentSnapshot;

      // Validate snapshot origin and URL against active session to prevent cross-site contamination
      if (snapshot && this.currentSession) {
        const sessionOrigin = this.currentSession.origin.toLowerCase();
        const snapshotOrigin = (snapshot.origin || '').toLowerCase();
        const matchesOrigin = snapshotOrigin === sessionOrigin || snapshot.url.toLowerCase().startsWith(sessionOrigin);
        if (!matchesOrigin) {
          logger.warn(`Discarding cross-origin stale snapshot from ${snapshot.url} (expected session on ${this.currentSession.url})`);
          snapshot = null;
          this.currentSnapshot = null;
        }
      }

      // Try fetching matching snapshot for current session URL from IndexedDB
      if (!snapshot && this.currentSession?.url) {
        try {
          const matching = await dbClient.get('page_snapshots', this.currentSession.url);
          if (matching && (matching.origin === this.currentSession.origin || matching.url.startsWith(this.currentSession.origin))) {
            snapshot = matching;
            this.currentSnapshot = matching;
          }
        } catch {}
      }

      // If still no matching snapshot, take a live scan from the active tab
      if (!snapshot && this.currentSession?.tabId) {
        try {
          logger.info(`Requesting live discovery scan for tab ${this.currentSession.tabId} on ${this.currentSession.url}`);
          const res = await sendToTab(this.currentSession.tabId, 'SCAN_PAGE_DISCOVERY', {});
          const tabSnapshot = (res as { snapshot?: PageSnapshot })?.snapshot;
          if (tabSnapshot) {
            snapshot = tabSnapshot;
            this.currentSnapshot = tabSnapshot;
            await dbClient.put('page_snapshots', tabSnapshot);
          }
        } catch (e) {
          logger.warn('Failed to take live scan from active tab', e);
        }
      }

      if (!snapshot) {
        throw new Error(`No page snapshot available for ${this.currentSession.url}.`);
      }

      const result = await agentRunner.runLoop(
        this.currentSession,
        snapshot,
        async (update) => {
          await this.updateState(
            update.state,
            update.progress,
            update.currentAction,
            update.statsUpdate
          );
        }
      );

      // Enrich newly discovered interactive findings
      if (result.findings.length > 0) {
        const enrichedFindings = await enrichFindingsBatch(
          result.findings,
          this.currentSession.tabId,
          { captureScreenshots: true }
        );
        for (const f of enrichedFindings) {
          await sessionStore.saveFinding(f);
        }
      }

      // Update state for this completed page
      await this.updateState(
        'REPORTING',
        undefined,
        `Page audit complete for ${snapshot.url}: ${this.currentSession.stats.testsExecuted} tests evaluated.`
      );

      return result;
    } catch (err) {
      logger.error('Agent loop failed', err);
      await this.updateState('ERROR', undefined, `Agent loop error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * Navigates a browser tab to a new URL and waits for page to settle.
   */
  public async navigateToUrl(tabId: number, url: string, timeoutMs = 8000): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.tabs || typeof chrome.tabs.update !== 'function') {
      return;
    }

    return new Promise((resolve) => {
      let isSettled = false;
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            if (chrome.tabs?.onUpdated?.removeListener) {
              chrome.tabs.onUpdated.removeListener(onUpdated);
            }
          } catch {}
          resolve();
        }
      }, timeoutMs);

      const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timer);
            try {
              if (chrome.tabs?.onUpdated?.removeListener) {
                chrome.tabs.onUpdated.removeListener(onUpdated);
              }
            } catch {}
            setTimeout(async () => {
              try {
                await ensureContentScriptInjected(tabId);
              } catch {}
              resolve();
            }, 600);
          }
        }
      };

      try {
        if (chrome.tabs?.onUpdated?.addListener) {
          chrome.tabs.onUpdated.addListener(onUpdated);
        }
        chrome.tabs.update(tabId, { url }).catch(() => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timer);
            resolve();
          }
        });
      } catch {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          resolve();
        }
      }
    });
  }

  /**
   * Runs the complete end-to-end QA pipeline:
   * Discovery + Deterministic Tests + Evidence Engine + Autonomous Interactive Feedback Loop.
   * Autonomously explores multiple pages across the website up to maxPages.
   */
  public async runFullQA(): Promise<void> {
    const discoveryMap = await this.runDiscovery();
    if (!discoveryMap || !this.currentSession || this.currentSession.state === 'ERROR') {
      return;
    }

    // Run visual perception on Page 1 (initial view)
    await this.performJarvisPerception('Visual overview of landing view & structural layout');

    // Run interactive testing loop on Page 1 (initial view)
    await this.runAgentLoop(this.currentSnapshot || undefined);

    // Goal-Driven User & Record Creation Journey on initial view if create actions exist
    const hasCreateBtn = (this.currentSnapshot?.buttons || []).some((b) =>
      /(nouv|cr[ée]|add|ajouter|créer|nouvel|new|register|inscrire|\+\s*candidat|\+\s*étudiant)/i.test(b.text || '')
    ) || (this.currentSnapshot?.forms || []).length > 0;

    if (hasCreateBtn && this.currentSnapshot && this.currentSession) {
      await this.updateState('EXECUTING', 32, '[Jarvis Goal] Executing Autonomous User & Record Creation Journey...');
      const wfRes = await workflowEngine.executeCreateRecordWorkflow(
        this.currentSession.tabId,
        this.currentSnapshot,
        this.currentSession.id,
        (msg) => {
          if (this.currentSession) {
            this.currentSession.currentAction = `[Jarvis Goal] ${msg}`;
            this.notifyListeners();
          }
        }
      );
      for (const f of wfRes.findings) {
        await sessionStore.saveFinding(f);
      }
      await this.syncLiveTransactions();
    }

    // Deep SPA Multi-Tab Exploration (for dashboards, admin panels, and single-page apps)
    if (this.currentSnapshot?.tabs && this.currentSnapshot.tabs.length > 0 && this.currentSession) {
      const tabsToExplore = this.currentSnapshot.tabs.slice(0, 15);
      let tabIndex = 0;

      for (const tab of tabsToExplore) {
        if (this.isPaused) {
          while (this.isPaused && (this.currentSession.state as string) !== 'COMPLETED') {
            await new Promise((r) => setTimeout(r, 400));
          }
        }
        if (!this.currentSession || (this.currentSession.state as string) === 'COMPLETED' || (this.currentSession.state as string) === 'ERROR') {
          break;
        }

        tabIndex++;
        const tabProgress = Math.min(92, Math.round(30 + (tabIndex / tabsToExplore.length) * 55));
        logger.info(`[SPA Tab QA ${tabIndex}/${tabsToExplore.length}] Activating tab: "${tab.text}"`);

        await this.updateState(
          'EXECUTING',
          tabProgress,
          `[SPA Tab QA ${tabIndex}/${tabsToExplore.length}] Exploring: "${tab.text}"`
        );

        try {
          // Click the tab item
          await sendToTab(this.currentSession.tabId, 'EXECUTE_ACTION', {
            action: 'CLICK',
            selector: tab.selector,
            options: {
              textHint: tab.text,
              tagHint: 'button, [role="tab"], [role="menuitem"], a, li',
            },
          });

          // Wait for SPA view transition & hydration
          await new Promise((r) => setTimeout(r, 450));

          // Scan the newly rendered tab view
          const tabScanRes = await sendToTab(this.currentSession.tabId, 'SCAN_PAGE_DISCOVERY', {});
          const tabSnapshot = (tabScanRes as { snapshot?: PageSnapshot })?.snapshot;

          if (tabSnapshot) {
            this.currentSnapshot = tabSnapshot;
            await dbClient.put('page_snapshots', tabSnapshot);

            // Multimodal Vision Perception of this active tab
            await this.performJarvisPerception(`Visual perception of tab: "${tab.text}"`);

            // Fetch runtime console & network telemetry
            let runtimeData = {
              consoleErrors: [] as import('../qa/console-tester').ConsoleErrorItem[],
              networkFailures: [] as import('../qa/network-tester').NetworkFailureItem[],
            };
            try {
              const obsRes = await sendToTab(this.currentSession.tabId, 'GET_RUNTIME_OBSERVER_DATA', {});
              if (obsRes && (obsRes as typeof runtimeData).consoleErrors) {
                runtimeData = obsRes as typeof runtimeData;
              }
            } catch {}

            // Run deterministic test suites on this tab view
            const qaResult = await qaEngine.runAllTests(
              tabSnapshot,
              this.currentSession.id,
              this.currentSession.config,
              {
                consoleErrors: runtimeData.consoleErrors,
                networkFailures: runtimeData.networkFailures,
              }
            );

            const enrichedFindings = await enrichFindingsBatch(
              qaResult.findings,
              this.currentSession.tabId,
              { captureScreenshots: true }
            );
            for (const f of enrichedFindings) {
              await sessionStore.saveFinding(f);
            }

            // Run interactive form filling and button testing on this tab
            await this.runAgentLoop(tabSnapshot);

            // Check if tab is a user/record directory (e.g. Répertoire des étudiants, Candidats) or has create buttons
            const isRecordTab =
              /(étudiant|candidat|user|utilisateur|membre|stagiaire|compte|répertoire|client)/i.test(tab.text) ||
              (tabSnapshot.buttons || []).some((b) => /(nouv|cr[ée]|add|ajouter|créer)/i.test(b.text || ''));

            if (isRecordTab && this.currentSession) {
              await this.updateState('EXECUTING', tabProgress, `[Jarvis Goal] Testing User Creation on "${tab.text}"...`);
              const tabWfRes = await workflowEngine.executeCreateRecordWorkflow(
                this.currentSession.tabId,
                tabSnapshot,
                this.currentSession.id,
                (msg) => {
                  if (this.currentSession) {
                    this.currentSession.currentAction = `[Jarvis Goal] ${msg}`;
                    this.notifyListeners();
                  }
                }
              );
              for (const f of tabWfRes.findings) {
                await sessionStore.saveFinding(f);
              }
            }

            // Synchronize live intercepted API transactions
            await this.syncLiveTransactions();
          }
        } catch (tabErr) {
          logger.warn(`Error during SPA tab exploration on "${tab.text}":`, tabErr);
        }
      }
    }

    // Multi-page autonomous crawling & deep exploratory testing
    const maxPages = Math.max(1, Math.min(this.currentSession.config.maxPages || 5, 15));
    let pagesCrawled = 1;

    while (
      this.crawler &&
      pagesCrawled < maxPages &&
      this.currentSession &&
      (this.currentSession.state as string) !== 'COMPLETED' &&
      (this.currentSession.state as string) !== 'ERROR'
    ) {
      if (this.isPaused) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }

      const nextTarget = this.crawler.getNextUrlToCrawl();
      if (!nextTarget) {
        break; // No more queued internal routes
      }

      pagesCrawled++;
      const currentProgress = Math.min(95, Math.round(20 + (pagesCrawled / maxPages) * 70));
      logger.info(`Navigating to internal page ${pagesCrawled}/${maxPages}: ${nextTarget.url}`);

      await this.updateState(
        'DISCOVERING',
        currentProgress,
        `[Multi-Page QA ${pagesCrawled}/${maxPages}] Exploring: ${nextTarget.url}`,
        { pagesCrawled }
      );

      // Navigate tab to next target route
      try {
        await this.navigateToUrl(this.currentSession.tabId, nextTarget.url);
      } catch (navErr) {
        logger.warn(`Failed to navigate to ${nextTarget.url}:`, navErr);
        continue;
      }

      // Re-scan newly navigated page
      let pageSnapshot: PageSnapshot | null = null;
      try {
        const pageRes = await sendToTab(this.currentSession.tabId, 'SCAN_PAGE_DISCOVERY', {});
        pageSnapshot = (pageRes as { snapshot?: PageSnapshot })?.snapshot || null;
      } catch (scanErr) {
        logger.warn(`Could not scan navigated page ${nextTarget.url}:`, scanErr);
      }

      if (!pageSnapshot) {
        continue;
      }

      this.currentSnapshot = pageSnapshot;
      await dbClient.put('page_snapshots', pageSnapshot);
      this.crawler.addPageSnapshot(pageSnapshot, nextTarget.depth);
      this.currentDiscoveryMap = this.crawler.buildDiscoveryMap(this.currentSession.id);
      await dbClient.put('discovery_maps', this.currentDiscoveryMap);

      // Run deterministic tests on new page
      let runtimeData = {
        consoleErrors: [] as import('../qa/console-tester').ConsoleErrorItem[],
        networkFailures: [] as import('../qa/network-tester').NetworkFailureItem[],
      };
      try {
        const obsRes = await sendToTab(this.currentSession.tabId, 'GET_RUNTIME_OBSERVER_DATA', {});
        if (obsRes && (obsRes as typeof runtimeData).consoleErrors) {
          runtimeData = obsRes as typeof runtimeData;
        }
      } catch {}

      try {
        const qaResult = await qaEngine.runAllTests(
          pageSnapshot,
          this.currentSession.id,
          this.currentSession.config,
          {
            consoleErrors: runtimeData.consoleErrors,
            networkFailures: runtimeData.networkFailures,
          }
        );

        const enrichedFindings = await enrichFindingsBatch(
          qaResult.findings,
          this.currentSession.tabId,
          { captureScreenshots: true }
        );
        for (const f of enrichedFindings) {
          await sessionStore.saveFinding(f);
        }

        // Run interactive agent loop on this newly visited page!
        await this.runAgentLoop(pageSnapshot);
      } catch (pageTestErr) {
        logger.warn(`Error running tests on page ${nextTarget.url}:`, pageTestErr);
      }
    }

    // Mark entire multi-page session as completed
    if (this.currentSession && (this.currentSession.state as string) !== 'ERROR') {
      await this.updateState(
        'COMPLETED',
        100,
        `Autonomous QA Complete: Audited website across all tabs and views, executing ${this.currentSession.stats.testsExecuted} tests across forms, buttons, and navigation.`
      );
    }
  }

  public getActivePlan(): TestPlan | null {
    return agentRunner.getActivePlan();
  }

  public async updateState(
    newState: AgentState,
    progress?: number,
    currentAction?: string,
    statsUpdate?: Partial<QASession['stats']>,
    extra?: {
      jarvisVision?: import('../shared/types/agent').JarvisVisionState;
      liveTransactions?: import('../content/injected-interceptor').HttpTransaction[];
    }
  ): Promise<void> {
    if (!this.currentSession) return;

    const transitioned = this.stateMachine.transitionTo(newState);
    if (!transitioned) {
      logger.warn(`Could not transition to state: ${newState}`);
    }

    this.currentSession.state = this.stateMachine.getState();
    if (progress !== undefined) {
      this.currentSession.progress = Math.min(100, Math.max(0, progress));
    }
    if (currentAction) {
      this.currentSession.currentAction = currentAction;
    }
    if (statsUpdate) {
      this.currentSession.stats = {
        ...this.currentSession.stats,
        ...statsUpdate,
      };
    }

    if (newState === 'COMPLETED' || newState === 'ERROR') {
      this.currentSession.endTime = Date.now();
    }

    if (extra?.jarvisVision) {
      this.currentSession.jarvisVision = extra.jarvisVision;
    }
    if (extra?.liveTransactions) {
      this.currentSession.liveTransactions = extra.liveTransactions;
    }

    await sessionStore.saveSession(this.currentSession);
    this.notifyListeners();
  }

  /**
   * Performs real-time multimodal visual perception of the browser tab like Jarvis / Nova.
   */
  public async performJarvisPerception(goalDescription: string): Promise<void> {
    if (!this.currentSession || !this.currentSession.tabId) return;
    try {
      const screenshot = await captureTabScreenshot(this.currentSession.tabId, 70);
      if (screenshot) {
        const tabNames = this.currentSnapshot?.tabs?.map((t) => t.text).filter(Boolean) || [];
        const visionResult = await visionAnalyzer.inspectScreen(
          screenshot,
          {
            url: this.currentSnapshot?.url || this.currentSession.url,
            title: this.currentSnapshot?.title || this.currentSession.title,
            currentGoal: goalDescription,
            tabs: tabNames,
            interactiveCount: this.currentSnapshot?.totalInteractiveCount,
          },
          this.currentSession.config.ai
        );

        this.currentSession.jarvisVision = {
          lastScreenshotUrl: screenshot,
          visualAnalysisText: visionResult.screenOverview,
          detectedVisualElements: visionResult.keyInteractiveElements,
          currentGoal: goalDescription,
          timestamp: Date.now(),
        };
        await sessionStore.saveSession(this.currentSession);
        this.notifyListeners();
      }
    } catch (err) {
      logger.warn('Failed to perform Jarvis visual perception', err);
    }
  }

  /**
   * Synchronizes captured live HTTP transactions from the active tab.
   */
  public async syncLiveTransactions(): Promise<void> {
    if (!this.currentSession || !this.currentSession.tabId) return;
    try {
      const netRes = await sendToTab(this.currentSession.tabId, 'GET_LIVE_NETWORK_TRANSACTIONS', {});
      if (netRes && (netRes as any).transactions) {
        this.currentSession.liveTransactions = (netRes as any).transactions;
        await sessionStore.saveSession(this.currentSession);
        this.notifyListeners();
      }
    } catch (err) {
      logger.debug('Could not sync live transactions', err);
    }
  }

  public async pauseSession(sessionId: string): Promise<boolean> {
    if (!this.currentSession || this.currentSession.id !== sessionId) {
      return false;
    }
    this.isPaused = true;
    agentRunner.pause();
    this.currentSession.currentAction = 'Session paused by user';
    await sessionStore.saveSession(this.currentSession);
    this.notifyListeners();
    return true;
  }

  public async resumeSession(sessionId: string): Promise<boolean> {
    if (!this.currentSession || this.currentSession.id !== sessionId) {
      return false;
    }
    this.isPaused = false;
    agentRunner.resume();
    this.currentSession.currentAction = 'Resuming QA session...';
    await sessionStore.saveSession(this.currentSession);
    this.notifyListeners();
    return true;
  }

  public async stopSession(sessionId: string): Promise<boolean> {
    if (!this.currentSession || this.currentSession.id !== sessionId) {
      return false;
    }

    agentRunner.stop();
    const popupFindings = popupMonitor.generateFindings(this.currentSession.id, this.currentSession.url);
    popupMonitor.stopMonitoring();
    for (const f of popupFindings) {
      await sessionStore.saveFinding(f);
    }

    this.stateMachine.transitionTo('COMPLETED');
    this.currentSession.state = 'COMPLETED';
    this.currentSession.endTime = Date.now();
    this.currentSession.currentAction = 'QA Session stopped by user';
    await sessionStore.saveSession(this.currentSession);
    this.notifyListeners();
    return true;
  }

  public resetForTesting(): void {
    agentRunner.stop();
    popupMonitor.stopMonitoring();
    popupMonitor.clearEvents();
    this.currentSession = null;
    this.currentSnapshot = null;
    this.stateMachine.reset();
    this.isPaused = false;
    this.crawler = null;
    this.currentDiscoveryMap = null;
    this.onStateChangeListeners = [];
  }
}

export const sessionManager = new SessionManager();
