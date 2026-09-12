import { QASession, SessionConfig } from './session';
import { Finding } from './qa';
import { PendingActionApproval } from './agent';

export interface MessageMap {
  PING: {
    request: Record<string, never>;
    response: { pong: boolean; timestamp: number };
  };
  GET_ACTIVE_TAB_INFO: {
    request: Record<string, never>;
    response: { tabId?: number; url?: string; title?: string };
  };
  START_SESSION: {
    request: { config?: Partial<SessionConfig>; tabId?: number };
    response: { session: QASession };
  };
  STOP_SESSION: {
    request: { sessionId: string };
    response: { success: boolean };
  };
  PAUSE_SESSION: {
    request: { sessionId: string };
    response: { success: boolean };
  };
  RESUME_SESSION: {
    request: { sessionId: string };
    response: { success: boolean };
  };
  GET_CURRENT_SESSION: {
    request: Record<string, never>;
    response: { session: QASession | null };
  };
  SESSION_STATE_UPDATED: {
    request: { session: QASession };
    response: { acknowledged: boolean };
  };
  FINDING_DETECTED: {
    request: { finding: Finding };
    response: { id: string };
  };
  REQUEST_ACTION_APPROVAL: {
    request: { approval: PendingActionApproval };
    response: { approved: boolean };
  };
  APPROVE_ACTION: {
    request: { approvalId: string; approved: boolean };
    response: { success: boolean };
  };
  GET_SETTINGS: {
    request: Record<string, never>;
    response: { settings: SessionConfig };
  };
  UPDATE_SETTINGS: {
    request: { settings: Partial<SessionConfig> };
    response: { success: boolean };
  };
  TEST_LLM_KEY: {
    request: {
      provider: 'gemini' | 'openai' | 'anthropic';
      apiKey: string;
      model?: string;
    };
    response: {
      success: boolean;
      message: string;
      latencyMs?: number;
    };
  };
  CONTENT_SCRIPT_PING: {
    request: Record<string, never>;
    response: { ready: boolean; url: string; title: string };
  };
  SCAN_PAGE_DISCOVERY: {
    request: Record<string, never>;
    response: { snapshot: import('./discovery').PageSnapshot };
  };
  GET_DISCOVERY_MAP: {
    request: { sessionId: string };
    response: { map: import('./discovery').WebsiteDiscoveryMap | null };
  };
  GET_FLOW_ANALYSIS: {
    request: { sessionId: string };
    response: { flowAnalysis: import('../../reporting/report-types').WebsiteFlowAnalysis | null };
  };
  DISCOVERY_UPDATED: {
    request: { snapshot: import('./discovery').PageSnapshot; map: import('./discovery').WebsiteDiscoveryMap };
    response: { acknowledged: boolean };
  };
  CAPTURE_SCREENSHOT: {
    request: { tabId?: number; cropSelector?: string; quality?: number };
    response: { dataUrl: string; width: number; height: number; cropRegion?: import('./qa').CropRegion };
  };
  HIGHLIGHT_ELEMENT: {
    request: { selector: string; durationMs?: number; label?: string };
    response: { highlighted: boolean; rect?: import('./qa').CropRegion };
  };
  CLEAR_HIGHLIGHTS: {
    request: Record<string, never>;
    response: { cleared: boolean };
  };
  GET_RUNTIME_OBSERVER_DATA: {
    request: Record<string, never>;
    response: {
      consoleErrors: import('../../qa/console-tester').ConsoleErrorItem[];
      networkFailures: import('../../qa/network-tester').NetworkFailureItem[];
    };
  };
  EXECUTE_ACTION: {
    request: {
      action: 'CLICK' | 'FILL' | 'SUBMIT';
      selector: string;
      value?: string;
      values?: Record<string, string>;
      options?: {
        timeoutMs?: number;
        waitForNavigation?: boolean;
        textHint?: string;
        tagHint?: string;
        allowDisabled?: boolean;
        throwOnDisabled?: boolean;
      };
    };
    response: {
      executed: boolean;
      actionType: string;
      selector: string;
      durationMs: number;
      error?: string;
      wasDisabled?: boolean;
    };
  };
  OBSERVE_STATE: {
    request: {
      resetBaseline?: boolean;
    };
    response: {
      currentUrl: string;
      title: string;
      domMutationsCount: number;
      modalDetected: boolean;
      toastAlertDetected: boolean;
      alertType?: 'error' | 'success' | 'warning' | 'info';
      alertMessage?: string;
      consoleErrors: import('../../qa/console-tester').ConsoleErrorItem[];
      networkFailures: import('../../qa/network-tester').NetworkFailureItem[];
    };
  };
  GET_LIVE_NETWORK_TRANSACTIONS: {
    request: {
      sinceTimestamp?: number;
    };
    response: {
      transactions: import('../../content/injected-interceptor').HttpTransaction[];
      hasMutations: boolean;
    };
  };
}

export type MessageType = keyof MessageMap;

export interface ExtensionMessage<T extends MessageType = MessageType> {
  type: T;
  payload: MessageMap[T]['request'];
  sender?: 'sidepanel' | 'background' | 'content';
  messageId?: string;
  timestamp?: number;
}

export interface ExtensionResponse<T extends MessageType = MessageType> {
  success: boolean;
  data?: MessageMap[T]['response'];
  error?: string;
}
