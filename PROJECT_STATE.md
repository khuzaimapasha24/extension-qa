# PROJECT STATE: AI Website QA Agent

## Project Status
- **Current Phase**: Phase 11 Complete (Human-Grade QA Capabilities & Advanced Exploratory Engine) - ALL PHASES COMPLETED
- **Current Version**: 1.1.0
- **Build Status**: Passing (0 errors)
- **Package Status**: Ready for Chrome Web Store (`dist/ai-website-qa-agent-v1.0.0.zip`)

---

## Completed Features

### Phase 1: Foundation & Shell
- **Manifest V3 Core**: Configured `manifest.json` with `sidePanel`, `activeTab`, `scripting`, `storage`, `tabs`, and `<all_urls>` host permissions.
- **Side Panel First-Class Architecture**: Service worker hooks `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` for native DevTools-style side panel.
- **Popup Fallback**: Quick launcher in `src/popup/` for windows without automatic docking.
- **Pure Agent State Machine**: Comprehensive state transitions covering `IDLE`, `INITIALIZING`, `DISCOVERING`, `ANALYZING`, `PLANNING`, `EXECUTING`, `OBSERVING`, `REASONING`, `VERIFYING`, `REPORTING`, `COMPLETED`, and `ERROR`.
- **Session Manager (`background/session-manager.ts`)**: Coordinates active QA lifecycle (`startSession`, `pauseSession`, `resumeSession`, `stopSession`, `updateState`), persistence, and broadcast events.
- **Strongly-Typed Message Bus (`shared/messaging/bus.ts` & `background/message-router.ts`)**: Type-safe discriminated union RPC system over `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`.
- **Local-First IndexedDB Engine (`storage/indexed-db.ts`)**: Database `ai_qa_agent_db` (v2) supporting 8 typed stores (`sessions`, `findings`, `projects`, `logs`, `settings`, `reports`, `page_snapshots`, `discovery_maps`).
- **Settings & Privacy Mode (`storage/settings-store.ts`)**: Default `privacyMode: true`, configurable crawl depth (default 2), max pages (default 10), and high-risk action confirmation requirement.
- **Action Risk Classifier (`shared/constants/risk-levels.ts`)**: Pattern-based classifier distinguishing `LOW` (safe inspection/clicks), `MEDIUM` (form submission/search), and `HIGH` (checkout, payments, deletion, credential updates).
- **Structured Redacting Logger (`shared/logger/logger.ts`)**: Strips Bearer tokens, cookies, auth keys, and passwords before writes.
- **Developer-Grade Side Panel UI**: Header, TabNav, DashboardView, LiveRunnerView, FindingsView, SettingsView, StatusBar.

### Phase 2: DOM Scanner & Website Discovery
- **DOM Scanner (`content/dom-scanner.ts`)**:
  - Head metadata extractor: `title`, `meta[name="description"]`, `canonical`, `robots`, `og:title`, `og:description`, `og:image`, `lang`, `charset`, `viewport`.
  - Heading hierarchy analyzer: Counts for `h1` through `h6`, and captures primary `h1` text content.
  - Image scanner: Identifies all `<img>` elements, resolves image sources, detects missing `alt` attributes (`hasAltText`), dimension properties (`naturalWidth`, `naturalHeight`), and broken image flags (`isBroken`).
- **Interactive Element Detector (`content/element-detector.ts`)**:
  - Stable CSS selector generator: Generates deterministic selectors prioritising `#id`, `[data-testid]`, `tag[name]`, and hierarchical `:nth-of-type()` paths.
  - Link cataloger: Scans all anchors, resolves absolute URLs, separates same-origin internal routes from external links, and detects anchor hashes (`#...`) and protocol links (`mailto:`, `tel:`).
  - Button detector: Detects `<button>`, `<input type="button|submit">`, and `[role="button"]`, assesses layout visibility, disabled state, and assigns action risk levels (`LOW`, `MEDIUM`, `HIGH`).
  - Form scanner: Catalogs `<form>` tags, input fields, selects, textareas, required flags, associated labels (via `<label for>` or enclosing label), submit triggers, and calculates form submission risk level.
  - Navigation detector: Scans `<nav>`, `[role="navigation"]`, headers, and footers with link counts.
- **SPA Route Observer (`content/spa-observer.ts`)**:
  - Non-destructively wraps `history.pushState` and `history.replaceState`, and listens to `popstate` and `hashchange` to trigger updates on client-side SPA route transitions.
