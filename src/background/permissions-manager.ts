export function isInspectableUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'devtools:', 'view-source:'];
    if (restrictedProtocols.includes(parsed.protocol)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function getTabOrigin(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/**
 * Robustly queries the browser's active tab, prioritizing the last focused window
 * (crucial for Chrome Side Panels which run in their own window context).
 */
export async function getActiveInspectableTab(): Promise<chrome.tabs.Tab | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
    return null;
  }

  // 1. Prioritize inspectable active tab in last focused window (main browser window)
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const inspectable = tabs?.find((t) => t.id && isInspectableUrl(t.url));
    if (inspectable) {
      return inspectable;
    }
  } catch {}

  // 2. Fallback to current window
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const inspectable = tabs?.find((t) => t.id && isInspectableUrl(t.url));
    if (inspectable) {
      return inspectable;
    }
    if (tabs && tabs.length > 0 && tabs[0]?.id) {
      return tabs[0];
    }
  } catch {}

  // 3. Fallback to inspectable active tab across any window
  try {
    const tabs = await chrome.tabs.query({ active: true });
    const inspectable = tabs.find((t) => t.id && isInspectableUrl(t.url));
    if (inspectable) {
      return inspectable;
    }
  } catch {}

  // 4. Fallback to any tab across the last focused window that is inspectable
  try {
    const allWindowTabs = await chrome.tabs.query({ lastFocusedWindow: true });
    const inspectable = allWindowTabs.find((t) => t.id && isInspectableUrl(t.url));
    if (inspectable) {
      return inspectable;
    }
  } catch {}

  // 5. Fallback to any active tab (even if restricted, so UI can display proper warning)
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs && tabs.length > 0 && tabs[0]?.id) {
      return tabs[0];
    }
    const anyActive = await chrome.tabs.query({ active: true });
    if (anyActive && anyActive.length > 0 && anyActive[0]?.id) {
      return anyActive[0];
    }
  } catch {}

  return null;
}

