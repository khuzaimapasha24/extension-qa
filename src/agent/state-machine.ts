import { AgentState } from '../shared/types/agent';
import { createLogger } from '../shared/logger/logger';

const logger = createLogger('StateMachine');

export const VALID_TRANSITIONS: Record<AgentState, AgentState[]> = {
  IDLE: ['INITIALIZING'],
  INITIALIZING: ['DISCOVERING', 'ERROR', 'IDLE', 'COMPLETED'],
  DISCOVERING: ['ANALYZING', 'ERROR', 'IDLE', 'COMPLETED'],
  ANALYZING: ['PLANNING', 'ERROR', 'IDLE', 'COMPLETED'],
  PLANNING: ['EXECUTING', 'ERROR', 'IDLE', 'COMPLETED'],
  EXECUTING: ['OBSERVING', 'ERROR', 'IDLE', 'COMPLETED'],
  OBSERVING: ['REASONING', 'PLANNING', 'EXECUTING', 'REPORTING', 'ERROR', 'IDLE', 'COMPLETED'],
  REASONING: ['VERIFYING', 'PLANNING', 'EXECUTING', 'REPORTING', 'ERROR', 'IDLE', 'COMPLETED'],
  VERIFYING: ['EXECUTING', 'REPORTING', 'ERROR', 'IDLE', 'COMPLETED'],
  REPORTING: ['COMPLETED', 'ERROR', 'IDLE'],
  COMPLETED: ['IDLE', 'INITIALIZING'],
  ERROR: ['IDLE', 'INITIALIZING'],
};

export class AgentStateMachine {
  private currentState: AgentState = 'IDLE';
  private history: { from: AgentState; to: AgentState; timestamp: number }[] = [];

  constructor(initialState: AgentState = 'IDLE') {
    this.currentState = initialState;
  }

  public getState(): AgentState {
    return this.currentState;
  }

  public canTransitionTo(targetState: AgentState): boolean {
    const allowed = VALID_TRANSITIONS[this.currentState] || [];
    return allowed.includes(targetState);
  }

  public transitionTo(targetState: AgentState): boolean {
    if (this.currentState === targetState) {
      return true;
    }

    if (!this.canTransitionTo(targetState)) {
      logger.warn(`Illegal state transition attempted: ${this.currentState} -> ${targetState}`);
      return false;
    }

    const previous = this.currentState;
    this.currentState = targetState;
    this.history.push({
      from: previous,
      to: targetState,
      timestamp: Date.now(),
    });

    logger.info(`State transition: ${previous} -> ${targetState}`);
    return true;
  }

  public reset(): void {
    this.currentState = 'IDLE';
    this.history = [];
  }

  public getHistory() {
    return [...this.history];
  }
}