- **Website Crawler & Boundary Enforcer (`qa/crawler.ts`)**:
  - URL Normalizer: Strips tracking parameters (`utm_*`, `fbclid`, `gclid`, `ref`), hash fragments, and trailing slashes.
  - Strict Same-Origin Boundary: Blocks crawler from navigating external domains.
  - Depth & Page Limiters: Enforces `crawlDepth` and `maxPages` bounds to prevent infinite crawl loops.
  - Discovery Map Builder: Aggregates `PageSnapshot` records into a comprehensive `WebsiteDiscoveryMap`.
- **Side Panel Discovery Visualizer**:
  - `DashboardView`: Displays real-time inventory counts (Links, Buttons, Forms, Images).
  - `LiveRunnerView`: Displays live discovered pages list with status badges (`Scanned`, `Queued`) and real-time sitemap progress.

### Phase 3: Deterministic QA Modules
- **Synthetic Data Engine (`shared/constants/synthetic-data.ts`)**:
  - RFC 2606 compliant non-resolving test emails (`qa-test@example.invalid`), safe telephone numbers (`0000000000`), alphanumeric test passwords, zip codes, and comments.
  - Strict PII-free guarantees for all automated field population.
- **Link Tester (`qa/link-tester.ts`)**: Empty/whitespace `href`s, deprecated `javascript:` pseudo-protocols, dead `#` anchors.
- **Button Tester (`qa/button-tester.ts`)**: Unlabeled button audits and high-risk action button gating (`INFO`, `NEEDS_REVIEW`).
- **Form Tester (`qa/form-tester.ts`)**: Missing submit buttons and unlabeled input fields.
- **Console Tester (`qa/console-tester.ts`)**: Intercepted runtime errors, differentiating fatal crashes (`CRITICAL`) from warnings (`HIGH`).
- **Network Tester (`qa/network-tester.ts`)**: HTTP 4xx/5xx failures with automatic token/query redaction.
- **SEO Tester (`qa/seo-tester.ts`)**: Missing/short/long title, meta descriptions, single `<h1>` hierarchy, canonical tags, OpenGraph.
- **Accessibility Tester (`qa/accessibility-tester.ts`)**: Root `html[lang]`, image `alt` attributes, ambiguous link text.
- **Responsive Tester (`qa/responsive-tester.ts`)**: Mobile viewport meta tag and `width=device-width` validation across 6 device profiles.
- **Performance Tester (`qa/performance-tester.ts`)**: Interactive control density (> 250 controls) and unoptimized large images (> 1800px).
- **QA Orchestrator (`qa/engine.ts`)**: Multi-module orchestrator with penalty-based category scoring and weighted overall score.

### Phase 4: Evidence Engine
- **Visual DOM Highlighter (`content/dom-highlighter.ts`)**:
  - Non-destructive `#ai-qa-highlight-overlay-container` overlay with high `z-index`, glowing pulsing red border, and target badge.
  - Smoothly scrolls elements into view (`scrollIntoView({ behavior: 'smooth', block: 'center' })`).
  - Calculates DPR-scaled crop coordinates with padding clamped to viewport boundaries.
  - Auto-cleans up after duration or on demand (`clearHighlights`).
- **Console Recorder (`content/console-recorder.ts`)**:
  - Intercepts `window.addEventListener('error')` and `window.addEventListener('unhandledrejection')`.
  - Captures error messages, source URLs, line/col numbers, and full stack traces.
  - Circular buffer of 50 events with duplicate suppression.
- **Network Recorder (`content/network-recorder.ts`)**:
  - Observes resource performance entries (`PerformanceObserver` and `getEntriesByType`).
  - Flags HTTP 4xx/5xx failures and slow requests (> 10s).
  - Automatically redacts sensitive query parameters (`token=...`, `apiKey=...`).
- **Screenshot Capture & Element Cropping (`evidence/screenshot.ts`)**:
  - Calls `chrome.tabs.captureVisibleTab` with JPEG compression.
  - Crops screenshots to target element bounding boxes using Canvas / `OffscreenCanvas`.
  - Graceful fallback for headless test environments.
- **Evidence Bundler (`evidence/bundler.ts`)**:
  - Enriches findings with `dom_snippet` and `screenshot` evidence.
  - Automatically prioritizes `CRITICAL` and `HIGH` findings with rate limits to preserve performance.
