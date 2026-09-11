import React, { useState, useMemo } from 'react';
import { Finding, FindingSeverity, ScreenshotEvidence, ConsoleErrorEvidence, NetworkErrorEvidence, DOMSnippetEvidence } from '../../shared/types/qa';
import { CheckCircle2, ChevronRight, ChevronDown, Crosshair, Image as ImageIcon, Terminal, Network, Code, Copy, Check, Filter } from 'lucide-react';
import { sendToBackground } from '../../shared/messaging/bus';
import { ImageModal } from './ImageModal';

interface FindingsViewProps {
  findings: Finding[];
}

export const FindingsView: React.FC<FindingsViewProps> = ({ findings }) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedPage, setSelectedPage] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<{ src: string; title: string } | null>(null);
  const [highlightedSelector, setHighlightedSelector] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Compute severity counts
  const counts = useMemo(() => ({
    ALL: findings.length,
    CRITICAL: findings.filter((f) => f.severity === 'CRITICAL').length,
    HIGH: findings.filter((f) => f.severity === 'HIGH').length,
    MEDIUM: findings.filter((f) => f.severity === 'MEDIUM').length,
    LOW: findings.filter((f) => f.severity === 'LOW').length,
  }), [findings]);

  // Unique pages crawled
  const uniquePages = useMemo(() => {
    const set = new Set<string>();
    findings.forEach((f) => {
      if (f.page) set.add(f.page);
    });
    return Array.from(set);
  }, [findings]);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      const matchSeverity = selectedSeverity === 'ALL' || f.severity === selectedSeverity;
      const matchPage = selectedPage === 'ALL' || f.page === selectedPage;
      return matchSeverity && matchPage;
    });
  }, [findings, selectedSeverity, selectedPage]);

  const getSeverityBadge = (severity: FindingSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="badge" style={{ backgroundColor: 'var(--color-critical-subtle)', color: 'var(--color-critical-text)' }}>CRITICAL</span>;
      case 'HIGH':
        return <span className="badge" style={{ backgroundColor: 'rgba(255,123,114,0.15)', color: 'var(--color-high-text)' }}>HIGH</span>;
      case 'MEDIUM':
        return <span className="badge" style={{ backgroundColor: 'var(--color-warning-subtle)', color: 'var(--color-warning-text)' }}>MEDIUM</span>;
      case 'LOW':
        return <span className="badge" style={{ backgroundColor: 'rgba(139,148,158,0.15)', color: 'var(--color-low-text)' }}>LOW</span>;
      default:
        return <span className="badge">{severity}</span>;
    }
  };

  const handleHighlight = async (e: React.MouseEvent, selector: string, label: string) => {
    e.stopPropagation();
    try {
      setHighlightedSelector(selector);
      await sendToBackground('HIGHLIGHT_ELEMENT', {
        selector,
        label,
        durationMs: 5000,
      });
      setTimeout(() => setHighlightedSelector(null), 5000);
    } catch {
      setHighlightedSelector(null);
    }
  };

  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="findings-container">
      {/* Sticky / Fixed Severity Filter Header */}
      <div className="findings-filter-header">
        <div className="findings-filter-pills">
          {([
            { id: 'ALL', label: 'All', count: counts.ALL, colorVar: undefined },
            { id: 'CRITICAL', label: 'Critical', count: counts.CRITICAL, colorVar: 'var(--color-critical-text)' },
            { id: 'HIGH', label: 'High', count: counts.HIGH, colorVar: 'var(--color-high-text)' },
            { id: 'MEDIUM', label: 'Medium', count: counts.MEDIUM, colorVar: 'var(--color-medium-text)' },
            { id: 'LOW', label: 'Low', count: counts.LOW, colorVar: 'var(--color-low-text)' },
          ] as const).map(({ id, label, count, colorVar }) => {
            const isSelected = selectedSeverity === id;
            return (
              <button
                key={id}
                className={`severity-pill ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedSeverity(id)}
                title={`Filter by ${label} (${count})`}
              >
                <span>{label}</span>
                <span
                  className="severity-pill-count"
                  style={{ color: !isSelected && colorVar && count > 0 ? colorVar : undefined }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Multi-Page Selector Filter if issues span across multiple pages */}
        {uniquePages.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
            <Filter size={11} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Page:</span>
            <select
              value={selectedPage}
              onChange={(e) => setSelectedPage(e.target.value)}
              style={{
                flex: 1,
                padding: '3px 6px',
                fontSize: '11px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                outline: 'none',
              }}
            >
              <option value="ALL">All Pages ({uniquePages.length})</option>
              {uniquePages.map((pg) => (
                <option key={pg} value={pg}>{pg}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Scrollable Findings List */}
      <div className="findings-scroll-list">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={32} color="var(--color-success-text)" style={{ marginBottom: '8px' }} />
            <p style={{ fontWeight: 500 }}>No issues found</p>
            <p style={{ fontSize: '11px', marginTop: '4px' }}>
              {selectedSeverity === 'ALL'
                ? 'Run Full QA to detect broken buttons, missing alt tags, console errors, and UX issues.'
                : `No ${selectedSeverity.toLowerCase()} findings recorded.`}
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const isExpanded = expandedId === item.id;
            const screenshotEvidence = item.evidence.find((e) => e.type === 'screenshot');
            const consoleEvidence = item.evidence.find((e) => e.type === 'console_error');
            const networkEvidence = item.evidence.find((e) => e.type === 'network_error');
            const domSnippetEvidence = item.evidence.find((e) => e.type === 'dom_snippet');

            const screenshotData = screenshotEvidence?.data as ScreenshotEvidence | undefined;
            const consoleData = consoleEvidence?.data as ConsoleErrorEvidence | undefined;
            const networkData = networkEvidence?.data as NetworkErrorEvidence | undefined;
            const domSnippetData = domSnippetEvidence?.data as DOMSnippetEvidence | undefined;

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: isExpanded ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getSeverityBadge(item.severity)}
                    <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                      {item.title}
                    </span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Page: {item.page}
                </div>

                {isExpanded && (
                  <div
                    style={{
                      marginTop: '8px',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      fontSize: '11px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-secondary)' }}>Description:</strong> {item.description}
                    </div>

                    {item.selector && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                          <strong style={{ color: 'var(--text-secondary)' }}>Selector:</strong>
                          <code style={{ fontSize: '10px' }}>{item.selector}</code>
                        </div>
                        <button
                          className={`btn ${highlightedSelector === item.selector ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '3px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={(e) => handleHighlight(e, item.selector!, item.title)}
                          title="Scroll into view and highlight on active tab"
                        >
                          <Crosshair size={12} />
                          <span>{highlightedSelector === item.selector ? 'Highlighted' : 'Highlight on Page'}</span>
                        </button>
                      </div>
                    )}

                    <div>
                      <strong style={{ color: 'var(--text-secondary)' }}>Expected:</strong> {item.expected}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-secondary)' }}>Actual:</strong> {item.actual}
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
                      <strong style={{ color: 'var(--color-primary)' }}>Recommendation:</strong> {item.recommendation}
                    </div>

                    {/* Multi-Modal Evidence Section */}
                    {item.evidence.length > 0 && (
                      <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Evidence & Visual Proof</span>
                        </div>

                        {/* Screenshot Evidence */}
                        {screenshotData && screenshotData.dataUrl && (
                          <div
                            style={{
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px',
                              backgroundColor: 'var(--bg-surface-elevated)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <ImageIcon size={11} />
                                {screenshotData.isElementCrop ? 'Element Screenshot Crop' : 'Page Viewport Capture'}
                              </span>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                {screenshotData.width}x{screenshotData.height}px
                              </span>
                            </div>
                            <img
                              src={screenshotData.dataUrl}
                              alt="Finding evidence"
                              style={{
                                width: '100%',
                                maxHeight: '160px',
                                objectFit: 'contain',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'zoom-in',
                                border: '1px solid var(--border-subtle)',
                                backgroundColor: '#0a0c10',
                              }}
                              onClick={() => setModalImage({ src: screenshotData.dataUrl, title: item.title })}
                            />
                          </div>
                        )}

                        {/* Console Error Evidence */}
                        {consoleData && (
                          <div
                            style={{
                              border: '1px solid rgba(248, 81, 73, 0.4)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 8px',
                              backgroundColor: 'rgba(248, 81, 73, 0.08)',
                              fontFamily: 'monospace',
                              fontSize: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-critical-text)', fontWeight: 600 }}>
                              <Terminal size={12} />
                              <span>{consoleData.message}</span>
                            </div>
                            {consoleData.source && (
                              <div style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                                Source: {consoleData.source}:{consoleData.lineno}:{consoleData.colno}
                              </div>
                            )}
                            {consoleData.stack && (
                              <pre style={{ marginTop: '4px', whiteSpace: 'pre-wrap', maxHeight: '80px', overflowY: 'auto', fontSize: '9px', color: 'var(--text-secondary)' }}>
                                {consoleData.stack}
                              </pre>
                            )}
                          </div>
                        )}

                        {/* Network Error Evidence */}
                        {networkData && (
                          <div
                            style={{
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 8px',
                              backgroundColor: 'var(--bg-surface-elevated)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                              <Network size={12} color="var(--color-warning-text)" />
                              <span className="badge" style={{ backgroundColor: 'rgba(255,123,114,0.2)', color: 'var(--color-critical-text)', fontSize: '9px' }}>
                                {networkData.status}
                              </span>
                              <span style={{ fontWeight: 600 }}>{networkData.method}</span>
                              <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                                {networkData.url}
                              </span>
                            </div>
                            {networkData.duration !== undefined && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                                {networkData.duration}ms
                              </span>
                            )}
                          </div>
                        )}

                        {/* DOM Snippet Evidence */}
                        {domSnippetData && domSnippetData.outerHTML && (
                          <div
                            style={{
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 8px',
                              backgroundColor: 'var(--bg-surface-elevated)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Code size={11} />
                                DOM Snippet
                              </span>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '2px 4px', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '2px' }}
                                onClick={(e) => handleCopy(e, domSnippetData.outerHTML, `dom_${item.id}`)}
                              >
                                {copiedId === `dom_${item.id}` ? <Check size={10} color="var(--color-success-text)" /> : <Copy size={10} />}
                                <span>{copiedId === `dom_${item.id}` ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                            <pre style={{ margin: 0, padding: '4px', backgroundColor: '#0d1117', borderRadius: '3px', fontSize: '9px', color: '#c9d1d9', overflowX: 'auto' }}>
                              {domSnippetData.outerHTML}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Enlarged Screenshot Modal */}
      {modalImage && (
        <ImageModal
          isOpen={Boolean(modalImage)}
          src={modalImage.src}
          title={modalImage.title}
          onClose={() => setModalImage(null)}
        />
      )}
    </div>
  );
};
