export type AgentState =
  | 'IDLE'
  | 'INITIALIZING'
  | 'DISCOVERING'
  | 'ANALYZING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'OBSERVING'
  | 'REASONING'
  | 'VERIFYING'
  | 'REPORTING'
  | 'COMPLETED'
  | 'ERROR';

export type ActionRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type TestTaskType =
  | 'LINK_CLICK'
  | 'BUTTON_CLICK'
  | 'TAB_CLICK'
  | 'FORM_FILL'
  | 'INPUT_ENTRY'
  | 'FORM_SUBMIT'
  | 'NAVIGATION';

export type TestTaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'SKIPPED'
  | 'BLOCKED';

export interface TestTask {
  id: string;
  type: TestTaskType;
  title: string;
  description: string;
  targetSelector: string;
  targetElementInfo?: {
    tag: string;
    text?: string;
    name?: string;
    inputType?: string;
    ariaLabel?: string;
    role?: string;
  };
  riskLevel: ActionRiskLevel;
  expectedOutcome: string;
  inputData?: Record<string, string>;
  status: TestTaskStatus;
  executionTimeMs?: number;
  error?: string;
  verdict?: ReasoningVerdict;
  retryCount?: number;
  approvedByUser?: boolean;
}

export interface TestPlan {
  id: string;
  sessionId: string;
  pageUrl: string;
  tasks: TestTask[];
  createdAt: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface ObservationResult {
  taskId: string;
  preUrl: string;
  postUrl: string;
  urlChanged: boolean;
  domMutationsCount: number;
  modalAppeared: boolean;
  errorAlertAppeared: boolean;
  successAlertAppeared: boolean;
  alertMessage?: string;
  consoleErrors: import('../../qa/console-tester').ConsoleErrorItem[];
  networkFailures: import('../../qa/network-tester').NetworkFailureItem[];
  timestamp: number;
}

export interface ReasoningVerdict {
  taskId: string;
  passed: boolean;
  confidence: number;
  rationale: string;
  category?: import('./qa').QACategory;
  severity?: import('./qa').FindingSeverity;
  suggestedRemediation?: string;
  requiresVerification?: boolean;
}

export interface VerificationResult {
  taskId: string;
  originalVerdict: ReasoningVerdict;
  isReproducible: boolean;
  confirmedFinding: boolean;
  reproductionAttempts: number;
  notes: string;
}

export interface PendingActionApproval {
  id: string;
  type: string;
  description: string;
  targetElement?: string;
  pageUrl: string;
  riskLevel: ActionRiskLevel;
  timestamp: number;
}

export interface AgentStepEvent {
  id: string;
  timestamp: number;
  fromState: AgentState;
  toState: AgentState;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface JarvisVisionState {
  lastScreenshotUrl?: string;
  visualAnalysisText?: string;
  detectedVisualElements?: string[];
  currentGoal?: string;
  timestamp?: number;
}
