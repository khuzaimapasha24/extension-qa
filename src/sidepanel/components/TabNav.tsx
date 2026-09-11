import React from 'react';
import { LayoutDashboard, PlayCircle, AlertTriangle, FileText, Settings } from 'lucide-react';

export type TabId = 'dashboard' | 'runner' | 'findings' | 'report' | 'settings';

interface TabNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  findingsCount: number;
}

export const TabNav: React.FC<TabNavProps> = ({ activeTab, onSelectTab, findingsCount }) => {
  return (
    <nav className="tab-nav">
      <button
        className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onSelectTab('dashboard')}
        title="Dashboard"
      >
        <LayoutDashboard size={13} />
        <span className="tab-label">Dashboard</span>
      </button>
      <button
        className={`tab-button ${activeTab === 'runner' ? 'active' : ''}`}
        onClick={() => onSelectTab('runner')}
        title="Runner"
      >
        <PlayCircle size={13} />
        <span className="tab-label">Runner</span>
      </button>
      <button
        className={`tab-button ${activeTab === 'findings' ? 'active' : ''}`}
        onClick={() => onSelectTab('findings')}
        title={`Findings (${findingsCount})`}
      >
        <AlertTriangle size={13} />
        <span className="tab-label">Findings</span>
        {findingsCount > 0 && (
          <span className="tab-badge">{findingsCount}</span>
        )}
      </button>
      <button
        className={`tab-button ${activeTab === 'report' ? 'active' : ''}`}
        onClick={() => onSelectTab('report')}
        title="Report"
      >
        <FileText size={13} />
        <span className="tab-label">Report</span>
      </button>
      <button
        className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => onSelectTab('settings')}
        title="Settings"
      >
        <Settings size={13} />
        <span className="tab-label">Settings</span>
      </button>
    </nav>
  );
};
