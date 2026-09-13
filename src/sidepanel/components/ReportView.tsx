import React, { useState } from 'react';
import { QASession } from '../../shared/types/session';
import { Finding } from '../../shared/types/qa';
import { WebsiteDiscoveryMap } from '../../shared/types/discovery';
import { reportEngine } from '../../reporting/report-engine';
import { QAReportData } from '../../reporting/report-types';
import {
  FileText,
  Download,
  Copy,
  Printer,
  Check,
  Code,
  ShieldCheck,
  FileSpreadsheet,
  Cloud,
  ExternalLink,
  Loader2,
  Terminal,
  GitPullRequest,
} from 'lucide-react';
import { cloudSyncEngine } from '../../cloud/cloud-sync';
import { githubPrGenerator } from '../../agent';

interface ReportViewProps {
  session: QASession | null;
  findings: Finding[];
  discoveryMap: WebsiteDiscoveryMap | null;
  flowAnalysis?: import('../../reporting/report-types').WebsiteFlowAnalysis | null;
}

export const ReportView: React.FC<ReportViewProps> = ({ session, findings, discoveryMap, flowAnalysis }) => {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'automation' | 'pr' | 'html' | 'markdown' | 'json'>('summary');
  const [automationFormat, setAutomationFormat] = useState<'playwright' | 'cypress' | 'github_actions'>('playwright');
  const [prFormat, setPrFormat] = useState<'pr_markdown' | 'git_cli' | 'patch_file'>('pr_markdown');
  const [isUploadingCloud, setIsUploadingCloud] = useState<boolean>(false);
  const [cloudShareUrl, setCloudShareUrl] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="panel-content" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <FileText size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <p style={{ color: 'var(--text-muted)' }}>No audit session available for reporting.</p>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Run an automated QA scan from the Dashboard or Runner tab to generate comprehensive reports.
        </p>
      </div>
    );
  }

  const reportData: QAReportData = reportEngine.buildReportData(session, findings, discoveryMap, flowAnalysis);

  const handleShareOnline = async () => {
    setCloudError(null);
    const supabaseConfig = session.config?.supabase;

    if (!supabaseConfig || !supabaseConfig.enabled || !supabaseConfig.url || !supabaseConfig.anonKey) {
      setCloudError('Supabase is not configured. Please enable and configure it in the Settings tab.');
      return;
    }

    setIsUploadingCloud(true);
    const result = await cloudSyncEngine.syncReportToCloud(reportData, supabaseConfig);
    setIsUploadingCloud(false);

    if (result.success && result.shareUrl) {
      setCloudShareUrl(result.shareUrl);
    } else {
      setCloudError(result.error || 'Failed to upload report to cloud.');
    }
  };
  const overallScore = reportData.summary.overallScore;

  const scoreColor =
    overallScore >= 90
      ? 'var(--color-success-text)'
      : overallScore >= 75
        ? 'var(--color-warning-text)'
        : 'var(--color-critical-text)';

  const handleDownloadHtml = () => {
    const html = reportEngine.formatReport(reportData, 'HTML');
    const safeTitle = (session.title || 'qa-report').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    reportEngine.downloadFile(html, `${safeTitle}_audit_report.html`, 'text/html');
  };

  const handleDownloadJson = () => {
    const json = reportEngine.formatReport(reportData, 'JSON');
    const safeTitle = (session.title || 'qa-report').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    reportEngine.downloadFile(json, `${safeTitle}_audit_report.json`, 'application/json');
  };

  const handleCopyMarkdown = async () => {
    const md = reportEngine.formatReport(reportData, 'MARKDOWN');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(md);
      setCopiedFormat('markdown');
      setTimeout(() => setCopiedFormat(null), 2000);
    }
  };

  const handlePrintPdf = () => {
    const html = reportEngine.formatReport(reportData, 'HTML');
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
    }
  };

  const handleDownloadPlaywright = () => {
    const pw = reportEngine.formatReport(reportData, 'PLAYWRIGHT');
    const safeTitle = (session.title || 'qa_test').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    reportEngine.downloadFile(pw, `${safeTitle}.spec.ts`, 'application/typescript');
  };

  const handleDownloadCypress = () => {
    const cy = reportEngine.formatReport(reportData, 'CYPRESS');
    const safeTitle = (session.title || 'qa_test').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    reportEngine.downloadFile(cy, `${safeTitle}.cy.ts`, 'application/typescript');
  };

  const handleDownloadGitHubActions = () => {
    const yml = reportEngine.formatReport(reportData, 'GITHUB_ACTIONS');
    reportEngine.downloadFile(yml, 'qa-pipeline.yml', 'text/yaml');
  };

  const handleCopyAutomation = async (format: 'playwright' | 'cypress' | 'github_actions') => {
    const reportFmt =
      format === 'playwright'
        ? 'PLAYWRIGHT'
        : format === 'cypress'
          ? 'CYPRESS'
          : 'GITHUB_ACTIONS';
    const code = reportEngine.formatReport(reportData, reportFmt);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(code);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    }
  };

  const handleDownloadPrMarkdown = () => {
    const pr = reportEngine.formatReport(reportData, 'GITHUB_PR');
    reportEngine.downloadFile(pr, 'PULL_REQUEST.md', 'text/markdown');
  };

  const handleDownloadPatch = () => {
    const patch = reportEngine.formatReport(reportData, 'UNIFIED_PATCH');
    reportEngine.downloadFile(patch, 'qa_autonomous_remediation.patch', 'text/plain');
  };

  const handleDownloadGitCli = () => {
    const prObj = githubPrGenerator.generateCompositePR(reportData.findings);
    reportEngine.downloadFile(prObj.gitWorkflowCommands, 'apply_fixes.sh', 'text/x-sh');
  };

  const handleCopyPr = async (format: 'pr_markdown' | 'git_cli' | 'patch_file') => {
    let content = '';
    if (format === 'pr_markdown') content = reportEngine.formatReport(reportData, 'GITHUB_PR');
    else if (format === 'patch_file') content = reportEngine.formatReport(reportData, 'UNIFIED_PATCH');
    else content = githubPrGenerator.generateCompositePR(reportData.findings).gitWorkflowCommands;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(content);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    }
  };

  return (
    <div className="panel-content">
      {/* Sub-navigation tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface-elevated)', padding: '3px', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
        <button
          className={`tab-button ${activeSubTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('summary')}
          style={{ flex: 1, padding: '4px 6px', fontSize: '11px' }}
        >
          <ShieldCheck size={12} /> Executive
        </button>
        <button
          className={`tab-button ${activeSubTab === 'automation' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('automation')}
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: '11px',
            color: activeSubTab === 'automation' ? 'var(--color-primary-text)' : undefined,
            fontWeight: activeSubTab === 'automation' ? 600 : undefined,
          }}
        >
          <Terminal size={12} /> CI/CD
        </button>
        <button
          className={`tab-button ${activeSubTab === 'pr' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('pr')}
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: '11px',
            color: activeSubTab === 'pr' ? '#a371f7' : undefined,
            fontWeight: activeSubTab === 'pr' ? 600 : undefined,
          }}
        >
          <GitPullRequest size={12} /> Fix & PR
        </button>
        <button
          className={`tab-button ${activeSubTab === 'html' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('html')}
          style={{ flex: 1, padding: '4px 6px', fontSize: '11px' }}
        >
          <FileText size={12} /> HTML
        </button>
        <button
          className={`tab-button ${activeSubTab === 'markdown' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('markdown')}
          style={{ flex: 1, padding: '4px 6px', fontSize: '11px' }}
        >
          <Code size={12} /> MD
        </button>
        <button
          className={`tab-button ${activeSubTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('json')}
          style={{ flex: 1, padding: '4px 6px', fontSize: '11px' }}
        >
          <FileSpreadsheet size={12} /> JSON
        </button>
      </div>

      {/* Export Action Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            setActiveSubTab('automation');
            setAutomationFormat('playwright');
          }}
          style={{ fontSize: '10px', padding: '6px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
        >
          <Terminal size={12} /> Playwright
        </button>
        <button className="btn btn-secondary" onClick={handleDownloadHtml} style={{ fontSize: '10px', padding: '6px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <Download size={12} /> Export HTML
        </button>
        <button className="btn btn-secondary" onClick={handlePrintPdf} style={{ fontSize: '10px', padding: '6px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <Printer size={12} /> Print PDF
        </button>
      </div>

      {/* Cloud Share Action */}
      <div style={{ marginBottom: '16px' }}>
        <button
          className="btn btn-secondary"
          onClick={handleShareOnline}
          disabled={isUploadingCloud}
          style={{
            width: '100%',
            fontSize: '11px',
            padding: '7px 10px',
            background: 'rgba(56, 139, 253, 0.1)',
            borderColor: 'rgba(56, 139, 253, 0.3)',
            color: 'var(--color-primary-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          {isUploadingCloud ? (
            <>
              <Loader2 size={13} className="spin" /> Uploading to Supabase...
            </>
          ) : (
            <>
              <Cloud size={13} /> Share Online (Supabase Cloud)
            </>
          )}
        </button>

        {cloudShareUrl && (
          <div
            style={{
              marginTop: '8px',
              padding: '10px',
              background: 'rgba(35, 134, 54, 0.1)',
              border: '1px solid rgba(35, 134, 54, 0.3)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
            }}
          >
            <div style={{ color: 'var(--color-success-text)', fontWeight: 600, marginBottom: '4px' }}>
              ✓ Report Published to Cloud!
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }}
                onClick={() => {
                  navigator.clipboard.writeText(cloudShareUrl);
                  setCopiedFormat('cloud');
                  setTimeout(() => setCopiedFormat(null), 2000);
                }}
              >
                {copiedFormat === 'cloud' ? <Check size={11} color="var(--color-success-text)" /> : <Copy size={11} />}
                {copiedFormat === 'cloud' ? 'Copied Link!' : 'Copy Link'}
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }}
                onClick={() => window.open(cloudShareUrl, '_blank')}
              >
                <ExternalLink size={11} /> Open
              </button>
            </div>
          </div>
        )}

        {cloudError && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px 10px',
              background: 'rgba(218, 54, 51, 0.1)',
              border: '1px solid rgba(218, 54, 51, 0.3)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              color: 'var(--color-critical-text)',
            }}
          >
            ⚠️ {cloudError}
          </div>
        )}
      </div>

      {activeSubTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Executive Health Scorecard */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                OVERALL QUALITY SCORE
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: scoreColor, lineHeight: 1.2 }}>
                {overallScore} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-muted)' }}>/ 100</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {reportData.summary.rating.replace('_', ' ')} &bull; {reportData.summary.testsExecuted} tests executed
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="badge badge-privacy" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                {reportData.summary.rating}
              </span>
            </div>
          </div>

          {/* Severity Breakdown */}
          <div className="stats-grid">
            <div className="stat-box">
              <span className="stat-label">Critical</span>
              <span className="stat-value stat-fail">{reportData.summary.criticalCount}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">High</span>
              <span className="stat-value" style={{ color: 'var(--color-high)' }}>
                {reportData.summary.highCount}
              </span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Medium</span>
              <span className="stat-value" style={{ color: 'var(--color-warning-text)' }}>
                {reportData.summary.mediumCount}
              </span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Low/Info</span>
              <span className="stat-value" style={{ color: 'var(--color-primary)' }}>
                {reportData.summary.lowCount + reportData.summary.infoCount}
              </span>
            </div>
          </div>

          {/* Category Breakdown Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>CATEGORY SCORES</div>
            {Object.entries(reportData.scores.categoryScores).map(([cat, val]) => (
              <div
                key={cat}
                style={{
                  background: 'var(--bg-surface)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>{cat}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: val.score >= 85 ? 'var(--color-success-text)' : val.score >= 60 ? 'var(--color-warning-text)' : 'var(--color-critical-text)',
                    }}
                  >
                    {val.score}%
                  </span>
                </div>
                <div className="progress-track" style={{ height: '4px' }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${val.score}%`,
                      background: val.score >= 85 ? 'var(--color-success-text)' : val.score >= 60 ? 'var(--color-warning-text)' : 'var(--color-critical-text)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'automation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Autonomous CI/CD test suite ready to commit. Runs 24/7 without manual QA intervention.
          </div>

          {/* Framework Toggle Bar */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface-elevated)', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
            <button
              className={`tab-button ${automationFormat === 'playwright' ? 'active' : ''}`}
              onClick={() => setAutomationFormat('playwright')}
              style={{ flex: 1, padding: '4px 6px', fontSize: '10px' }}
            >
              Playwright (.spec.ts)
            </button>
            <button
              className={`tab-button ${automationFormat === 'cypress' ? 'active' : ''}`}
              onClick={() => setAutomationFormat('cypress')}
              style={{ flex: 1, padding: '4px 6px', fontSize: '10px' }}
            >
              Cypress (.cy.ts)
            </button>
            <button
              className={`tab-button ${automationFormat === 'github_actions' ? 'active' : ''}`}
              onClick={() => setAutomationFormat('github_actions')}
              style={{ flex: 1, padding: '4px 6px', fontSize: '10px' }}
            >
              GitHub Actions (.yml)
            </button>
          </div>

          {/* Action Buttons for Current Format */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, fontSize: '11px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={() => handleCopyAutomation(automationFormat)}
            >
              {copiedFormat === automationFormat ? <Check size={12} color="var(--color-success-text)" /> : <Copy size={12} />}
              {copiedFormat === automationFormat ? 'Copied Code!' : 'Copy to Clipboard'}
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: '11px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={() => {
                if (automationFormat === 'playwright') handleDownloadPlaywright();
                else if (automationFormat === 'cypress') handleDownloadCypress();
                else handleDownloadGitHubActions();
              }}
            >
              <Download size={12} /> Download File
            </button>
          </div>

          {/* Code Viewer */}
          <textarea
            readOnly
            value={
              automationFormat === 'playwright'
                ? reportEngine.formatReport(reportData, 'PLAYWRIGHT')
                : automationFormat === 'cypress'
                  ? reportEngine.formatReport(reportData, 'CYPRESS')
                  : reportEngine.formatReport(reportData, 'GITHUB_ACTIONS')
            }
            style={{
              width: '100%',
              height: '320px',
              padding: '10px',
              background: '#0d1117',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: '#e6edf3',
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              lineHeight: '1.4',
              resize: 'none',
            }}
          />
        </div>
      )}

      {activeSubTab === 'pr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* PR Format Switcher */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
            <button
              className={`tab-button ${prFormat === 'pr_markdown' ? 'active' : ''}`}
              onClick={() => setPrFormat('pr_markdown')}
              style={{ flex: 1, padding: '4px 6px', fontSize: '10px' }}
            >
              PR Description
            </button>
            <button
              className={`tab-button ${prFormat === 'git_cli' ? 'active' : ''}`}
              onClick={() => setPrFormat('git_cli')}
              style={{ flex: 1, padding: '4px 6px', fontSize: '10px' }}
            >
              Git CLI Script
            </button>
            <button
              className={`tab-button ${prFormat === 'patch_file' ? 'active' : ''}`}
              onClick={() => setPrFormat('patch_file')}
              style={{ flex: 1, padding: '4px 6px', fontSize: '10px' }}
            >
              Unified .patch
            </button>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: '#a371f7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <GitPullRequest size={13} /> {reportData.findings.length} Autonomous Patches Synthesized
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '10px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => handleCopyPr(prFormat)}
              >
                {copiedFormat === prFormat ? (
                  <>
                    <Check size={11} color="var(--color-success-text)" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={11} /> Copy
                  </>
                )}
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '10px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => {
                  if (prFormat === 'pr_markdown') handleDownloadPrMarkdown();
                  else if (prFormat === 'patch_file') handleDownloadPatch();
                  else handleDownloadGitCli();
                }}
              >
                <Download size={11} /> Download
              </button>
            </div>
          </div>

          {/* Code Viewer */}
          <textarea
            readOnly
            value={
              prFormat === 'pr_markdown'
                ? reportEngine.formatReport(reportData, 'GITHUB_PR')
                : prFormat === 'patch_file'
                  ? reportEngine.formatReport(reportData, 'UNIFIED_PATCH')
                  : githubPrGenerator.generateCompositePR(reportData.findings).gitWorkflowCommands
            }
            style={{
              width: '100%',
              height: '320px',
              padding: '10px',
              background: '#0d1117',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: '#e6edf3',
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              lineHeight: '1.4',
              resize: 'none',
            }}
          />
        </div>
      )}

      {activeSubTab === 'html' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Self-contained, responsive HTML report preview with embedded CSS and screenshots.
          </div>
          <iframe
            srcDoc={reportEngine.formatReport(reportData, 'HTML')}
            title="HTML Report Preview"
            style={{
              width: '100%',
              height: '340px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              background: '#0d1117',
            }}
          />
        </div>
      )}

      {activeSubTab === 'markdown' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            GitHub Flavored Markdown format ready for PR comments or Jira tickets.
          </div>
          <textarea
            readOnly
            value={reportEngine.formatReport(reportData, 'MARKDOWN')}
            style={{
              width: '100%',
              height: '340px',
              padding: '8px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              resize: 'none',
            }}
          />
        </div>
      )}

      {activeSubTab === 'json' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Standardized JSON schema export for automated CI/CD pipeline quality gates.
          </div>
          <textarea
            readOnly
            value={reportEngine.formatReport(reportData, 'JSON')}
            style={{
              width: '100%',
              height: '340px',
              padding: '8px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              resize: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
};
