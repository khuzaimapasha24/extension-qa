import { createLogger } from '../shared/logger/logger';

const logger = createLogger('MutationTracker');

export interface MutationSnapshot {
  domMutationsCount: number;
  modalDetected: boolean;
  toastAlertDetected: boolean;
  alertType?: 'error' | 'success' | 'warning' | 'info';
  alertMessage?: string;
}

export class MutationTracker {
  private observer: MutationObserver | null = null;
  private mutationsCount: number = 0;
  private isActive: boolean = false;
  private modalSelectors = [
    'dialog[open]',
    '[role="dialog"]',
    '[aria-modal="true"]',
    '.modal.show',
    '.modal[style*="display: block"]',
    '.chakra-modal__content',
    '.MuiDialog-root',
    '.ant-modal',
  ];
  private alertSelectors = [
    '[role="alert"]',
    '[role="status"]',
    '.toast',
    '.alert',
    '.alert-danger',
    '.alert-success',
    '.alert-warning',
    '.notification',
    '.ant-message-notice',
    '.toaster',
  ];

  public start(targetNode: Node = document.body || document.documentElement): void {
    if (this.isActive || typeof MutationObserver === 'undefined') return;

    try {
      this.observer = new MutationObserver((mutations) => {
        this.mutationsCount += mutations.length;
      });

      this.observer.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      this.isActive = true;
      logger.info('MutationTracker started');
    } catch (err) {
      logger.error('Failed to start MutationTracker', err);
    }
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isActive = false;
  }

  public resetBaseline(): void {
    this.mutationsCount = 0;
  }

  public getObservationSnapshot(doc: Document = document): MutationSnapshot {
    const modalDetected = this.detectModal(doc);
    const alertInfo = this.detectAlert(doc);

    return {
      domMutationsCount: this.mutationsCount,
      modalDetected,
      toastAlertDetected: alertInfo.detected,
      alertType: alertInfo.type,
      alertMessage: alertInfo.message,
    };
  }

  private detectModal(doc: Document): boolean {
    for (const sel of this.modalSelectors) {
      const el = doc.querySelector(sel);
      if (el) {
        // Ensure element is visible
        const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if (!style || (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0')) {
          return true;
        }
      }
    }
    return false;
  }

  private detectAlert(doc: Document): {
    detected: boolean;
    type?: 'error' | 'success' | 'warning' | 'info';
    message?: string;
  } {
    for (const sel of this.alertSelectors) {
      const elements = doc.querySelectorAll(sel);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
          continue;
        }

        const text = (el.textContent || '').trim();
        if (!text) continue;

        // Classify alert type
        const textLower = text.toLowerCase();
        const className = (el.className || '').toString().toLowerCase();

        let type: 'error' | 'success' | 'warning' | 'info' = 'info';
        if (
          className.includes('danger') ||
          className.includes('error') ||
          className.includes('fail') ||
          textLower.includes('error') ||
          textLower.includes('failed') ||
          textLower.includes('invalid')
        ) {
          type = 'error';
        } else if (
          className.includes('success') ||
          textLower.includes('success') ||
          textLower.includes('saved') ||
          textLower.includes('completed')
        ) {
          type = 'success';
        } else if (className.includes('warn') || textLower.includes('warning')) {
          type = 'warning';
        }

        return {
          detected: true,
          type,
          message: text.substring(0, 300),
        };
      }
    }

    return { detected: false };
  }
}

export const mutationTracker = new MutationTracker();
