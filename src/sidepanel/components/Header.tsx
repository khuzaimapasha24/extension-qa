import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { AgentState } from '../../shared/types/agent';

interface HeaderProps {
  state: AgentState;
  privacyMode: boolean;
}

export const Header: React.FC<HeaderProps> = ({ state, privacyMode }) => {
  const isRunning = state !== 'IDLE' && state !== 'COMPLETED' && state !== 'ERROR';

  return (
    <header className="panel-header">
      <div className="header-title-row">
        <span className="logo-badge">QA</span>
        <h1 className="app-title">AI Website QA</h1>
      </div>
      <div className="header-badges">
        {privacyMode && (
          <span className="badge badge-privacy" title="Privacy Mode is active. All data remains in local IndexedDB.">
            <ShieldCheck size={12} />
            Privacy
          </span>
        )}
        <span className="badge badge-state">
          <span className={`state-dot ${isRunning ? 'running' : ''}`} />
          {state}
        </span>
      </div>
    </header>
  );
};