- **Side Panel Inspection UI**:
  - [src/sidepanel/components/FindingsView.tsx](file:///c:/Users/KHUZAIMA/Desktop/personal/extension-qa/src/sidepanel/components/FindingsView.tsx): Screenshot thumbnail zoom, "Highlight on Page" crosshair button, DOM snippet copy, console stack trace, network badges.
  - [src/sidepanel/components/ImageModal.tsx](file:///c:/Users/KHUZAIMA/Desktop/personal/extension-qa/src/sidepanel/components/ImageModal.tsx): Lightbox modal for enlarged screenshot inspection with download options.

### Phase 5: Autonomous Agent Loop
- **Action Simulator (`content/action-simulator.ts`)**:
  - Dispatches full human-like event sequences: `pointerdown` $\rightarrow$ `mousedown` $\rightarrow$ `focus` $\rightarrow$ `pointerup` $\rightarrow$ `mouseup` $\rightarrow$ `click`.
  - React 16-19 Prototype Setter Bypass: overrides value setter descriptors on inputs, textareas, and selects.
  - Safe form submission handling via `requestSubmit()` or click delegation.
- **Mutation Tracker (`content/mutation-tracker.ts`)**:
  - Non-destructive `MutationObserver` on `document.body` tracking subtree mutations.
  - Real-time modal detector (`dialog[open]`, `[role="dialog"]`, `[aria-modal="true"]`, `.modal.show`).
  - Real-time toast alert detector and classifier (`[role="alert"]`, `.toast`, `.alert-danger`, `.alert-success`) extracting messages and classifying severity.
- **Agent Planner (`agent/planner.ts`)**:
  - Dynamic test task generation for forms, interactive buttons, and internal navigation routes with risk classification.
- **Agent Executor (`agent/executor.ts`)**:
  - Safe task dispatching, pre-action visual highlighting, bounded retries, and HIGH-risk gating.
- **Agent Observer (`agent/observer.ts`)**:
  - Pre/post action state baseline and DOM settling (350ms) telemetry.
- **Agent Reasoner (`agent/reasoner.ts`)**:
  - Deterministic defect classification for dead buttons, unhandled exceptions, network failures, and form errors.
- **Agent Verifier (`agent/verifier.ts`)**:
  - Autonomous bug re-testing pipeline confirming defect reproducibility.
- **Agent Runner (`agent/runner.ts`)**:
  - Full feedback loop coordinator: `PLAN` $\rightarrow$ `EXECUTE` $\rightarrow$ `OBSERVE` $\rightarrow$ `REASON` $\rightarrow$ `VERIFY` $\rightarrow$ `REPORT`.

### Phase 6: Local AI Engine & WebGPU Reasoning
- **WebGPU Hardware Detector (`ai/webgpu-detector.ts`)**:
  - Tests `navigator.gpu` and requests GPU adapter limits.
  - Categorizes hardware into tiers: `'FULL_WEBGPU'` (>= 1GB buffer, recommends 1B-3B models), `'LIGHT_WEBGPU'` (< 1GB buffer, recommends sub-1B models like SmolLM2-360M), or `'UNSUPPORTED'` (deterministic fallback).
- **Structured Prompt Engineering (`ai/prompt-templates.ts`)**:
  - `AMBIGUOUS_ACTION_PROMPT`: Directs LLM to evaluate element context, telemetry, and classify as `DEAD_BUTTON`, `EXPECTED_INERT`, `UNHANDLED_EXCEPTION`, or `INFORMATIVE_ONLY`.
  - `ACCESSIBILITY_REMEDIATION_PROMPT`: Produces exact HTML/JSX code fixes with WCAG 2.1 AA guideline references.
  - `extractJsonFromResponse`: Resilient parser stripping markdown fences and extracting JSON from chat commentary.
- **Model Manager (`ai/model-manager.ts`)**:
  - Powered by `@mlc-ai/web-llm` for local in-browser WebGPU execution.
  - Tracks loading state (`NOT_LOADED`, `DOWNLOADING`, `READY`, `ERROR`) with percentage progress callbacks.
  - Supports model unloading to release VRAM and CacheStorage deletion.
- **Hybrid AI Reasoner (`ai/ai-reasoner.ts`)**:
  - Arbitrates borderline/ambiguous verdicts (`confidence < 0.9` or `requiresVerification`).
  - Suppresses false positives when local AI determines an element is intentionally inert or decorative.
  - Boosts confidence and provides actionable developer code fixes when defect is confirmed.
  - Safe deterministic fallback whenever WebGPU is unavailable.
- **Side Panel Model Management UI (`sidepanel/components/SettingsView.tsx`)**:
  - Live WebGPU capability badge (`WebGPU Active`, `Lightweight WebGPU`, `Deterministic Only`).
  - Model selection dropdown (`SmolLM2-360M`, `Llama-3.2-1B`).
  - "Load Model" button with progress bar and "Unload & Clear VRAM" controls.
- **Comprehensive Phase 6 Test Suite**:
  - 4 new test suites: `webgpu-detector.test.ts`, `prompt-templates.test.ts`, `model-manager.test.ts`, and `ai-reasoner.test.ts`.
  - Total: 119 unit tests (100% passing across 29 suites).

### Phase 7: Professional Report Generator
- **Report Data Model & Types (`reporting/report-types.ts`)**:
  - Strongly typed `QAReportData`, `ReportMetadata`, `ExecutiveSummary`, `ReportFormat` (`'HTML' | 'PDF' | 'JSON' | 'MARKDOWN'`), and `QualityRating` (`EXCELLENT` $\ge 90$, `GOOD` $\ge 75$, `FAIR` $\ge 60$, `NEEDS_IMPROVEMENT` $\ge 40$, `CRITICAL` $< 40$).
- **JSON Report Generator (`reporting/json-generator.ts`)**:
  - Machine-readable JSON export conforming to `$schema: https://ai-website-qa-agent.internal/schemas/v1/qa-report.json`.
  - Captures full target context, test execution metrics, category scores, finding inventories with reproduction steps, technical evidence summaries, and full discovery site maps for CI/CD ingestion.
- **Markdown Report Generator (`reporting/markdown-generator.ts`)**:
  - GitHub Flavored Markdown (GFM) formatted output optimized for GitHub Issues, PR summaries, or Jira tickets.
  - Generates executive summary tables, defect breakdown counts with severity emojis, category score tables, and expandable `<details>` blocks for technical DOM snippets, console stacks, and network traces.
- **HTML & PDF Report Generator (`reporting/html-generator.ts`)**:
  - Self-contained, responsive single-file HTML document with dark theme styling.
  - Visual score gauge ring, defect metric counters, category breakdown progress bars, and rich defect cards with embedded screenshot base64 images and actionable remediation code boxes.
  - Dedicated `@media print` stylesheet with clean light background, page break avoidance, and high-contrast typography for native browser print-to-PDF generation.
  - Zero defect celebratory banner with celebratory feedback when scans identify no issues.
- **Central Report Engine (`reporting/report-engine.ts`)**:
  - Unified report coordinator: `buildReportData`, `formatReport`, `saveReport` (IndexedDB persistence in `reports` store), and `downloadFile` (DOM download trigger with data URL fallback).
- **Side Panel Report UI (`sidepanel/components/ReportView.tsx`)**:
  - Added dedicated `'report'` tab in `TabNav`.
  - Executive summary card displaying overall health score, quality rating badge, defect severity pill counters, and category score progress bars.
  - Interactive format preview tabs (`summary`, `html`, `markdown`, `json`) with live syntax-highlighted code views.
  - Quick action toolbar: Download Report (`.html`, `.md`, `.json`), Copy to Clipboard, and Print to PDF (`window.print()`).
- **Comprehensive Phase 7 Test Suite**:
  - 4 new test suites: `json-generator.test.ts`, `markdown-generator.test.ts`, `html-generator.test.ts`, and `report-engine.test.ts`.
  - Total: 137 unit tests (100% passing across 33 suites).

### Phase 8: Optional Supabase Cloud Integration & Shareable URLs
- **Supabase Configuration Data Model (`shared/types/session.ts` & `shared/constants/defaults.ts`)**:
  - Added `SupabaseConfig` (`enabled`, `url`, `anonKey`, `storageBucket`, `shareableUrlPrefix`) with default `enabled: false` to ensure strict privacy-first opt-in behavior.
- **Lightweight Supabase REST Client (`cloud/supabase-client.ts`)**:
  - Zero npm dependencies, built directly with native `fetch` for optimal Chrome Extension bundle size.
  - `testConnection`: Validates Supabase URL format, JWT length, and tests live credentials via `GET /rest/v1/` with latency measurement.
  - `uploadStorageAsset`: Uploads files/blobs to storage buckets (`/storage/v1/object/<bucket>/<path>`) with `x-upsert: true`.
  - `insertReportRecord`: Inserts or upserts audit records in `qa_reports` table via `POST /rest/v1/qa_reports`.
  - `getPublicStorageUrl`: Derives canonical public URLs for published reports and assets.
- **Cloud Sync Engine (`cloud/cloud-sync.ts`)**:
  - `dataUrlToBlob`: Converts captured base64 screenshots into binary Blobs with automatic MIME extraction.
  - Asset synchronization: Uploads visual screenshot evidence to `evidence/<reportId>/<findingId>.png` and replaces local base64 strings with lightweight cloud URLs.
  - Report synchronization: Generates and uploads standalone HTML reports (`reports/<reportId>.html`) and JSON schemas (`reports/<reportId>.json`).
  - Table upsert: Inserts executive summaries, category scores, defect lists, and asset URLs into `qa_reports`.
  - Shareable URL generation: Supports direct public HTML links or custom team dashboard URL prefixes (`shareableUrlPrefix`).
- **Side Panel Settings UI (`sidepanel/components/SettingsView.tsx`)**:
  - "Supabase Cloud Sync (Optional)" toggle switch.
  - Supabase Project URL and Anon Key input fields.
  - Interactive "Test Connection" button with live status indicator (`Connected (Xms)` or error reason).
  - Prominent privacy assurance disclaimer confirming zero cloud transmission unless explicitly commanded.
- **Side Panel Report UI (`sidepanel/components/ReportView.tsx`)**:
  - "Share Online (Supabase Cloud)" button with loading spinner.
  - Success banner with "Copy Link" and "Open" actions for instantaneous sharing.
  - Inline error notifications for missing credentials or network issues.
- **Comprehensive Phase 8 Test Suite**:
  - 2 new test suites: `supabase-client.test.ts` and `cloud-sync.test.ts`.
  - Total: 149 unit tests (100% passing across 35 suites).

---

### Phase 9: Privacy & Security Hardening
- **Central Security Redactor (`shared/security/redactor.ts`)**:
  - Credit Card Redaction: Luhn-plausible and formatted card numbers masked as `[REDACTED_CARD: ****-1234]`.
  - Social Security Numbers: Formatted and unformatted SSNs masked as `[REDACTED_SSN]`.
  - API Tokens & Secret Keys: Regex patterns for OpenAI keys (`sk-proj-...`, `sk-...`), GitHub personal access tokens (`ghp_...`, `github_pat_...`), AWS access key IDs (`AKIA...`), and generic Authorization `Bearer <token>` headers.
  - Sensitive URL Query Parameters: Strips secrets in URLs (`token`, `password`, `secret`, `apiKey`, `access_token`, `auth`, `api_key`, `session`) with `[REDACTED_SECRET]`.
  - Deep Recursive Object Sanitization (`redactDeep`): Recursively walks deeply nested objects, arrays, headers, and logs with a `WeakSet` circular reference guard.
- **Security Pipeline Hooks**:
  - Logger Hook (`shared/logger/logger.ts`): All `log.debug/info/warn/error` messages and metadata are passed through `redactDeep` before console logging or IndexedDB persistence.
  - Evidence Bundler Hook (`evidence/bundler.ts`): All network traffic details, console error payloads, and failure traces are automatically redacted.
  - Report Engine Hook (`reporting/report-engine.ts`): All findings, issue descriptions, selector context, and network logs are deep-redacted before generating JSON, Markdown, or HTML.
- **High-Risk Action Confirmation Gate (`agent/executor.ts`)**:
  - Enforces strict safety boundary where actions with `riskLevel: HIGH` (e.g. checkout, payment forms, credential submission, account deletion) are blocked unless `approvedByUser: true` is explicitly provided.
  - Prevents unintended external side effects during automated test runs.
- **Approval Banner Component (`sidepanel/components/ApprovalBanner.tsx`)**:
  - Responsive visual approval modal/banner displaying target element description, risk reason, and Approve / Skip actions.
- **Phase 9 Test Suites**:
  - `tests/unit/redactor.test.ts` (10 tests): Validates redaction of cards, SSNs, API keys, URLs, and recursive deep objects.
  - `tests/unit/security-audit.test.ts` (4 tests): Verifies zero PII leakage across logger, evidence bundler, report engine, and executor gating.
  - Total: 159 unit tests (100% passing across 37 suites).

### Phase 10: End-to-End Testing & Extension Packaging
- **Mock Test Site Fixture (`tests/fixtures/mock-sites/buggy-store.html`)**:
  - Realistic HTML e-commerce fixture containing intentional defects:
    - Dead `#` anchors, `javascript:void(0)` links, empty `href`s, and external routing.
    - Missing meta description, short title tag, multiple `<h1>` headings, missing canonical link.
    - Broken images, missing descriptive `alt` tags, empty `alt` on non-decorative images.
    - Unlabeled interactive icon buttons, high-risk deletion action buttons.
    - Forms lacking submit buttons, inputs missing labels/placeholders.
    - Accessibility flaws: empty `<html lang>`, ambiguous link text ("Click here").
    - Injected runtime console exceptions and HTTP 500 network failures with sensitive query parameters.
- **End-to-End Autonomous Lifecycle Test (`tests/e2e/e2e-workflow.test.ts`)**:
  - Full-lifecycle integration test validating:
    - `DISCOVER`: `buildPageSnapshot` catalogs all DOM elements, navigation, and heading hierarchy.
    - `CRAWL`: `WebsiteCrawler` normalizes URLs, enqueues internal routes, respects boundaries, and constructs the `WebsiteDiscoveryMap`.
    - `QA VERIFY`: `QAEngine` coordinates all 9 testers (`link`, `button`, `form`, `console`, `network`, `seo`, `accessibility`, `responsive`, `performance`), calculates penalized category scores and overall quality score.
    - `PLAN`: `AgentPlanner` creates prioritized action matrix and identifies high-risk tasks.
    - `EXECUTE & GATE`: `AgentExecutor` blocks high-risk deletion/payment actions when unapproved, and safely executes when approved; `simulateClick` verifies DOM event firing.
    - `REASON`: `AIReasoner` evaluates interaction outcomes and synthesizes remediation guidance.
    - `REPORT`: `ReportEngine` generates schema-valid JSON, GFM Markdown, and self-contained HTML reports with zero PII/secret leakage.
- **Extension Asset & Manifest Polish**:
  - Generated full set of crisp PNG icons (`icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`) via `scripts/generate-icons.js`.
  - Registered 32x32 icon in `manifest.json` for high-DPI Windows and Retina display clarity.
  - Bumped version to `1.0.0` in `package.json` and `manifest.json`.
- **Production Packaging Engine (`scripts/package-extension.js`)**:
  - Zero-dependency Node script utilizing `zlib.deflateRawSync` and standard ZIP specification.
  - Validates presence and integrity of all required Manifest V3 files in `dist/`.
  - Generates distribution archive: `dist/ai-website-qa-agent-v1.0.0.zip` (16 files, 2219.71 KB).
  - Verified archive integrity using PowerShell `.NET ZipFile` reader.
- **Comprehensive Project Documentation (`README.md`)**:
  - Complete architecture diagrams (ASCII and Mermaid).
  - Feature specifications, quickstart installation guide ("Load Unpacked"), user instructions, safety model, and database schemas.

### Phase 11: Real Tab Connection & Dynamic Injection Engine
- **Active Inspectable Tab Resolution (`background/permissions-manager.ts`)**:
  - Replaced single `chrome.tabs.query({ active: true, currentWindow: true })` with multi-tier window resolution prioritizing `lastFocusedWindow: true`, falling back to all active tabs across windows.
  - Automatically identifies target inspectable web tabs (`http://`, `https://`) while excluding extension internal pages and restricted schemas (`chrome://`, `chrome-extension://`, `about:blank`).
- **Dynamic Content Script Auto-Injection (`shared/messaging/bus.ts`)**:
  - `ensureContentScriptInjected(tabId)` checks tab readiness via ping and injects `src/content/index.js` using `chrome.scripting.executeScript` for tabs opened before extension loading.
  - Automatic injection retry in `sendToTab` resolves "Receiving end does not exist" without page refresh.
- **Side Panel Tab Synchronization (`sidepanel/App.tsx` & `DashboardView.tsx`)**:
  - Multi-window listeners (`onActivated`, `onUpdated`, `onHighlighted`, `onFocusChanged`) guarantee side panel immediately locks onto whatever tab the user focuses.
  - Direct "Detect Tab" refresh button and restricted URL warning badges.

### Phase 12: Multi-Model Cloud LLM Engine (Gemini, OpenAI, Claude)
- **Cloud LLM Client (`ai/cloud-llm-client.ts`)**:
  - Native REST client with zero third-party dependencies supporting Google Gemini (`gemini-1.5-flash`, `gemini-1.5-pro`), OpenAI (`gpt-4o-mini`, `gpt-4o`), and Anthropic Claude (`claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`).
  - `resolveActiveProvider`: Automatically discovers any active API key (Gemini -> OpenAI -> Anthropic -> local WebGPU -> deterministic fallback).
  - Live API Key Test feature with latency measurement and error reporting.
- **Secure Key Storage & Redaction (`storage/settings-store.ts` & `shared/security/redactor.ts`)**:
  - Masked inputs in Settings with show/hide eye toggle.
  - Zero PII / zero credential leakage: regex redactors purge Gemini (`AIza...`), OpenAI (`sk-...`), and Anthropic (`sk-ant-...`) keys from logs, reports, and sync payloads.
- **Cloud-Enhanced AI Reasoner (`ai/ai-reasoner.ts`)**:
  - Dispatches defect arbitration and remediation advice to user's selected cloud LLM with automatic fallback to local WebGPU SmolLM2.

### Phase 13: Autonomous Website Flow & UX Journey Analysis Engine
- **Flow & UX Journey Analyzer (`ai/flow-analyzer.ts`)**:
  - Comprehensive human-like QA audit evaluating website user flow:
    1. **Page Intent Classification**: E-Commerce / Transactions, SaaS / Web Apps, Lead Generation, or General Content.
    2. **Call-to-Action (CTA) Audit**: Evaluates primary conversion triggers above the fold and in sticky headers.
    3. **Navigation & Return Pathways**: Detects isolated pages with sparse navigation and missing global headers/footers.
    4. **Inert Anchors & Broken Link Placeholders**: Identifies `href="#"` or broken pseudo-protocols causing user friction.
    5. **Form Cognitive Friction**: Assesses field counts, progressive disclosure, and submit button visibility.
    6. **Value Proposition & H1 Hierarchy**: Checks clarity of messaging within 3 seconds of arrival.
  - Generates numerical Flow Score (0-100), rating (`EXCELLENT`, `GOOD`, `FAIR`, `NEEDS_OPTIMIZATION`, `CRITICAL_FRICTION`), strengths, friction points, and actionable step-by-step improvement recommendations.
  - Seamlessly enriched by Cloud LLMs for strategic conversion optimization (CRO) insights.
- **Comprehensive Reporting & UI Integration (`reporting/report-engine.ts`, `html-generator.ts`, `DashboardView.tsx`)**:
  - Displays Flow Audit Card in Side Panel Dashboard and includes full Website Flow Critique with badges in HTML, Markdown, and JSON reports.

### Phase 14: Human-Grade QA Capabilities & Advanced Exploratory Engine
- **Business Logic & Math Calculation Verifier (`qa/business-logic-verifier.ts`)**:
  - Automatically parses item prices, quantities, subtotal, promotional/coupon discounts, taxes, and shipping fees.
  - Mathematically validates the pricing equation: `(Subtotal - Discount + Tax + Shipping) === Total`.
  - Flags calculation discrepancies, negative totals, and uncharged fees, enriched with Cloud LLM insights.
- **Virtual Mailbox & OTP Verification Engine (`agent/virtual-mailbox.ts`)**:
  - Automatically provisions disposable mailboxes (`@1secmail.com`) during registration and password reset audits.
  - Polls mailbox with timeout and automatically extracts 4-8 digit numeric OTPs and verification links via regular expressions.
- **Chaos Testing & Boundary Fuzzing (`qa/chaos-tester.ts`)**:
  - `testButtonDebounce`: Audits sensitive transaction buttons (Submit, Pay, Order) for rapid double-click race conditions and missing loading/disabled guards.
  - `testFormBoundaries`: Detects missing client-side `maxlength` bounds and non-negative constraints on numeric/quantity fields.
  - Pre-built fuzzing vectors covering `LENGTH_OVERFLOW` (5,000 chars), `UNICODE_STRESS`, `NUMERIC_BOUNDARY`, and `SANITIZATION_PROBE`.
- **Multi-Tab & Popup / OAuth Lifecycle Monitor (`background/popup-monitor.ts`)**:
  - Tracks browser popup windows created during active QA sessions (Google OAuth, GitHub, Stripe, PayPal, Clerk, Auth0).
  - Categorizes service type and observes lifecycle (`OPENED` -> `NAVIGATING` -> `CLOSED`).
  - Detects premature closures (< 800ms) caused by CORS errors, redirect misconfigurations, or browser popup blockers.
- **Backend Database Verification (`qa/backend-verifier.ts`)**:
  - Directly queries Supabase PostgREST tables or custom REST endpoints following frontend actions.
  - Flags missing database persistence as `CRITICAL` silent data loss defects.
- **Bot Shield & CAPTCHA Detector (`qa/bot-shield-detector.ts`)**:
  - Automatically identifies Cloudflare Turnstile, Google reCAPTCHA, hCaptcha, Arkose Labs, and AWS WAF.
  - Provides official developer staging test keys and CI/CD bypass guidance.
- **Settings UI Controls (`sidepanel/components/SettingsView.tsx`)**:
  - Interactive switches for all 4 advanced modules under the new "Human-Grade QA Engine" section.

---

## Fixed Bugs
1. **JSDOM `<title>` overwrite**: In `dom-scanner.test.ts`, setting `document.head.innerHTML` was clearing `document.title`. Added `<title>` directly inside the head innerHTML.
2. **Relative Link Resolution**: `extractLinks` now correctly resolves relative URLs against `currentOrigin` in mock/JSDOM environments as well as live browser tabs.
3. **Crawler Processed Queue State**: `addPageSnapshot` now removes the currently processed page from `queue` so queue length and visited count remain accurate.
4. **Decoupled Discovery Trigger**: `sessionManager.startSession` now stays pure and returns `INITIALIZING` immediately, while `runDiscovery()` is triggered asynchronously by the message router to avoid test race conditions.
5. **Selector Generator Typing**: Resolved implicit `any` and recursive type inference on `parentElement` in `element-detector.ts`.
6. **Canvas Image Decode in Headless Tests**: `cropScreenshotToElement` now checks for canvas 2D support before attempting image decoding and includes safety timeouts to prevent hangs in JSDOM.
7. **State Machine Cyclic Transitions**: Added `PLANNING` to allowed transitions from `OBSERVING` and `REASONING` in `VALID_TRANSITIONS` to support multi-task agent loops.
8. **React 19 Input Value Setter Override**: Dispatched native property descriptor setter in `action-simulator.ts` to ensure React's synthetic input tracker updates correctly.
9. **Parameter Shadowing in Runner**: Resolved variable shadowing on `aiReasoner` parameter in `AgentRunner` constructor.
10. **WebGPU Node Global Types**: Created safe typecasted navigator accessor in `webgpu-detector.ts` for environments without standard `@types/webgpu`.
11. **URL ObjectURL Node Fallback**: Added data URL fallback in `report-engine.ts` for environments without browser `URL.createObjectURL`.
12. **URL Parameter Redaction Format**: In `shared/security/redactor.ts`, adjusted query parameter regex to preserve delimiter and param name (`$1$2[REDACTED_SECRET]`) for compatibility across runtime recorders and audit suites.
13. **OpenAI Key Pattern Bounds**: In `shared/security/redactor.ts`, relaxed lower bound on key length (`{10,}`) to reliably mask shorter test project API keys.
14. **Empty Href Link Discovery**: In `src/content/element-detector.ts`, updated `extractLinks` to capture empty or whitespace-only anchor tags as `DiscoveredLink` items with `normalizedUrl: ''` so deterministic `link-tester` audits catch them on live web pages.
15. **E2E Task/Observation Typings**: Aligned `ReasoningVerdict`, `ObservationResult`, and `SessionStats` object literals in `tests/e2e/e2e-workflow.test.ts` to adhere to strict TypeScript interfaces.
16. **Side Panel Active Tab Disconnection**: `chrome.tabs.query({ active: true, currentWindow: true })` returned `[]` because side panels have their own window ID; resolved via `lastFocusedWindow: true` fallback.
17. **Pre-Existing Tab Missing Content Script**: Content scripts were missing in tabs opened before extension installation; resolved via `ensureContentScriptInjected` with `chrome.scripting.executeScript`.
18. **FlowAnalyzer Metadata Extraction**: Supported both standard `metadata: PageMetadata` and legacy snapshot shapes to eliminate undefined property errors during discovery.
19. **Cloud LLM Chat Array Signature**: Allowed `generateCompletion` to accept either raw strings or role/content chat message arrays for unified reasoning dispatch.
20. **Content Script ES Module SyntaxError**: Vite originally bundled `src/content/index.js` as an ES module chunk importing `assets/logger-*.js`. Chrome content scripts cannot execute ES module `import` statements and threw `Uncaught SyntaxError: Cannot use import statement outside a module`. Solved by compiling `content/index.ts` via `vite.content.config.ts` into a 100% self-contained IIFE bundle (`formats: ['iife']`) with zero external imports.
21. **Content Script Ping Protocol Mismatch**: Content script listened for `CONTENT_SCRIPT_PING`, while `ensureContentScriptInjected` sent `PING`. Updated both sides to accept both message types interchangeably.
22. **Discount Keyword Substring Conflict in Chaos Tester**: Keyword regex `/count/` matched substring `discountCode`, incorrectly flagging coupon fields as numeric counters. Resolved by requiring boundary matches and excluding discount identifiers.
23. **Snapshot Defensive Array Handling**: Guarded `snapshot.forms`, `snapshot.buttons`, and `snapshot.links` against `undefined` or null in `BotShieldDetector` and `ChaosTester` to prevent runtime crashes on non-standard page representations.

---

## Database Schemas (`ai_qa_agent_db` v2)

| Store | KeyPath | Indexes | Description |
|---|---|---|---|
| `sessions` | `id` | `startTime` | QA run session records, URL, state, progress, stats, and config |
| `findings` | `id` | `sessionId`, `severity`, `status` | Detected issues, evidence, expected vs actual, and recommendations |
| `projects` | `id` | `origin` | Target website history and aggregate metrics |
| `logs` | `id` | `sessionId`, `timestamp` | Internal event and diagnostic traces |
| `settings` | `key` | None | User preferences, AI keys, and safety configurations |
| `reports` | `id` | `sessionId` | Generated report documents |
| `page_snapshots` | `url` | `timestamp` | Full DOM structural snapshots of inspected pages |
| `discovery_maps` | `sessionId` | None | Aggregated website discovery map, internal routes, and element inventory |

---

## Verification Summary
- **TypeScript**: `PASS` (`tsc --noEmit`, 0 errors across entire codebase)
- **Build**: `PASS` (`npm run build`, Vite bundle + IIFE content script in `dist/`)
- **Tests**: `PASS` (47 test suites, 214 tests passed, 0 failures, 100% passing)
- **Packaging**: `PASS` (`dist/ai-website-qa-agent-v1.0.0.zip`, 15 files, 2235.61 KB)
- **Manifest**: `PASS` (Manifest V3, icons 16, 32, 48, 128, sidePanel, serviceWorker, contentScripts)
