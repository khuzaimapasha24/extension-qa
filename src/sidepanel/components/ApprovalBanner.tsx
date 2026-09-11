import React from 'react';
import { AlertTriangle, ShieldCheck, XCircle } from 'lucide-react';
import { TestTask } from '../../shared/types/agent';

interface ApprovalBannerProps {
  task: TestTask;
  onApprove: (task: TestTask) => void;
  onReject: (task: TestTask) => void;
}

export const ApprovalBanner: React.FC<ApprovalBannerProps> = ({ task, onApprove, onReject }) => {
  return (
    <div
      style={{
        background: 'rgba(218, 54, 51, 0.08)',
        border: '1px solid rgba(218, 54, 51, 0.35)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        marginBottom: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <AlertTriangle size={16} color="var(--color-critical-text)" />
        <strong style={{ fontSize: '12px', color: 'var(--color-critical-text)' }}>
          High-Risk Action Confirmation Required
        </strong>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-primary)', margin: '0 0 6px 0', lineHeight: 1.4 }}>
        The QA agent is attempting an action classified as <strong>HIGH RISK</strong>:
      </p>

      <div
        style={{
          background: 'var(--bg-surface-elevated)',
          padding: '6px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          marginBottom: '10px',
        }}
      >
        <div><strong>Task:</strong> {task.title}</div>
        <div><strong>Target:</strong> {task.targetSelector}</div>
        <div><strong>Action:</strong> {task.type}</div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1, fontSize: '11px', padding: '5px 8px', background: 'var(--color-critical)' }}
          onClick={() => onApprove({ ...task, approvedByUser: true })}
        >
          <ShieldCheck size={13} /> Approve Once
        </button>
        <button
          className="btn btn-secondary"
          style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }}
          onClick={() => onReject(task)}
        >
          <XCircle size={13} /> Skip Action
        </button>
      </div>
    </div>
  );
};
