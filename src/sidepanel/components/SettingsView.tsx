import React, { useEffect, useState } from 'react';
import { SessionConfig, AIConfig } from '../../shared/types/session';
import { Shield, AlertTriangle, Trash2, RotateCcw, Cpu, Download, CheckCircle2, XCircle, Cloud, Link, Sparkles, Eye, EyeOff, Loader2 } from 'lucide-react';
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
    const key = provider === 'gemini' ? aiConfig.geminiApiKey : provider === 'openai' ? aiConfig.openaiApiKey : aiConfig.anthropicApiKey;
    const model = provider === 'gemini' ? aiConfig.geminiModel : provider === 'openai' ? aiConfig.openaiModel : aiConfig.anthropicModel;

    if (!key || key.trim().length < 5) {
      setTestResults((prev) => ({ ...prev, [provider]: { success: false, message: 'Please enter a valid API key first' } }));
      return;
    }

    setTestingProvider(provider);
    setTestResults((prev) => ({ ...prev, [provider]: null }));

    try {
      const res = await sendToBackground('TEST_LLM_KEY', { provider, apiKey: key, model });
      setTestResults((prev) => ({ ...prev, [provider]: res }));
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [provider]: { success: false, message: err instanceof Error ? err.message : String(err) } }));
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
      {/* Privacy Mode */}
      <div className="settings-group">
        <div className="settings-row">
          <div style={{ paddingRight: '10px' }}>
            <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} color={settings.privacyMode ? "var(--color-success-text)" : "var(--text-muted)"} />
              Privacy Mode
            </div>
            <div className="settings-description">
              {settings.privacyMode
                ? 'Active: Cloud AI is bypassed. Purely local heuristics and WebGPU analysis are used.'
                : 'Disabled: Cloud AI models (Gemini, OpenAI, Claude) are active for deep reasoning and QA.'}
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
      </div>

      {/* Cloud AI Engine (Gemini, OpenAI, Anthropic) */}
      <div className="settings-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="var(--color-primary)" />
            AI Intelligence Models (Gemini, OpenAI, Claude)
          </div>
          <span className="badge badge-privacy" style={{ fontSize: '9px' }}>
            {aiConfig.provider === 'auto' ? 'Auto-Detect' : aiConfig.provider.toUpperCase()}
          </span>
        </div>
        <div className="settings-description" style={{ marginBottom: '10px' }}>
          Provide an API key for Google Gemini, OpenAI, or Anthropic. If <strong>any one key</strong> is provided, the agent automatically activates that provider for deep reasoning and flow analysis.
        </div>

        {/* Provider Mode Selection */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            ACTIVE PROVIDER SELECTION
          </label>
          <select
            value={aiConfig.provider}
            onChange={(e) => updateAiConfig({ provider: e.target.value as any })}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
            }}
          >
            <option value="auto">⚡ Auto-Detect (Use Any Provided Key)</option>
            <option value="gemini">Google Gemini Pro / Flash</option>
            <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
            <option value="anthropic">Anthropic Claude (Claude 3.5 Haiku / Sonnet)</option>
            <option value="local_webgpu">Local WebGPU Only (Offline)</option>
          </select>
        </div>

        {/* 1. Google Gemini */}
        <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8', whiteSpace: 'nowrap' }}>Google Gemini</span>
            <select
              value={aiConfig.geminiModel || 'gemini-3.6-flash'}
              onChange={(e) => updateAiConfig({ geminiModel: e.target.value })}
              style={{ fontSize: '10px', padding: '2px 4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '4px', maxWidth: '175px', minWidth: 0 }}
            >
              <option value="gemini-3.6-flash">Gemini 3.6 Flash (Fast)</option>
              <option value="gemini-flash-latest">Gemini Flash (Auto)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep)</option>
              <option value="gemini-pro-latest">Gemini Pro (Auto)</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%', minWidth: 0 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <input
                type={showKeys.gemini ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={aiConfig.geminiApiKey || ''}
                onChange={(e) => updateAiConfig({ geminiApiKey: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 28px 5px 8px', fontSize: '11px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
              />
              <button
                type="button"
                onClick={() => toggleShowKey('gemini')}
                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                {showKeys.gemini ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => handleTestKey('gemini')}
              disabled={testingProvider === 'gemini'}
              style={{ fontSize: '10px', padding: '5px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {testingProvider === 'gemini' ? <Loader2 size={11} className="spin" /> : 'Test Key'}
            </button>
          </div>
          {testResults.gemini && (
            <div style={{ marginTop: '6px', fontSize: '10px', color: testResults.gemini.success ? 'var(--color-success-text)' : 'var(--color-critical-text)', wordBreak: 'break-word' }}>
              {testResults.gemini.success ? '✓' : '✗'} {testResults.gemini.message}
            </div>
          )}
        </div>

        {/* 2. OpenAI */}
        <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', whiteSpace: 'nowrap' }}>OpenAI</span>
            <select
              value={aiConfig.openaiModel || 'gpt-4o-mini'}
              onChange={(e) => updateAiConfig({ openaiModel: e.target.value })}
              style={{ fontSize: '10px', padding: '2px 4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '4px', maxWidth: '175px', minWidth: 0 }}
            >
              <option value="gpt-4o-mini">GPT-4o mini (Balanced)</option>
              <option value="gpt-4o">GPT-4o (Frontier)</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%', minWidth: 0 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <input
                type={showKeys.openai ? 'text' : 'password'}
                placeholder="sk-..."
                value={aiConfig.openaiApiKey || ''}
                onChange={(e) => updateAiConfig({ openaiApiKey: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 28px 5px 8px', fontSize: '11px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
              />
              <button
                type="button"
                onClick={() => toggleShowKey('openai')}
                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                {showKeys.openai ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => handleTestKey('openai')}
              disabled={testingProvider === 'openai'}
              style={{ fontSize: '10px', padding: '5px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {testingProvider === 'openai' ? <Loader2 size={11} className="spin" /> : 'Test Key'}
            </button>
          </div>
          {testResults.openai && (
            <div style={{ marginTop: '6px', fontSize: '10px', color: testResults.openai.success ? 'var(--color-success-text)' : 'var(--color-critical-text)', wordBreak: 'break-word' }}>
              {testResults.openai.success ? '✓' : '✗'} {testResults.openai.message}
            </div>
          )}
        </div>

        {/* 3. Anthropic Claude */}
        <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', whiteSpace: 'nowrap' }}>Anthropic Claude</span>
            <select
              value={aiConfig.anthropicModel || 'claude-3-5-haiku-20241022'}
              onChange={(e) => updateAiConfig({ anthropicModel: e.target.value })}
              style={{ fontSize: '10px', padding: '2px 4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '4px', maxWidth: '175px', minWidth: 0 }}
            >
              <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Speed)</option>
              <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Advanced)</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%', minWidth: 0 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <input
                type={showKeys.anthropic ? 'text' : 'password'}
                placeholder="sk-ant-..."
                value={aiConfig.anthropicApiKey || ''}
                onChange={(e) => updateAiConfig({ anthropicApiKey: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 28px 5px 8px', fontSize: '11px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
              />
              <button
                type="button"
                onClick={() => toggleShowKey('anthropic')}
                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                {showKeys.anthropic ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => handleTestKey('anthropic')}
              disabled={testingProvider === 'anthropic'}
              style={{ fontSize: '10px', padding: '5px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {testingProvider === 'anthropic' ? <Loader2 size={11} className="spin" /> : 'Test Key'}
            </button>
          </div>
          {testResults.anthropic && (
            <div style={{ marginTop: '6px', fontSize: '10px', color: testResults.anthropic.success ? 'var(--color-success-text)' : 'var(--color-critical-text)', wordBreak: 'break-word' }}>
              {testResults.anthropic.success ? '✓' : '✗'} {testResults.anthropic.message}
            </div>
          )}
        </div>
      </div>

      {/* Local AI Engine (WebGPU) */}
      <div className="settings-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={14} color="var(--color-primary)" />
            Local AI Engine (WebGPU)
          </div>
          <span
            className={`badge ${isWebGpuSupported ? 'badge-privacy' : 'badge-danger'}`}
            style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {isWebGpuSupported ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            {tier === 'FULL_WEBGPU' ? 'WebGPU Active' : tier === 'LIGHT_WEBGPU' ? 'Lightweight WebGPU' : 'Deterministic Only'}
          </span>
        </div>
        <div className="settings-description" style={{ marginBottom: '10px' }}>
          In-browser quantized neural network for visual UI defect reasoning and intelligent remediation without external APIs.
        </div>

        {isWebGpuSupported ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', minWidth: 0 }}>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={modelStatus.status === 'DOWNLOADING'}
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: '100%',
                  padding: '6px 8px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                }}
              >
                <option value={DEFAULT_LIGHT_MODEL}>SmolLM2-360M (~376MB, Fast 4-bit)</option>
                <option value={DEFAULT_COMPAT_MODEL}>SmolLM2-360M (~580MB, Universal Compatibility)</option>
                <option value={DEFAULT_FULL_MODEL}>Llama-3.2-1B (~800MB, Full)</option>
                <option value="SmolLM2-360M-Instruct-q0f32-MLC">SmolLM2-360M (~1.7GB, Unquantized)</option>
              </select>

              <button
                className="btn btn-secondary"
                disabled={modelStatus.status === 'DOWNLOADING' || modelStatus.status === 'READY'}
                onClick={handleLoadModel}
                style={{ fontSize: '11px', padding: '6px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span>{modelStatus.progressText}</span>
                  <span>{modelStatus.progressPercent}%</span>
                </div>
                <div className="progress-track" style={{ height: '4px' }}>
                  <div className="progress-fill" style={{ width: `${modelStatus.progressPercent}%` }} />
                </div>
              </div>
            )}

            {modelStatus.status === 'ERROR' && (
              <div style={{ fontSize: '11px', color: 'var(--color-critical-text)', background: 'rgba(218, 54, 51, 0.1)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(218, 54, 51, 0.25)', marginTop: '4px' }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <AlertTriangle size={13} /> Model Initialization Failed
                </div>
                <div style={{ fontSize: '10px', opacity: 0.95, wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {modelStatus.lastError || 'Could not allocate WebGPU memory for model weights.'}
                </div>
                <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  💡 Tip: You can select the <strong>Universal Compatibility</strong> model or use <strong>Google Gemini</strong> above for instant cloud reasoning.
                </div>
              </div>
            )}

            {modelStatus.status === 'READY' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', color: 'var(--color-success-text)' }}>
                  Model ready for hybrid ambiguity arbitration.
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={handleClearModelCache}
                  disabled={isClearingCache}
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                >
                  Unload & Clear VRAM
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-surface-elevated)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
            WebGPU is not enabled or supported on this browser profile. The agent will run in pure deterministic mode with 100% functionality.
          </div>
        )}
      </div>

      {/* Safety Controls */}
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} color="var(--color-warning-text)" />
              Require High-Risk Approval
            </div>
            <div className="settings-description">
              Pause QA and prompt for manual confirmation before checkout, delete, or payments.
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
      </div>

      {/* Crawl Limits */}
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-label">Max Pages per Crawl</div>
            <div className="settings-description">Limit discovery to avoid overloading large websites.</div>
          </div>
          <input
            type="number"
            min={1}
            max={50}
            value={settings.maxPages}
            onChange={(e) => onUpdateSettings({ maxPages: Number(e.target.value) || 10 })}
            style={{
              width: '60px',
              padding: '4px 6px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-sm)',
            }}
          />
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-label">Crawl Depth</div>
            <div className="settings-description">Maximum link hops from starting page.</div>
          </div>
          <input
            type="number"
            min={1}
            max={5}
            value={settings.crawlDepth}
            onChange={(e) => onUpdateSettings({ crawlDepth: Number(e.target.value) || 2 })}
            style={{
              width: '60px',
              padding: '4px 6px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-sm)',
            }}
          />
        </div>
      </div>

      {/* Supabase Cloud Integration */}
      <div className="settings-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cloud size={14} color="var(--color-primary-text)" />
              Supabase Cloud Sync (Optional)
            </div>
            <div className="settings-description">
              Upload audit reports & generate shareable links for your team.
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Supabase Project URL
              </label>
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
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Public Anon Key (JWT)
              </label>
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
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, padding: '5px 10px', fontSize: '11px' }}
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
                <Link size={12} /> {isTestingSupabase ? 'Testing...' : 'Test Connection'}
              </button>

              {supabaseTestResult && (
                <div
                  style={{
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: supabaseTestResult.success ? 'var(--color-success-text)' : 'var(--color-critical-text)',
                  }}
                >
                  {supabaseTestResult.success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  <span>{supabaseTestResult.message}</span>
                </div>
              )}
            </div>

            <div
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                lineHeight: 1.4,
                padding: '6px 8px',
                background: 'rgba(56, 139, 253, 0.05)',
                border: '1px solid rgba(56, 139, 253, 0.15)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              🔒 <strong>Privacy Assurance:</strong> Reports are only uploaded when you explicitly click
              &quot;Share Online&quot; in the Reports tab.
            </div>
          </div>
        )}
      </div>

      {/* Human-Grade QA Engine */}
      <div className="settings-group">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="var(--brand-primary)" />
            Human-Grade QA Engine
          </div>
          <span className="badge badge-info" style={{ fontSize: '10px' }}>
            PRO
          </span>
        </div>
        <div className="settings-description" style={{ marginBottom: '12px' }}>
          Empowers the agent to perform advanced exploratory QA tasks typically requiring human engineers.
        </div>

        {/* Business Logic & Math Verification */}
        <div className="settings-row" style={{ marginBottom: '8px' }}>
          <div>
            <div className="settings-label" style={{ fontSize: '12px' }}>Business Logic & Pricing Verification</div>
            <div className="settings-description" style={{ fontSize: '11px' }}>
              Audits checkout math: items, coupon discounts, sales tax, shipping, and total calculation consistency.
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

        {/* Virtual Mailbox & Disposable OTP */}
        <div className="settings-row" style={{ marginBottom: '8px' }}>
          <div>
            <div className="settings-label" style={{ fontSize: '12px' }}>Virtual Mailbox & OTP Verification</div>
            <div className="settings-description" style={{ fontSize: '11px' }}>
              Generates disposable inboxes to test real registration and OTP/link verification without human intervention.
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

        {/* Chaos & Boundary Fuzzing */}
        <div className="settings-row" style={{ marginBottom: '8px' }}>
          <div>
            <div className="settings-label" style={{ fontSize: '12px' }}>Chaos & Destructive Fuzzing</div>
            <div className="settings-description" style={{ fontSize: '11px' }}>
              Detects double-click race conditions on payment buttons, missing input length limits, and negative amounts.
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

        {/* Backend Database Verification */}
        <div className="settings-row">
          <div>
            <div className="settings-label" style={{ fontSize: '12px' }}>Backend Database Sync Verification</div>
            <div className="settings-description" style={{ fontSize: '11px' }}>
              Cross-checks frontend form and order confirmations against live Supabase database records to catch silent data drops.
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

      {/* Danger Zone / Storage Management */}
      <div className="settings-group" style={{ borderColor: 'rgba(218, 54, 51, 0.3)' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-critical-text)' }}>
          DATA MANAGEMENT
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onResetSettings}>
            <RotateCcw size={13} /> Reset Defaults
          </button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={onClearStorage}>
            <Trash2 size={13} /> Clear Local DB
          </button>
        </div>
      </div>
    </div>
  );
};
