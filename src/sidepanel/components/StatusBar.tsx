import React from 'react';

interface StatusBarProps {
  tabId: number | null;
  status: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ tabId, status }) => {
  return (
    <footer className="panel-status-bar">
      <span>Tab #{tabId ?? 'none'}</span>
      <span>{status}</span>
    </footer>
  );
};
