import React from 'react';
import { Pause, Play, Square, FileCode, CheckCircle2, Bot, RefreshCw, Zap, Sparkles, Eye, ArrowLeftRight } from 'lucide-react';
import { QASession } from '../../shared/types/session';
import { AgentState } from '../../shared/types/agent';
import { WebsiteDiscoveryMap } from '../../shared/types/discovery';

interface LiveRunnerViewProps {
  session: QASession | null;
  discoveryMap: WebsiteDiscoveryMap | null;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onStopSession: () => void;
}

const ALL_STATES: AgentState[] = [
  'INITIALIZING',
  'DISCOVERING',
  'ANALYZING',
  'PLANNING',
  'EXECUTING',
  'OBSERVING',
  'REASONING',
  'VERIFYING',
  'REPORTING',
  'COMPLETED',
];

export const LiveRunnerView: React.FC<LiveRunnerViewProps> = ({
  session,
  discoveryMap,
  onPauseSession,
  onResumeSession,
  onStopSession,
}) => {
  if (!session) {
    return (
      <div className="panel-content" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <Bot size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <p style={{ color: 'var(--text-muted)' }}>No active QA session running.</p>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Switch to Dashboard and click "Start Full QA" to begin autonomous testing.
        </p>
      </div>
    );
  }

  const isRunning = session.state !== 'IDLE' && session.state !== 'COMPLETED' && session.state !== 'ERROR';
  const isPaused = session.currentAction.toLowerCase().includes('paused');
  const isInteractivePhase = ['PLANNING', 'EXECUTING', 'OBSERVING', 'REASONING', 'VERIFYING'].includes(session.state);

  const ai = session.config?.ai;
  const isGeminiActive = Boolean(ai?.geminiApiKey && ai.geminiApiKey.trim().length > 5);
  const isOpenAIActive = Boolean(ai?.openaiApiKey && ai.openaiApiKey.trim().length > 5);
  const isAnthropicActive = Boolean(ai?.anthropicApiKey && ai.anthropicApiKey.trim().length > 5);

  let activeAiName = 'Local WebGPU AI Brain';
  let activeAiColor = '#a855f7';
  if (isGeminiActive) {
    activeAiName = `Google Gemini ${ai?.geminiModel || '3.6 Flash'} Active`;
    activeAiColor = '#38bdf8';
  } else if (isOpenAIActive) {
    activeAiName = `OpenAI ${ai?.openaiModel || 'GPT-4o'} Active`;
    activeAiColor = '#10b981';
  } else if (isAnthropicActive) {
    activeAiName = `Anthropic ${ai?.anthropicModel || 'Claude 3.5'} Active`;
    activeAiColor = '#f59e0b';
  }

  return (
    <div className="panel-content">
      {/* Active AI Intelligence Engine Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${activeAiColor}15 0%, rgba(15, 23, 42, 0.6) 100%)`,
          border: `1px solid ${activeAiColor}40`,
          borderRadius: 'var(--radius-md)',
          padding: '8px 12px',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color={activeAiColor} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: activeAiColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{activeAiName}</span>
              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {isGeminiActive ? 'Live Cloud AI • Deep UX, Risk & Business Logic Reasoning' : 'Autonomous AI QA Evaluation'}
            </div>
          </div>
        </div>
        <span className="badge" style={{ background: `${activeAiColor}25`, color: activeAiColor, fontSize: '9px', fontWeight: 700 }}>
          {isGeminiActive || isOpenAIActive || isAnthropicActive ? 'CLOUD LLM' : 'WEBGPU'}
        </span>
      </div>

      {/* Progress and Current Action */}
      <div className="progress-container">
        <div className="progress-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} color="var(--color-primary)" />
            Agent Progress
          </span>
          <span style={{ fontWeight: 700 }}>{session.progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${session.progress}%` }} />
        </div>
      </div>

      {/* Live action text */}
      <div className="current-action-text" style={{ borderLeft: '3px solid var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isRunning && !isPaused && <RefreshCw size={13} className="spin" style={{ flexShrink: 0 }} />}
        <span>{session.currentAction || 'Agent awaiting next action...'}</span>
      </div>

      {/* Jarvis Vision Eye & Multimodal Visual Stream */}
      {session.jarvisVision && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Eye size={14} color="#38bdf8" />
              JARVIS REAL-TIME VISION EYE
            </span>
            <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '9px', fontWeight: 700 }}>
              MULTIMODAL PERCEPTION
            </span>
          </div>

          {session.jarvisVision.lastScreenshotUrl && (
            <div
              style={{
                position: 'relative',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                maxHeight: '120px',
                background: '#090d16',
              }}
            >
              <img
                src={session.jarvisVision.lastScreenshotUrl}
                alt="Live Tab Screenshot"
                style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  background: 'rgba(0, 0, 0, 0.75)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  color: '#38bdf8',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
                LIVE SCREEN
              </div>
            </div>
          )}

          {session.jarvisVision.visualAnalysisText && (
            <div style={{ fontSize: '11px', color: 'var(--text-main)', lineHeight: 1.4, background: 'rgba(15, 23, 42, 0.5)', padding: '6px 8px', borderRadius: '4px' }}>
              <span style={{ fontWeight: 600, color: '#38bdf8' }}>Jarvis Thought: </span>
              {session.jarvisVision.visualAnalysisText}
            </div>
          )}

          {session.jarvisVision.detectedVisualElements && session.jarvisVision.detectedVisualElements.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {session.jarvisVision.detectedVisualElements.slice(0, 5).map((el, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '9px',
                    padding: '2px 6px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#bae6fd',
                    borderRadius: '4px',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                  }}
                >
                  {el}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Autonomous Loop Live Card */}
      {isInteractivePhase && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Bot size={13} />
              AUTONOMOUS FEEDBACK LOOP
            </span>
            <span className="badge badge-privacy" style={{ fontSize: '9px', textTransform: 'uppercase' }}>
              {session.state}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Active Task: <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{session.currentAction.split('] ')[1] || session.currentAction}</span>
          </div>
        </div>
      )}

      {/* State Machine Visualizer */}
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>AGENT STATE PIPELINE</div>
      <div className="state-visualizer">
        {ALL_STATES.map((st) => {
          const isActive = session.state === st;
          const currentIndex = ALL_STATES.indexOf(session.state);
          const stIndex = ALL_STATES.indexOf(st);
          const isDone = currentIndex > stIndex;

          return (
            <span
              key={st}
              className={`state-chip ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}
            >
              {isDone ? '✓ ' : ''}
              {st}
            </span>
          );
        })}
      </div>

      {/* Live Counters */}
      <div className="stats-grid">
        <div className="stat-box">
          <span className="stat-label">Pages</span>
          <span className="stat-value stat-total">{session.stats.pagesCrawled || 1}/{session.stats.pagesDiscovered || 1}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Interactive</span>
          <span className="stat-value stat-total">{session.stats.elementsDiscovered}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Passed</span>
          <span className="stat-value stat-pass">{session.stats.passedCount}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Defects</span>
          <span className="stat-value stat-fail">{session.stats.failedCount}</span>
        </div>
      </div>

      {/* Discovered Pages Sitemap List */}
      {discoveryMap && discoveryMap.pages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
            DISCOVERED PAGES ({discoveryMap.pages.length + discoveryMap.queue.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
            {discoveryMap.pages.map((p) => (
              <div
                key={p.url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-surface)',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <FileCode size={12} color="var(--color-primary)" />
                  <span style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.pathname || '/'}
                  </span>
                </div>
                <span className="badge badge-privacy" style={{ fontSize: '9px', padding: '1px 6px' }}>
                  <CheckCircle2 size={10} /> Scanned
                </span>
              </div>
            ))}
            {discoveryMap.queue.map((qUrl) => {
              let path = qUrl;
              try {
                path = new URL(qUrl).pathname;
              } catch {}
              return (
                <div
                  key={qUrl}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-surface-elevated)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border-subtle)',
                    fontSize: '11px',
                    opacity: 0.75,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <FileCode size={12} color="var(--text-muted)" />
                    <span style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {path}
                    </span>
                  </div>
                  <span className="badge" style={{ fontSize: '9px', padding: '1px 6px' }}>
                    Queued
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live In-Page API & Data Flow Inspector */}
      {session.liveTransactions && session.liveTransactions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ArrowLeftRight size={12} color="var(--color-primary)" />
              LIVE DATA FLOW & NETWORK INSPECTOR ({session.liveTransactions.length})
            </span>
            <span className="badge badge-privacy" style={{ fontSize: '9px' }}>
              REAL-TIME INTERCEPTED
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
            {session.liveTransactions.slice(-6).reverse().map((tx) => {
              let endpoint = tx.url;
              try {
                const u = new URL(tx.url);
                endpoint = u.pathname + (u.search ? u.search.slice(0, 15) : '');
              } catch {}

              const isSuccess = tx.status >= 200 && tx.status < 300;
              const isError = tx.status >= 400 || tx.status === 0;
              const statusColor = isSuccess ? '#10b981' : isError ? '#ef4444' : '#f59e0b';
              const methodBg = tx.isMutation ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)';
              const methodColor = tx.isMutation ? '#c084fc' : '#60a5fa';

              return (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    background: 'var(--bg-surface)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: methodBg,
                          color: methodColor,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {tx.method}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-main)',
                        }}
                        title={tx.url}
                      >
                        {endpoint}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{tx.durationMs}ms</span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: statusColor,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {tx.status || 'ERR'}
                      </span>
                    </div>
                  </div>

                  {tx.requestPayload && (
                    <div
                      style={{
                        fontSize: '9px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Sent: {typeof tx.requestPayload === 'object' ? JSON.stringify(tx.requestPayload) : String(tx.requestPayload)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      {isRunning && (
        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
          {isPaused ? (
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onResumeSession}>
              <Play size={14} /> Resume
            </button>
          ) : (
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onPauseSession}>
              <Pause size={14} /> Pause
            </button>
          )}
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={onStopSession}>
            <Square size={14} /> Stop
          </button>
        </div>
      )}
    </div>
  );
};
