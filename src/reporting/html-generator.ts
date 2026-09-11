import { QAReportData } from './report-types';
import { ScreenshotEvidence } from '../shared/types/qa';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateHtmlReport(data: QAReportData): string {
  const { metadata, summary, scores, findings } = data;

  const scoreColor =
    summary.overallScore >= 90
      ? '#10b981'
      : summary.overallScore >= 75
        ? '#f59e0b'
        : summary.overallScore >= 50
          ? '#f97316'
          : '#ef4444';

  const findingsHtml = findings
    .map((f) => {
      const sevClass = f.severity.toLowerCase();
      const screenshotEvidence = f.evidence.find((e) => e.type === 'screenshot');
      const screenshotData = screenshotEvidence?.data as ScreenshotEvidence | undefined;
      const domEvidence = f.evidence.find((e) => e.type === 'dom_snippet');
      const consoleEvidence = f.evidence.find((e) => e.type === 'console_error');
      const netEvidence = f.evidence.find((e) => e.type === 'network_error');

      return `
        <div class="finding-card severity-${sevClass}">
          <div class="finding-header">
            <div class="finding-meta">
              <span class="badge badge-${sevClass}">${escapeHtml(f.severity)}</span>
              <span class="badge badge-category">${escapeHtml(f.category)}</span>
              <span class="finding-page">${escapeHtml(f.page)}</span>
            </div>
            <h3 class="finding-title">${escapeHtml(f.title)}</h3>
          </div>
          <p class="finding-desc">${escapeHtml(f.description)}</p>

          <div class="meta-grid">
            ${f.selector ? `<div><strong>Selector:</strong> <code>${escapeHtml(f.selector)}</code></div>` : ''}
            <div><strong>Expected:</strong> ${escapeHtml(f.expected)}</div>
            <div><strong>Actual:</strong> ${escapeHtml(f.actual)}</div>
            <div><strong>Confidence:</strong> ${Math.round(f.confidence * 100)}%</div>
          </div>

          ${
            f.recommendation
              ? `<div class="remediation-box">
                  <strong>Recommended Fix:</strong>
                  <p>${escapeHtml(f.recommendation)}</p>
                </div>`
              : ''
          }

          ${
            domEvidence
              ? `<div class="code-block">
                  <div class="code-title">DOM Snippet</div>
                  <pre><code>${escapeHtml(typeof domEvidence.data === 'string' ? domEvidence.data : JSON.stringify(domEvidence.data, null, 2))}</code></pre>
                </div>`
              : ''
          }

          ${
            screenshotData && screenshotData.dataUrl
              ? `<div class="screenshot-container">
                  <div class="code-title">Visual Evidence</div>
                  <img src="${screenshotData.dataUrl}" alt="Evidence Screenshot" class="evidence-img" />
                </div>`
              : ''
          }

          ${
            consoleEvidence
              ? `<div class="code-block error-block">
                  <div class="code-title">Console Error</div>
                  <pre><code>${escapeHtml(typeof consoleEvidence.data === 'string' ? consoleEvidence.data : JSON.stringify(consoleEvidence.data, null, 2))}</code></pre>
                </div>`
              : ''
          }

          ${
            netEvidence
              ? `<div class="code-block error-block">
                  <div class="code-title">Network Failure</div>
                  <pre><code>${escapeHtml(typeof netEvidence.data === 'string' ? netEvidence.data : JSON.stringify(netEvidence.data, null, 2))}</code></pre>
                </div>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  const categoryScoresHtml = Object.entries(scores.categoryScores)
    .map(([cat, val]) => {
      const barColor = val.score >= 85 ? '#10b981' : val.score >= 60 ? '#f59e0b' : '#ef4444';
      return `
        <div class="cat-score-row">
          <div class="cat-label-row">
            <span class="cat-name">${escapeHtml(cat)}</span>
            <span class="cat-value" style="color: ${barColor}">${val.score}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${val.score}%; background: ${barColor}"></div>
          </div>
        </div>
      `;
    })
  let flowAnalysisHtml = '';
  if (data.flowAnalysis) {
    const fa = data.flowAnalysis;
    const ratingColors: Record<string, string> = {
      EXCELLENT: 'var(--color-low)',
      GOOD: '#38bdf8',
      FAIR: 'var(--color-medium)',
      NEEDS_OPTIMIZATION: 'var(--color-high)',
      CRITICAL_FRICTION: 'var(--color-critical)',
    };
    const ratingColor = ratingColors[fa.flowRating] || 'var(--text-muted)';

    const strengthsList = (fa.strengths || []).map((s) =>
      `<div style="display:flex;align-items:flex-start;gap:6px;font-size:12px;color:var(--text-main);margin-bottom:4px;">
        <span style="color:var(--color-low);">✓</span><span>${escapeHtml(s)}</span>
      </div>`
    ).join('');

    const frictionList = (fa.frictionPoints || []).map((fp) =>
      `<div style="background:var(--bg-elevated);border-left:3px solid var(--color-${fp.severity.toLowerCase()});padding:10px 12px;border-radius:4px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <strong style="font-size:12px;color:#fff;">${escapeHtml(fp.title)}</strong>
          <span class="badge badge-${fp.severity.toLowerCase()}">${escapeHtml(fp.severity)}</span>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin:0;">${escapeHtml(fp.description)}</p>
      </div>`
    ).join('');

    const recsList = (fa.recommendations || []).map((rec) =>
      `<div style="background:var(--bg-elevated);border:1px solid rgba(255,255,255,0.06);padding:12px 14px;border-radius:6px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="font-size:13px;color:var(--color-primary);">${escapeHtml(rec.title)}</strong>
          <span class="badge badge-${rec.priority === 'HIGH' ? 'high' : 'medium'}">${escapeHtml(rec.priority)} PRIORITY</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">
          <strong style="color:var(--text-main);">Current Flow Issue:</strong> ${escapeHtml(rec.currentFlowIssue)}
        </div>
        <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.2);padding:8px 10px;border-radius:4px;font-size:12px;color:#bae6fd;margin-bottom:6px;">
          <strong>Actionable Improvement:</strong> ${escapeHtml(rec.suggestedImprovement)}
        </div>
        <div style="font-size:11px;color:var(--text-muted);">
          <strong>Expected Impact:</strong> ${escapeHtml(rec.expectedImpact)}
        </div>
      </div>`
    ).join('');

    flowAnalysisHtml = `
    <section style="margin-bottom:32px;">
      <div class="section-title">
        <span>Website Flow & UX Journey Critique</span>
        <span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,0.06);color:${ratingColor};">
          ${escapeHtml(fa.flowRating)} &bull; ${fa.flowScore}/100
        </span>
      </div>

      <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:8px;padding:18px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <div>
            <span style="font-size:11px;text-transform:uppercase;color:var(--text-muted);font-weight:600;">Detected Page Intent:</span>
            <span style="font-size:12px;font-weight:700;color:var(--text-main);margin-left:6px;">${escapeHtml(fa.pageIntent)}</span>
          </div>
          <span style="font-size:11px;color:var(--text-muted);background:var(--bg-elevated);padding:3px 8px;border-radius:4px;">
            Audited by ${escapeHtml(fa.evaluatedBy)}
          </span>
        </div>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px 0;line-height:1.5;">${escapeHtml(fa.summary)}</p>

        ${strengthsList ? `
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color);">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Flow Strengths</div>
            ${strengthsList}
          </div>
        ` : ''}
      </div>

      ${frictionList ? `
        <div style="margin-bottom:20px;">
          <h3 style="font-size:14px;font-weight:700;color:var(--text-main);margin-bottom:10px;">User Journey Friction Points</h3>
          ${frictionList}
        </div>
      ` : ''}

      ${recsList ? `
        <div style="margin-bottom:20px;">
          <h3 style="font-size:14px;font-weight:700;color:var(--text-main);margin-bottom:10px;">Actionable Flow Improvement Recommendations</h3>
          ${recsList}
        </div>
      ` : ''}
    </section>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Audit Report - ${escapeHtml(metadata.title || metadata.url)}</title>
  <style>
    :root {
      --bg-base: #0d1117;
      --bg-surface: #161b22;
      --bg-elevated: #21262d;
      --border-color: #30363d;
      --text-main: #f0f6fc;
      --text-muted: #8b949e;
      --color-primary: #388bfd;
      --color-critical: #f85149;
      --color-high: #f0883e;
      --color-medium: #d29922;
      --color-low: #58a6ff;
      --color-pass: #3fb950;
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font-family);
      line-height: 1.5;
      padding: 32px 20px;
    }
    .report-container {
      max-width: 960px;
      margin: 0 auto;
    }
    header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .header-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-primary);
      margin-bottom: 8px;
    }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 8px; color: #fff; }
    .header-url { color: var(--text-muted); font-size: 14px; word-break: break-all; }
    .header-date { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

    /* Executive Score Section */
    .summary-grid {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 24px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .score-circle-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      border-right: 1px solid var(--border-color);
      padding-right: 24px;
    }
    .score-number {
      font-size: 56px;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 8px;
    }
    .score-rating {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(255,255,255,0.06);
    }
    .metrics-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .counters-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 16px;
    }
    .counter-box {
      text-align: center;
      background: var(--bg-elevated);
      padding: 10px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.04);
    }
    .counter-label { font-size: 10px; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 2px; }
    .counter-val { font-size: 20px; font-weight: 700; color: #fff; }

    /* Category progress bars */
    .cat-scores-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 20px;
    }
    .cat-score-row { display: flex; flex-direction: column; gap: 4px; }
    .cat-label-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; }
    .cat-name { color: var(--text-main); }
    .bar-track { height: 6px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 999px; transition: width 0.3s; }

    /* Findings section */
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
    .finding-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 16px;
      border-left: 4px solid var(--border-color);
    }
    .finding-card.severity-critical { border-left-color: var(--color-critical); }
    .finding-card.severity-high { border-left-color: var(--color-high); }
    .finding-card.severity-medium { border-left-color: var(--color-medium); }
    .finding-card.severity-low { border-left-color: var(--color-low); }

    .finding-header { margin-bottom: 8px; }
    .finding-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 11px; flex-wrap: wrap; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-critical { background: rgba(248,81,73,0.15); color: var(--color-critical); border: 1px solid rgba(248,81,73,0.3); }
    .badge-high { background: rgba(240,136,62,0.15); color: var(--color-high); border: 1px solid rgba(240,136,62,0.3); }
    .badge-medium { background: rgba(210,153,34,0.15); color: var(--color-medium); border: 1px solid rgba(210,153,34,0.3); }
    .badge-low { background: rgba(88,166,255,0.15); color: var(--color-low); border: 1px solid rgba(88,166,255,0.3); }
    .badge-category { background: rgba(255,255,255,0.06); color: var(--text-muted); }
    .finding-page { color: var(--text-muted); font-family: var(--font-mono); font-size: 11px; }
    .finding-title { font-size: 16px; font-weight: 600; color: #fff; }
    .finding-desc { color: var(--text-main); font-size: 13px; margin-bottom: 12px; }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px;
      font-size: 12px;
      color: var(--text-muted);
      background: var(--bg-elevated);
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .meta-grid strong { color: var(--text-main); }
    .meta-grid code { font-family: var(--font-mono); color: var(--color-low); }

    .remediation-box {
      background: rgba(56,139,253,0.08);
      border: 1px solid rgba(56,139,253,0.25);
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 12px;
      margin-bottom: 12px;
    }
    .remediation-box strong { color: var(--color-primary); display: block; margin-bottom: 4px; }

    .code-block {
      background: var(--bg-base);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 10px;
      font-size: 11px;
      margin-top: 8px;
      overflow-x: auto;
    }
    .code-title { font-size: 10px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; }
    pre { font-family: var(--font-mono); margin: 0; color: #c9d1d9; }
    .error-block { border-color: rgba(248,81,73,0.3); background: rgba(248,81,73,0.03); }

    .screenshot-container { margin-top: 10px; }
    .evidence-img { max-width: 100%; height: auto; border-radius: 6px; border: 1px solid var(--border-color); display: block; }

    footer {
      border-top: 1px solid var(--border-color);
      padding-top: 20px;
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
    }

    @media print {
      body { background: #fff; color: #111; padding: 0; font-size: 10pt; }
      .report-container { max-width: 100%; }
      .summary-grid, .finding-card, .counter-box, .meta-grid, .code-block, .remediation-box {
        background: #fff;
        border-color: #ccc;
        color: #111;
        break-inside: avoid;
      }
      .finding-title, h1, .cat-name, .meta-grid strong, .counter-val { color: #000; }
      .score-number { color: #000 !important; }
      .badge-critical { color: #d00; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <header>
      <div class="header-badge">AI Website QA Audit</div>
      <h1>${escapeHtml(metadata.title || 'Quality Audit Report')}</h1>
      <div class="header-url">${escapeHtml(metadata.url)}</div>
      <div class="header-date">
        Generated on ${escapeHtml(metadata.formattedDate)} &bull; Engine v${escapeHtml(metadata.engineVersion)} &bull;
        <strong>${summary.testsExecuted}</strong> Tests Executed &bull; <strong>${summary.pagesScanned}</strong> Pages Audited
      </div>
    </header>

    <div class="summary-grid">
      <div class="score-circle-card">
        <div class="score-number" style="color: ${scoreColor}">${summary.overallScore}</div>
        <div class="score-rating" style="color: ${scoreColor}">${escapeHtml(summary.rating)}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">Overall Health Score</div>
      </div>

      <div class="metrics-container">
        <div class="counters-grid">
          <div class="counter-box">
            <span class="counter-label">Critical</span>
            <span class="counter-val" style="color: var(--color-critical)">${summary.criticalCount}</span>
          </div>
          <div class="counter-box">
            <span class="counter-label">High</span>
            <span class="counter-val" style="color: var(--color-high)">${summary.highCount}</span>
          </div>
          <div class="counter-box">
            <span class="counter-label">Medium</span>
            <span class="counter-val" style="color: var(--color-medium)">${summary.mediumCount}</span>
          </div>
          <div class="counter-box">
            <span class="counter-label">Low / Info</span>
            <span class="counter-val" style="color: var(--color-low)">${summary.lowCount + summary.infoCount}</span>
          </div>
        </div>

        <div class="cat-scores-grid">
          ${categoryScoresHtml}
        </div>
      </div>
    </div>

    ${flowAnalysisHtml}

    <section>
      <div class="section-title">
        <span>Defect & Finding Inventory</span>
        <span style="font-size: 13px; color: var(--text-muted); font-weight: 400;">Total: ${findings.length} findings</span>
      </div>
      ${
        findingsHtml ||
        `<div class="empty-state" style="text-align: center; padding: 48px 0; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 8px;">🎉</div>
          <strong style="color: var(--text-main); font-size: 16px;">Zero Defects Detected!</strong>
          <p style="margin-top: 6px; font-size: 13px;">All automated deterministic and interactive suites passed with flying colors.</p>
        </div>`
      }
    </section>

    <footer>
      Generated by Autonomous AI Website QA Agent &bull; Client-Side Verification &bull; All Rights Reserved
    </footer>
  </div>
</body>
</html>`;
}
