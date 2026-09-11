import { describe, it, expect } from 'vitest';
import { sendToBackground, sendToTab } from '../../src/shared/messaging/bus';

describe('MessageBus', () => {
  it('sends message to background and receives response', async () => {
    // Chrome runtime mock sends back success
    const result = await sendToBackground('PING', {});
    expect(result).toBeDefined();
  });

  it('sends message to tab and receives response', async () => {
    const result = await sendToTab(101, 'CONTENT_SCRIPT_PING', {});
    expect(result).toBeDefined();
    expect(result.ready).toBe(true);
  });
});
