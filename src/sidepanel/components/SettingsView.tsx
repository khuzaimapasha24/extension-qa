import React, { useEffect, useState } from 'react';
import { SessionConfig, AIConfig } from '../../shared/types/session';
import {
  Shield,
  AlertTriangle,
  Trash2,
  RotateCcw,
  Cpu,
  Download,
  CheckCircle2,
  XCircle,
  Cloud,
  Link,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  Key,
  ShoppingCart,
  Mail,
  Zap,
  Database,
} from 'lucide-react';
import { modelManager, ModelManagerStatus } from '../../ai/model-manager';
import { DEFAULT_LIGHT_MODEL, DEFAULT_COMPAT_MODEL, DEFAULT_FULL_MODEL } from '../../ai/webgpu-detector';
import { DEFAULT_AI_CONFIG, DEFAULT_ADVANCED_CONFIG } from '../../shared/constants/defaults';
import { sendToBackground } from '../../shared/messaging/bus';
import { supabaseClient } from '../../cloud/supabase-client';

interface SettingsViewProps {
  settings: SessionConfig;
  onUpdateSettings: (updated: Partial<SessionConfig>) => void;
  onResetSettings: () => void;
  onClearStorage: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  onClearStorage,
}) => {
  const [modelStatus, setModelStatus] = useState<ModelManagerStatus>(modelManager.getStatus());
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_LIGHT_MODEL);
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [isTestingSupabase, setIsTestingSupabase] = useState<boolean>(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const aiConfig: AIConfig = settings.ai || DEFAULT_AI_CONFIG;
  const [testingProvider, setTestingProvider] = useState<'gemini' | 'openai' | 'anthropic' | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const updateAiConfig = (updates: Partial<AIConfig>) => {
    onUpdateSettings({
      ai: {
        ...aiConfig,
        ...updates,
      },
    });
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleTestKey = async (provider: 'gemini' | 'openai' | 'anthropic') => {
    const key =
      provider === 'gemini'
        ? aiConfig.geminiApiKey
        : provider === 'openai'
        ? aiConfig.openaiApiKey
        : aiConfig.anthropicApiKey;
    const model =
      provider === 'gemini'
        ? aiConfig.geminiModel
        : provider === 'openai'
        ? aiConfig.openaiModel
        : aiConfig.anthropicModel;

    if (!key || key.trim().length < 5) {
      setTestResults((prev) => ({
        ...prev,
        [provider]: { success: false, message: 'Please enter a valid API key first' },
      }));
      return;
    }

    setTestingProvider(provider);
    setTestResults((prev) => ({ ...prev, [provider]: null }));

    try {
      const res = await sendToBackground('TEST_LLM_KEY', { provider, apiKey: key, model });
      setTestResults((prev) => ({ ...prev, [provider]: res }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [provider]: { success: false, message: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  useEffect(() => {
    modelManager.checkHardware().then(() => {
      setModelStatus(modelManager.getStatus());
    });
  }, []);

  const handleLoadModel = async () => {
    await modelManager.loadModel(selectedModel, (_pct, _text) => {
      setModelStatus(modelManager.getStatus());
    });
    setModelStatus(modelManager.getStatus());
  };

  const handleClearModelCache = async () => {
    setIsClearingCache(true);
    await modelManager.clearCache();
    setModelStatus(modelManager.getStatus());
    setIsClearingCache(false);
  };

  const isWebGpuSupported = modelStatus.hardwareReport?.supported ?? false;
  const tier = modelStatus.hardwareReport?.tier ?? 'UNSUPPORTED';

  return (
    <div className="panel-content">
      <div className="settings-container">
        {/* ======================================================== */}
        {/* SECTION 1: AI & INTELLIGENCE ENGINE                      */}
        {/* ======================================================== */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-title">
              <Cpu size={14} color="var(--color-primary)" />
              1. AI Intelligence & Reasoning Engine
            </div>
            <div className="settings-section-desc">
              Configure how the autonomous agent reasons about web pages, interactive elements, and user journeys.
            </div>
          </div>

          {/* Card 1A: Privacy Mode & Provider Mode */}
          <div className="settings-group">
            <div className="settings-row">
              <div style={{ paddingRight: '12px' }}>
                <div className="settings-label">
                  <Shield
                    size={15}
                    color={settings.privacyMode ? 'var(--color-success-text)' : 'var(--color-primary)'}
                  />
                  Privacy Mode (100% Offline)
                </div>
                <div className="settings-description">
                  When enabled, all external cloud AI calls are completely bypassed. Testing relies exclusively on
                  local DOM heuristics and in-browser WebGPU.
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.privacyMode}
                  onChange={(e) => onUpdateSettings({ privacyMode: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>

            {/* Dynamic visual indicator banner */}
            {settings.privacyMode ? (
              <div className="settings-banner settings-banner-success">
                <Shield size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Active (100% Offline):</strong> No page content, screenshots, or credentials leave your
                  browser. The agent runs in pure private isolation.
                </div>
              </div>
            ) : (
              <div className="settings-banner settings-banner-info">
                <Sparkles size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Cloud AI Enabled:</strong> Provides human-grade reasoning (Google Gemini, OpenAI, Claude) for
                  deep bug analysis when API keys are provided below.
                </div>
              </div>
            )}

            {/* Active Provider Dropdown */}
            <div className="settings-input-group" style={{ marginTop: '2px' }}>
              <label className="settings-input-label">ACTIVE REASONING PROVIDER</label>
              <select
                value={aiConfig.provider}
                onChange={(e) => updateAiConfig({ provider: e.target.value as any })}
                className="settings-input"
              >
                <option value="auto">⚡ Auto-Detect (Use Any Provided Key)</option>
                <option value="gemini">Google Gemini Pro / Flash</option>
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="anthropic">Anthropic Claude (Claude 3.5 Haiku / Sonnet)</option>
                <option value="local_webgpu">Local WebGPU Only (Offline Neural Engine)</option>
              </select>
            </div>
          </div>

          {/* Card 1B: Cloud AI API Keys */}
          <div className="settings-group">
            <div className="settings-group-header">
              <div>
                <div className="settings-label">
                  <Key size={14} color="var(--color-warning-text)" />
                  Cloud AI API Keys (Optional)
                </div>
                <div className="settings-description">
                  Enter an API key for your preferred AI provider. If <strong>any one key</strong> is provided, the
                  agent activates it automatically.
                </div>
              </div>
              <span className="badge badge-privacy" style={{ fontSize: '9px', flexShrink: 0 }}>
                {aiConfig.provider === 'auto' ? 'Auto-Detect' : aiConfig.provider.toUpperCase()}
              </span>
            </div>

            {/* 1. Google Gemini */}
            <div className="settings-subcard">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>Google Gemini</span>
                <select
                  value={aiConfig.geminiModel || 'gemini-3.6-flash'}
                  onChange={(e) => updateAiConfig({ geminiModel: e.target.value })}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    maxWidth: '180px',
                  }}
                >
                  <option value="gemini-3.6-flash">Gemini 3.6 Flash (Fast)</option>
                  <option value="gemini-flash-latest">Gemini Flash (Auto)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep)</option>
                  <option value="gemini-pro-latest">Gemini Pro (Auto)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <input
                    type={showKeys.gemini ? 'text' : 'password'}
                    placeholder="AIzaSy..."
                    value={aiConfig.geminiApiKey || ''}
                    onChange={(e) => updateAiConfig({ geminiApiKey: e.target.value })}
                    className="settings-input"
                    style={{ paddingRight: '28px' }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('gemini')}
                    style={{
                      position: 'absolute',
                      right: '7px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showKeys.gemini ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleTestKey('gemini')}
                  disabled={testingProvider === 'gemini'}
                  style={{ fontSize: '10.5px', padding: '5px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {testingProvider === 'gemini' ? <Loader2 size={11} className="spin" /> : 'Test Key'}
                </button>
              </div>
              {testResults.gemini && (
                <div
                  style={{
                    fontSize: '10px',
                    color: testResults.gemini.success
                      ? 'var(--color-success-text)'
                      : 'var(--color-critical-text)',
                    wordBreak: 'break-word',
                  }}
                >
                  {testResults.gemini.success ? '✓' : '✗'} {testResults.gemini.message}
                </div>
              )}
            </div>

            {/* 2. OpenAI */}
            <div className="settings-subcard">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981' }}>OpenAI</span>
                <select
                  value={aiConfig.openaiModel || 'gpt-4o-mini'}
                  onChange={(e) => updateAiConfig({ openaiModel: e.target.value })}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    maxWidth: '180px',
                  }}
                >
                  <option value="gpt-4o-mini">GPT-4o mini (Balanced)</option>
                  <option value="gpt-4o">GPT-4o (Frontier)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <input
                    type={showKeys.openai ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={aiConfig.openaiApiKey || ''}
                    onChange={(e) => updateAiConfig({ openaiApiKey: e.target.value })}
                    className="settings-input"
                    style={{ paddingRight: '28px' }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openai')}
                    style={{
                      position: 'absolute',
                      right: '7px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showKeys.openai ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleTestKey('openai')}
                  disabled={testingProvider === 'openai'}
                  style={{ fontSize: '10.5px', padding: '5px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {testingProvider === 'openai' ? <Loader2 size={11} className="spin" /> : 'Test Key'}
                </button>
              </div>
              {testResults.openai && (
                <div
                  style={{
                    fontSize: '10px',
                    color: testResults.openai.success
                      ? 'var(--color-success-text)'
                      : 'var(--color-critical-text)',
                    wordBreak: 'break-word',
                  }}
                >
                  {testResults.openai.success ? '✓' : '✗'} {testResults.openai.message}
                </div>
              )}
            </div>

            {/* 3. Anthropic Claude */}
            <div className="settings-subcard">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b' }}>Anthropic Claude</span>
                <select
                  value={aiConfig.anthropicModel || 'claude-3-5-haiku-20241022'}
                  onChange={(e) => updateAiConfig({ anthropicModel: e.target.value })}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: '4px',
                    maxWidth: '180px',
                  }}
                >
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Speed)</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Advanced)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <input
                    type={showKeys.anthropic ? 'text' : 'password'}
                    placeholder="sk-ant-..."
                    value={aiConfig.anthropicApiKey || ''}
                    onChange={(e) => updateAiConfig({ anthropicApiKey: e.target.value })}
                    className="settings-input"
                    style={{ paddingRight: '28px' }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('anthropic')}
                    style={{
                      position: 'absolute',
                      right: '7px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showKeys.anthropic ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleTestKey('anthropic')}
                  disabled={testingProvider === 'anthropic'}
                  style={{ fontSize: '10.5px', padding: '5px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {testingProvider === 'anthropic' ? <Loader2 size={11} className="spin" /> : 'Test Key'}
                </button>
              </div>
              {testResults.anthropic && (
                <div
                  style={{
                    fontSize: '10px',
                    color: testResults.anthropic.success
                      ? 'var(--color-success-text)'
                      : 'var(--color-critical-text)',
                    wordBreak: 'break-word',
                  }}
                >
                  {testResults.anthropic.success ? '✓' : '✗'} {testResults.anthropic.message}
                </div>
              )}
            </div>
          </div>

          {/* Card 1C: Local AI Engine (WebGPU) */}
          <div className="settings-group">
            <div className="settings-group-header">
              <div>
                <div className="settings-label">
                  <Cpu size={14} color="var(--color-primary)" />
                  Local AI Engine (WebGPU)
                </div>
                <div className="settings-description">
                  In-browser neural network running directly on your graphics card for visual defect analysis and
                  remediation without external APIs.
                </div>
              </div>
              <span
                className={`badge ${isWebGpuSupported ? 'badge-privacy' : 'badge-danger'}`}
                style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
              >
                {isWebGpuSupported ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                {tier === 'FULL_WEBGPU'
                  ? 'WebGPU Active'
                  : tier === 'LIGHT_WEBGPU'
                  ? 'Lightweight WebGPU'
                  : 'Deterministic Only'}
              </span>
            </div>

            {isWebGpuSupported ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={modelStatus.status === 'DOWNLOADING'}
                    className="settings-input"
                    style={{ flex: 1 }}
                  >
                    <option value={DEFAULT_LIGHT_MODEL}>SmolLM2-360M (~376MB, Fast 4-bit)</option>
                    <option value={DEFAULT_COMPAT_MODEL}>SmolLM2-360M (~580MB, Universal Compatibility)</option>
                    <option value={DEFAULT_FULL_MODEL}>Llama-3.2-1B (~800MB, Full Reasoning)</option>
                    <option value="SmolLM2-360M-Instruct-q0f32-MLC">SmolLM2-360M (~1.7GB, Unquantized)</option>
                  </select>

                  <button
                    className="btn btn-secondary"
                    disabled={modelStatus.status === 'DOWNLOADING' || modelStatus.status === 'READY'}
                    onClick={handleLoadModel}
                    style={{ fontSize: '11px', padding: '6px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {modelStatus.status === 'READY' ? (
                      <>
                        <CheckCircle2 size={12} color="var(--color-success-text)" /> Loaded
                      </>
                    ) : (
                      <>
                        <Download size={12} /> {modelStatus.status === 'DOWNLOADING' ? 'Downloading...' : 'Load Model'}
                      </>
                    )}
                  </button>
                </div>

                {modelStatus.status === 'DOWNLOADING' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>{modelStatus.progressText}</span>
                      <span>{modelStatus.progressPercent}%</span>
                    </div>
                    <div className="progress-track" style={{ height: '5px' }}>
                      <div className="progress-fill" style={{ width: `${modelStatus.progressPercent}%` }} />
                    </div>
                  </div>
                )}

                {modelStatus.status === 'ERROR' && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-critical-text)',
                      background: 'rgba(218, 54, 51, 0.1)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(218, 54, 51, 0.25)',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '2px',
                      }}
                    >
                      <AlertTriangle size={13} /> Model Initialization Failed
                    </div>
                    <div style={{ fontSize: '10px', opacity: 0.95, wordBreak: 'break-word', lineHeight: 1.4 }}>
                      {modelStatus.lastError || 'Could not allocate WebGPU memory for model weights.'}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                      💡 Tip: You can select the <strong>Universal Compatibility</strong> model or use{' '}
                      <strong>Google Gemini</strong> above for instant cloud reasoning.
                    </div>
                  </div>
                )}

                {modelStatus.status === 'READY' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--color-success-text)' }}>
                      ✓ Model loaded in GPU VRAM and ready for ambiguity arbitration.
                    </span>
                    <button
                      className="btn btn-ghost"
                      onClick={handleClearModelCache}
                      disabled={isClearingCache}
                      style={{ fontSize: '10px', padding: '2px 8px' }}
                    >
                      Unload & Clear VRAM
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-surface-elevated)',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                WebGPU is not enabled on this browser profile. The agent will run with full capability in deterministic
                mode.
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 2: SAFETY & CRAWL BOUNDARIES                    */}
        {/* ======================================================== */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-title">
              <AlertTriangle size={14} color="var(--color-warning-text)" />
              2. Safety Controls & Crawl Limits
            </div>
            <div className="settings-section-desc">
              Control automated execution boundaries to prevent accidental checkouts or overwhelming large sites.
            </div>
          </div>

          <div className="settings-group">
            {/* High-Risk Approval */}
            <div className="settings-row">
              <div style={{ paddingRight: '12px' }}>
                <div className="settings-label">
                  <Shield size={14} color="var(--color-warning-text)" />
                  Require High-Risk Confirmation
                </div>
                <div className="settings-description">
                  Pauses the QA run and requests manual confirmation before clicking checkout, payment, delete, or
                  irreversible action buttons.
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.requireApprovalForHighRisk}
                  onChange={(e) => onUpdateSettings({ requireApprovalForHighRisk: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />

            {/* Crawl Limits Grid */}
            <div className="settings-grid-2">
              <div className="settings-input-group">
                <label className="settings-input-label">MAX PAGES TO CRAWL</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settings.maxPages}
                    onChange={(e) => onUpdateSettings({ maxPages: Number(e.target.value) || 10 })}
                    className="settings-input"
                    style={{ width: '80px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>pages max</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Limits discovery to avoid infinite loops on massive applications.
                </span>
              </div>

              <div className="settings-input-group">
                <label className="settings-input-label">MAX CRAWL DEPTH</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={settings.crawlDepth}
                    onChange={(e) => onUpdateSettings({ crawlDepth: Number(e.target.value) || 2 })}
                    className="settings-input"
                    style={{ width: '80px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>link hops</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Maximum navigation hops away from the starting landing URL.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 3: HUMAN-GRADE QA ENGINE (PRO)                   */}
        {/* ======================================================== */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-title">
              <Sparkles size={14} color="var(--color-purple)" />
              3. Human-Grade QA Engine (PRO Features)
            </div>
            <div className="settings-section-desc">
              Autonomous cognitive capabilities designed to emulate manual QA engineers across e-commerce, forms, and auth.
            </div>
          </div>

          <div className="settings-group">
            {/* 1. Business Logic */}
            <div className="settings-row">
              <div style={{ paddingRight: '12px' }}>
                <div className="settings-label">
                  <ShoppingCart size={14} color="#38bdf8" />
                  Business Logic & Pricing Verification
                </div>
                <div className="settings-description">
                  Audits cart and checkout arithmetic: item lines, discounts, promo codes, sales taxes, and shipping
                  consistency.
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.advanced?.businessLogicVerification ?? true}
                  onChange={(e) =>
                    onUpdateSettings({
                      advanced: {
                        ...(settings.advanced || DEFAULT_ADVANCED_CONFIG),
                        businessLogicVerification: e.target.checked,
                      },
                    })
                  }
                />
                <span className="slider" />
              </label>
            </div>

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />

            {/* 2. Virtual Mailbox */}
            <div className="settings-row">
              <div style={{ paddingRight: '12px' }}>
                <div className="settings-label">
                  <Mail size={14} color="#10b981" />
                  Virtual Mailbox & OTP Verification
                </div>
                <div className="settings-description">
                  Auto-generates temporary email inboxes to test real user registration, magic login links, and OTP codes.
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.advanced?.virtualMailboxEnabled ?? true}
                  onChange={(e) =>
                    onUpdateSettings({
                      advanced: {
                        ...(settings.advanced || DEFAULT_ADVANCED_CONFIG),
                        virtualMailboxEnabled: e.target.checked,
                      },
                    })
                  }
                />
                <span className="slider" />
              </label>
            </div>

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />

            {/* 3. Chaos Fuzzing */}
            <div className="settings-row">
              <div style={{ paddingRight: '12px' }}>
                <div className="settings-label">
                  <Zap size={14} color="#f59e0b" />
                  Chaos & Destructive Fuzzing
                </div>
                <div className="settings-description">
                  Detects double-click race conditions on payment buttons, missing field character limits, and negative
                  amounts.
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.advanced?.chaosTestingEnabled ?? true}
                  onChange={(e) =>
                    onUpdateSettings({
                      advanced: {
                        ...(settings.advanced || DEFAULT_ADVANCED_CONFIG),
                        chaosTestingEnabled: e.target.checked,
                      },
                    })
                  }
                />
                <span className="slider" />
              </label>
            </div>

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />

            {/* 4. Backend DB Sync */}
            <div className="settings-row">
              <div style={{ paddingRight: '12px' }}>
                <div className="settings-label">
                  <Database size={14} color="#a371f7" />
                  Backend Database Sync Verification
                </div>
                <div className="settings-description">
                  Cross-checks frontend form submissions against live Supabase database tables to catch silent data drops.
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.advanced?.backendVerificationEnabled ?? false}
                  onChange={(e) =>
                    onUpdateSettings({
                      advanced: {
                        ...(settings.advanced || DEFAULT_ADVANCED_CONFIG),
                        backendVerificationEnabled: e.target.checked,
                      },
                    })
                  }
                />
                <span className="slider" />
              </label>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 4: CLOUD SYNC & DATA MANAGEMENT                  */}
        {/* ======================================================== */}
        <div className="settings-section">
          <div className="settings-section-header">
            <div className="settings-section-title">
              <Cloud size={14} color="var(--color-primary)" />
              4. Cloud Sync & Data Management
            </div>
            <div className="settings-section-desc">
              Synchronize audit reports with your team and manage local browser storage.
            </div>
          </div>

          {/* Supabase Cloud */}
          <div className="settings-group">
            <div className="settings-row">
              <div style={{ paddingRight: '12px' }}>
                <div className="settings-label">
                  <Cloud size={14} color="var(--color-primary)" />
                  Supabase Cloud Sync (Optional)
                </div>
                <div className="settings-description">
                  Upload HTML audit reports to your Supabase project and generate shareable links for teammates.
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.supabase?.enabled ?? false}
                  onChange={(e) =>
                    onUpdateSettings({
                      supabase: {
                        ...(settings.supabase || { url: '', anonKey: '', storageBucket: 'qa-reports' }),
                        enabled: e.target.checked,
                      },
                    })
                  }
                />
                <span className="slider" />
              </label>
            </div>

            {settings.supabase?.enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <div className="settings-input-group">
                  <label className="settings-input-label">SUPABASE PROJECT URL</label>
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={settings.supabase?.url || ''}
                    onChange={(e) =>
                      onUpdateSettings({
                        supabase: {
                          ...(settings.supabase || { enabled: true, anonKey: '', storageBucket: 'qa-reports' }),
                          url: e.target.value,
                        },
                      })
                    }
                    className="settings-input"
                  />
                </div>

                <div className="settings-input-group">
                  <label className="settings-input-label">PUBLIC ANON KEY (JWT)</label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                    value={settings.supabase?.anonKey || ''}
                    onChange={(e) =>
                      onUpdateSettings({
                        supabase: {
                          ...(settings.supabase || { enabled: true, url: '', storageBucket: 'qa-reports' }),
                          anonKey: e.target.value,
                        },
                      })
                    }
                    className="settings-input"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '6px 12px', fontSize: '11px' }}
                    disabled={isTestingSupabase || !settings.supabase?.url || !settings.supabase?.anonKey}
                    onClick={async () => {
                      setIsTestingSupabase(true);
                      setSupabaseTestResult(null);
                      const res = await supabaseClient.testConnection(
                        settings.supabase?.url || '',
                        settings.supabase?.anonKey || ''
                      );
                      setIsTestingSupabase(false);
                      if (res.success) {
                        setSupabaseTestResult({ success: true, message: `Connected (${res.latencyMs}ms)` });
                      } else {
                        setSupabaseTestResult({ success: false, message: res.error || 'Connection failed' });
                      }
                    }}
                  >
                    <Link size={12} /> {isTestingSupabase ? 'Testing Connection...' : 'Test Connection'}
                  </button>

                  {supabaseTestResult && (
                    <div
                      style={{
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: supabaseTestResult.success
                          ? 'var(--color-success-text)'
                          : 'var(--color-critical-text)',
                      }}
                    >
                      {supabaseTestResult.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      <span>{supabaseTestResult.message}</span>
                    </div>
                  )}
                </div>

                <div className="settings-banner settings-banner-info">
                  <Shield size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Privacy Guarantee:</strong> Reports are only uploaded when you explicitly click
                    &quot;Share Online&quot; in the Reports tab.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Danger Zone: Storage Management */}
          <div className="settings-group" style={{ borderColor: 'rgba(218, 54, 51, 0.3)' }}>
            <div>
              <div className="settings-label" style={{ color: 'var(--color-critical-text)' }}>
                <Trash2 size={14} />
                Storage & Defaults (Danger Zone)
              </div>
              <div className="settings-description">
                Reset configuration back to factory defaults or wipe local IndexedDB history (sessions, findings, and logs).
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, padding: '7px 12px' }}
                onClick={onResetSettings}
              >
                <RotateCcw size={13} /> Reset Defaults
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1, padding: '7px 12px' }}
                onClick={onClearStorage}
              >
                <Trash2 size={13} /> Clear Local DB
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
