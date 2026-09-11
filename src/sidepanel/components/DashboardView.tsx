import React from 'react';
import { Play, Globe, Layers, Link as LinkIcon, MousePointerClick, FileText, Image as ImageIcon, RefreshCw, AlertTriangle, Compass } from 'lucide-react';
import { QASession } from '../../shared/types/session';
import { WebsiteDiscoveryMap } from '../../shared/types/discovery';
import { WebsiteFlowAnalysis } from '../../reporting/report-types';

interface DashboardViewProps {
  currentTabUrl: string;
  currentTabTitle: string;
  session: QASession | null;
  discoveryMap: WebsiteDiscoveryMap | null;
  flowAnalysis?: WebsiteFlowAnalysis | null;
  onStartQA: () => void;
  onRefreshTab?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentTabUrl,
  currentTabTitle,
  session,
  discoveryMap,
  flowAnalysis,
  onStartQA,
  onRefreshTab,
}) => {
  const isRunning = session && session.state !== 'IDLE' && session.state !== 'COMPLETED' && session.state !== 'ERROR';

  const isRestrictedUrl = Boolean(
    currentTabUrl &&
    (currentTabUrl.startsWith('chrome://') ||
      currentTabUrl.startsWith('chrome-extension://') ||
      currentTabUrl.startsWith('edge://') ||
      currentTabUrl.startsWith('about:') ||
      currentTabUrl.startsWith('devtools://'))
  );

  return (
    <div className="panel-content">
      {/* Target Webpage Info Card */}
      <div className="target-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={14} color="var(--color-primary)" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>TARGET PAGE</span>
          </div>
          {onRefreshTab && (
            <button
              onClick={onRefreshTab}
              className="btn btn-ghost"
              style={{ padding: '2px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', height: 'auto' }}
              title="Re-detect active browser tab"
            >
              <RefreshCw size={11} /> Detect Tab
            </button>
          )}
        </div>
        <div className="target-url" title={currentTabUrl}>
          {currentTabUrl || 'Detecting active tab...'}
        </div>
        <div className="target-title" title={currentTabTitle}>
          {currentTabTitle || 'Navigate to any webpage or click Detect Tab to inspect'}
        </div>

        {isRestrictedUrl && (
          <div style={{ marginTop: '8px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-sm)', padding: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertTriangle size={14} color="var(--color-warning-text)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '11px', color: 'var(--color-warning-text)', lineHeight: '1.4' }}>
              <strong>Browser internal page detected.</strong> Extensions cannot inspect internal pages. Please switch to an external website (e.g. google.com, an e-commerce site, or your local web app at localhost:3000) and click <strong>Detect Tab</strong>.
            </div>
          </div>
        )}
      </div>

      {/* Start Full QA CTA */}
      <button
        className="btn btn-primary btn-block"
        onClick={onStartQA}
        disabled={isRunning || !currentTabUrl || isRestrictedUrl}
      >
        <Play size={15} fill="currentColor" />
        {isRunning
          ? 'QA In Progress...'
          : isRestrictedUrl
          ? 'Switch to a valid webpage'
          : !currentTabUrl
          ? 'Detecting webpage...'
          : 'Start Full QA'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', marginTop: '-4px' }}>
        <span style={{ color: 'var(--color-low)' }}>●</span>
        <span>Human-Grade QA: Explores all tabs, fills forms & enters realistic data</span>
      </div>

      {/* Website Flow & UX Journey Critique Summary Card */}
      {flowAnalysis && (
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
              <Compass size={13} color="var(--color-purple)" />
              <span>WEBSITE FLOW & UX CRITIQUE</span>
            </div>
            <span
              className="badge"
              style={{
                fontSize: '9px',
                background: flowAnalysis.flowRating === 'EXCELLENT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                color: flowAnalysis.flowRating === 'EXCELLENT' ? 'var(--color-low)' : '#38bdf8',
              }}
            >
              {flowAnalysis.flowRating} ({flowAnalysis.flowScore}/100)
            </span>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: '1.4' }}>
            <strong>Intent:</strong> {flowAnalysis.pageIntent}
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            {flowAnalysis.summary}
          </div>

          {flowAnalysis.recommendations && flowAnalysis.recommendations.length > 0 && (
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: '11px', color: '#bae6fd' }}>
              <strong>Top Flow Recommendation:</strong> {flowAnalysis.recommendations[0].suggestedImprovement}
            </div>
          )}
        </div>
      )}

      {/* Discovered Inventory Summary (Phase 2) */}
      {discoveryMap && (
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
            <Layers size={13} color="var(--color-primary)" />
            <span>DISCOVERED INVENTORY</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            <div style={{ textAlign: 'center', background: 'var(--bg-surface-elevated)', padding: '6px 4px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--color-primary)', display: 'flex', justifyContent: 'center', marginBottom: '2px' }}><LinkIcon size={12} /></div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{discoveryMap.totalInternalLinks}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Links</div>
            </div>
            <div style={{ textAlign: 'center', background: 'var(--bg-surface-elevated)', padding: '6px 4px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--color-purple)', display: 'center', justifyContent: 'center', marginBottom: '2px' }}><MousePointerClick size={12} /></div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{discoveryMap.totalButtons}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Buttons</div>
            </div>
            <div style={{ textAlign: 'center', background: 'var(--bg-surface-elevated)', padding: '6px 4px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--color-warning-text)', display: 'flex', justifyContent: 'center', marginBottom: '2px' }}><FileText size={12} /></div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{discoveryMap.totalForms}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Forms</div>
            </div>
            <div style={{ textAlign: 'center', background: 'var(--bg-surface-elevated)', padding: '6px 4px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--color-success-text)', display: 'flex', justifyContent: 'center', marginBottom: '2px' }}><ImageIcon size={12} /></div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{discoveryMap.totalImages}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Images</div>
            </div>
          </div>
        </div>
      )}

      {/* Score Overview Card */}
      <div className="score-card">
        <div className="score-gauge-row">
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>OVERALL QA SCORE</div>
            <div className="overall-score-display">
              {session?.stats?.criticalBugsCount ? (
                <span style={{ color: 'var(--color-critical-text)' }}>--</span>
              ) : (
                <span>{session ? Math.max(0, 100 - (session.stats.failedCount * 5 + session.stats.warningsCount * 2)) : '--'}</span>
              )}
              <span className="overall-score-total">/100</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {session?.endTime ? 'Last Tested' : session ? 'Running' : 'Not Tested'}
            </span>
          </div>
        </div>

        {/* Category Breakdown Bars */}
        <div className="category-bars">
          {[
            { name: 'Functional (25%)', val: 86, color: 'var(--color-primary)' },
            { name: 'UX & Clarity (20%)', val: 74, color: 'var(--color-purple)' },
            { name: 'Performance (15%)', val: 71, color: 'var(--color-success-text)' },
            { name: 'Accessibility (15%)', val: 82, color: 'var(--color-warning-text)' },
            { name: 'Responsive (15%)', val: 69, color: 'var(--color-primary-hover)' },
            { name: 'SEO & Metadata (10%)', val: 91, color: 'var(--color-success-text)' },
          ].map((cat) => (
            <div key={cat.name} className="category-bar-row">
              <div className="category-bar-label">
                <span>{cat.name}</span>
                <span>{session ? `${cat.val}%` : '--'}</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: session ? `${cat.val}%` : '0%',
                    backgroundColor: cat.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Findings Count Summary */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div className="stat-box" style={{ flex: 1, borderLeft: '3px solid var(--color-critical)' }}>
          <div className="stat-label">Critical</div>
          <div className="stat-value stat-fail">{session?.stats?.criticalBugsCount || 0}</div>
        </div>
        <div className="stat-box" style={{ flex: 1, borderLeft: '3px solid var(--color-high)' }}>
          <div className="stat-label">High</div>
          <div className="stat-value" style={{ color: 'var(--color-high-text)' }}>{session?.stats?.failedCount || 0}</div>
        </div>
        <div className="stat-box" style={{ flex: 1, borderLeft: '3px solid var(--color-warning)' }}>
          <div className="stat-label">Warnings</div>
          <div className="stat-value stat-warn">{session?.stats?.warningsCount || 0}</div>
        </div>
        <div className="stat-box" style={{ flex: 1, borderLeft: '3px solid var(--color-success)' }}>
          <div className="stat-label">Passed</div>
          <div className="stat-value stat-pass">{session?.stats?.passedCount || 0}</div>
        </div>
      </div>
    </div>
  );
};
