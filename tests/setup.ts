import 'fake-indexeddb/auto';

// Setup chrome mock object for test environment
type MessageCallback = (
  message: any,
  sender: any,
  sendResponse: (response: any) => void
) => boolean | void;

const messageListeners: MessageCallback[] = [];

(global as any).chrome = {
  runtime: {
    lastError: null,
    onMessage: {
      addListener: (fn: MessageCallback) => {
        messageListeners.push(fn);
      },
      removeListener: (fn: MessageCallback) => {
        const idx = messageListeners.indexOf(fn);
        if (idx !== -1) messageListeners.splice(idx, 1);
      },
      listeners: messageListeners,
    },
    sendMessage: (msg: any, callback?: (res: any) => void) => {
      let handled = false;
      for (const listener of [...messageListeners]) {
        const isAsync = listener(msg, { id: 'mock-tab' }, (response: any) => {
          if (callback) callback(response);
        });
        if (isAsync) handled = true;
      }
      if (!handled && callback) {
        callback({ success: true, data: {} });
      }
    },
    onInstalled: {
      addListener: () => {},
    },
  },
  tabs: {
    query: async () => [{ id: 101, url: 'https://example.com/test', title: 'Test Target' }],
    get: async (id: number) => ({ id, url: 'https://example.com/test', title: 'Test Target' }),
    sendMessage: (_tabId: number, msg: any, callback?: (res: any) => void) => {
      if (callback) {
        if (msg?.type === 'SCAN_PAGE_DISCOVERY') {
          callback({
            success: true,
            data: {
              snapshot: {
                url: 'https://example.com/test',
                origin: 'https://example.com',
                pathname: '/test',
                title: 'Test Target',
                metadata: {
                  title: 'Test Target',
                  h1Count: 1,
                  h1Texts: ['Test Title'],
                  headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
                },
                links: [],
                buttons: [],
                forms: [],
                images: [],
                navigations: [],
                totalInteractiveCount: 0,
                timestamp: Date.now(),
              },
            },
          });
        } else if (msg?.type === 'HIGHLIGHT_ELEMENT') {
          callback({
            success: true,
            data: {
              highlighted: true,
              rect: { x: 100, y: 150, width: 200, height: 50 },
            },
          });
        } else if (msg?.type === 'GET_RUNTIME_OBSERVER_DATA') {
          callback({
            success: true,
            data: {
              consoleErrors: [],
              networkFailures: [],
            },
          });
        } else if (msg?.type === 'CLEAR_HIGHLIGHTS') {
          callback({ success: true, data: { cleared: true } });
        } else {
          callback({ success: true, data: { ready: true } });
        }
      }
    },
    captureVisibleTab: async (_options?: any, callback?: (data: string) => void) => {
      const data = 'data:image/jpeg;base64,mockTabScreenshotData';
      if (typeof callback === 'function') {
        callback(data);
      }
      return data;
    },
    onActivated: { addListener: () => {} },
    onUpdated: { addListener: () => {}, removeListener: () => {} },
    update: async (tabId: number, props: any) => ({ id: tabId, ...props }),
  },
  sidePanel: {
    setPanelBehavior: async () => {},
    open: async () => {},
  },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {},
    },
  },
  scripting: {
    executeScript: async () => [{ result: true }],
  },
};
