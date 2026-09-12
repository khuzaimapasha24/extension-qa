import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { TabNav, TabId } from './components/TabNav';
import { DashboardView } from './components/DashboardView';
import { LiveRunnerView } from './components/LiveRunnerView';
import { FindingsView } from './components/FindingsView';
import { ReportView } from './components/ReportView';
import { SettingsView } from './components/SettingsView';
import { StatusBar } from './components/StatusBar';
import { QASession, SessionConfig } from '../shared/types/session';
import { Finding } from '../shared/types/qa';
import { WebsiteDiscoveryMap } from '../shared/types/discovery';
import { WebsiteFlowAnalysis } from '../reporting/report-types';
import { DEFAULT_SESSION_CONFIG } from '../shared/constants/defaults';
import { sendToBackground } from '../shared/messaging/bus';
import { sessionStore } from '../storage/session-store';
import { dbClient } from '../storage/indexed-db';
import { ExtensionMessage } from '../shared/types/messages';
import './styles/sidepanel.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [currentTabUrl, setCurrentTabUrl] = useState<string>('');
  const [currentTabTitle, setCurrentTabTitle] = useState<string>('');
  const [session, setSession] = useState<QASession | null>(null);
  const [discoveryMap, setDiscoveryMap] = useState<WebsiteDiscoveryMap | null>(null);
  const [flowAnalysis, setFlowAnalysis] = useState<WebsiteFlowAnalysis | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [settings, setSettings] = useState<SessionConfig>(DEFAULT_SESSION_CONFIG);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');

  // Load active browser tab info with multi-window fallback for Side Panel
  const refreshActiveTab = useCallback(async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        let activeTab: chrome.tabs.Tab | undefined;

        // 1. Try lastFocusedWindow (most accurate when interacting within Side Panel)
        try {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          if (tab && tab.id) activeTab = tab;
        } catch {}

        // 2. Fallback to currentWindow
        if (!activeTab) {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) activeTab = tab;
          } catch {}
        }

        // 3. Fallback to any active tab
        if (!activeTab) {
          try {
            const tabs = await chrome.tabs.query({ active: true });
            const inspectable = tabs.find((t) => t.id && t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('about:'));
            activeTab = inspectable || tabs[0];
          } catch {}
        }

        if (activeTab) {
          setCurrentTabId(activeTab.id ?? null);
          setCurrentTabUrl(activeTab.url ?? '');
          setCurrentTabTitle(activeTab.title ?? '');
        }
      }
    } catch {
      // Tab query fallback
    }
  }, []);

  // Load current session & settings on mount
  useEffect(() => {
    refreshActiveTab();

    // Fetch initial settings
    sendToBackground('GET_SETTINGS', {})
      .then((res) => {
        if (res?.settings) setSettings(res.settings);
      })
      .catch(() => {});

    // Fetch active session if any
    sendToBackground('GET_CURRENT_SESSION', {})
      .then(async (res) => {
        if (res?.session) {
          setSession(res.session);
          const sessionFindings = await sessionStore.getFindingsBySession(res.session.id);
          setFindings(sessionFindings);
          sendToBackground('GET_DISCOVERY_MAP', { sessionId: res.session.id })
            .then((mapRes) => {
              if (mapRes?.map) setDiscoveryMap(mapRes.map);
            })
            .catch(() => {});
          sendToBackground('GET_FLOW_ANALYSIS', { sessionId: res.session.id })
            .then((flowRes) => {
              if (flowRes?.flowAnalysis) setFlowAnalysis(flowRes.flowAnalysis);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    // Listen to background broadcast updates
    const messageListener = (
      msg: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse?: (res?: unknown) => void
    ) => {
      if (msg && msg.type === 'SESSION_STATE_UPDATED') {
        const payload = msg.payload as { session: QASession };
        if (payload?.session) {
          setSession(payload.session);
          sessionStore.getFindingsBySession(payload.session.id).then(setFindings);
          sendToBackground('GET_DISCOVERY_MAP', { sessionId: payload.session.id })
            .then((mapRes) => {
              if (mapRes?.map) setDiscoveryMap(mapRes.map);
            })
            .catch(() => {});
          sendToBackground('GET_FLOW_ANALYSIS', { sessionId: payload.session.id })
            .then((flowRes) => {
              if (flowRes?.flowAnalysis) setFlowAnalysis(flowRes.flowAnalysis);
            })
            .catch(() => {});
        }
        if (typeof sendResponse === 'function') {
          try {
            sendResponse({ acknowledged: true });
          } catch {
            // Port might be closed if sender had no response expectations
          }
        }
      }
      return false;
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    // Listen to tab and window focus changes
    if (typeof chrome !== 'undefined') {
      if (chrome.tabs?.onActivated) {
        chrome.tabs.onActivated.addListener(refreshActiveTab);
      }
      if (chrome.tabs?.onUpdated) {
        chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
          if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
            refreshActiveTab();
          }
        });
      }
      if (chrome.tabs?.onHighlighted) {
        chrome.tabs.onHighlighted.addListener(refreshActiveTab);
      }
      if (chrome.windows?.onFocusChanged) {
        chrome.windows.onFocusChanged.addListener(refreshActiveTab);
      }
    }

    return () => {
      if (typeof chrome !== 'undefined') {
        if (chrome.runtime?.onMessage) {
          chrome.runtime.onMessage.removeListener(messageListener);
        }
        if (chrome.tabs?.onActivated) {
          chrome.tabs.onActivated.removeListener(refreshActiveTab);
        }
        if (chrome.tabs?.onHighlighted) {
          chrome.tabs.onHighlighted.removeListener(refreshActiveTab);
        }
        if (chrome.windows?.onFocusChanged) {
          chrome.windows.onFocusChanged.removeListener(refreshActiveTab);
        }
      }
    };
  }, [refreshActiveTab]);

  const handleStartQA = async () => {
    try {
      setStatusMessage('Starting QA session...');
      const response = await sendToBackground('START_SESSION', {
        tabId: currentTabId || undefined,
        config: settings,
      });

      if (response?.session) {
        setSession(response.session);
        setActiveTab('runner');
        setStatusMessage('QA session in progress');
      }
    } catch (err) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePauseSession = async () => {
    if (!session) return;
    try {
      await sendToBackground('PAUSE_SESSION', { sessionId: session.id });
      setStatusMessage('Session paused');
    } catch (err) {
      setStatusMessage(`Pause failed: ${String(err)}`);
    }
  };

  const handleResumeSession = async () => {
    if (!session) return;
    try {
      await sendToBackground('RESUME_SESSION', { sessionId: session.id });
      setStatusMessage('Session resumed');
    } catch (err) {
      setStatusMessage(`Resume failed: ${String(err)}`);
    }
  };

  const handleStopSession = async () => {
    if (!session) return;
    try {
      await sendToBackground('STOP_SESSION', { sessionId: session.id });
      setStatusMessage('Session stopped');
    } catch (err) {
      setStatusMessage(`Stop failed: ${String(err)}`);
    }
  };

  const handleUpdateSettings = async (updated: Partial<SessionConfig>) => {
    try {
      await sendToBackground('UPDATE_SETTINGS', { settings: updated });
      setSettings((prev) => ({ ...prev, ...updated }));
      setStatusMessage('Settings updated');
    } catch (err) {
      setStatusMessage(`Settings update failed: ${String(err)}`);
    }
  };

  const handleResetSettings = async () => {
    const defaults = { ...DEFAULT_SESSION_CONFIG };
    await handleUpdateSettings(defaults);
  };

  const handleClearStorage = async () => {
    try {
      await dbClient.clear('sessions');
      await dbClient.clear('findings');
      await dbClient.clear('logs');
      setSession(null);
      setFindings([]);
      setStatusMessage('Local database cleared');
    } catch (err) {
      setStatusMessage(`Clear storage failed: ${String(err)}`);
    }
  };

  return (
    <div className="panel-container">
      <Header state={session?.state || 'IDLE'} privacyMode={settings.privacyMode} />
      <TabNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        findingsCount={findings.length}
      />

      {activeTab === 'dashboard' && (
        <DashboardView
          currentTabUrl={currentTabUrl}
          currentTabTitle={currentTabTitle}
          session={session}
          discoveryMap={discoveryMap}
          flowAnalysis={flowAnalysis}
          onStartQA={handleStartQA}
          onRefreshTab={refreshActiveTab}
        />
      )}

      {activeTab === 'runner' && (
        <LiveRunnerView
          session={session}
          discoveryMap={discoveryMap}
          onPauseSession={handlePauseSession}
          onResumeSession={handleResumeSession}
          onStopSession={handleStopSession}
        />
      )}

      {activeTab === 'findings' && <FindingsView findings={findings} />}

      {activeTab === 'report' && (
        <ReportView
          session={session}
          findings={findings}
          discoveryMap={discoveryMap}
          flowAnalysis={flowAnalysis}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResetSettings={handleResetSettings}
          onClearStorage={handleClearStorage}
        />
      )}

      <StatusBar tabId={currentTabId} status={statusMessage} />
    </div>
  );
};
