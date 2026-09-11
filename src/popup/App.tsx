import React from 'react';
import { PanelRight } from 'lucide-react';
import '../sidepanel/styles/tokens.css';

export const App: React.FC = () => {
  const handleOpenSidePanel = async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.sidePanel.open({ tabId: tab.id });
          window.close();
        }
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div
      style={{
        width: '280px',
        padding: '16px',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span
          style={{
            background: 'linear-gradient(135deg, #2f81f7, #a371f7)',
            color: 'white',
            fontWeight: 700,
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          QA
        </span>
        <strong style={{ fontSize: '14px' }}>AI Website QA Agent</strong>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px', lineHeight: 1.4 }}>
        Run autonomous link, form, button, responsive, performance, and accessibility QA on any open webpage.
      </p>

      <button
        onClick={handleOpenSidePanel}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: 'var(--color-primary)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <PanelRight size={16} />
        Open QA Side Panel
      </button>
    </div>
  );
};
